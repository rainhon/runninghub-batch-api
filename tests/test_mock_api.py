"""
测试 Mock API 客户端
验证模拟服务功能是否正常
"""
import os
import sys
import time

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 启用 Mock 模式
os.environ['USE_MOCK_SERVICE'] = 'true'

from integrations.mock_api_client import (
    submit_mock_task,
    query_mock_task,
    get_mock_stats,
    reset_mock
)
from integrations.api_client_wrapper import get_api_mode


def test_single_task():
    """测试单个任务"""
    print("=" * 60)
    print("测试 1: 单个文生图任务")
    print("=" * 60)

    # 提交任务
    result = submit_mock_task("text_to_image", {
        "prompt": "a beautiful sunset over the ocean",
        "aspectRatio": "16:9"
    })

    print(f"提交结果: {result}")

    if result.get("code") != 200:
        print(f"❌ 提交失败: {result}")
        return False

    task_id = result.get("taskId")
    print(f"✅ 任务已提交: {task_id}\n")

    # 轮询查询
    print("开始轮询任务状态...")
    for i in range(15):
        time.sleep(2)
        status = query_mock_task(task_id)
        state = status.get("status")
        msg = status.get("message", "")

        print(f"  [{i+1:2d}] {state:10s} - {msg}")

        if state == "SUCCESS":
            result_url = status["results"][0]["url"]
            print(f"\n✅ 任务成功完成!")
            print(f"   结果 URL: {result_url}")
            return True
        elif state == "FAILED":
            error = status.get("errorMessage", "未知错误")
            print(f"\n❌ 任务失败: {error}")
            return False

    print("\n⏰ 轮询超时")
    return False


def test_batch_tasks():
    """测试批量任务"""
    print("\n" + "=" * 60)
    print("测试 2: 批量任务（5个）")
    print("=" * 60)

    task_ids = []
    task_types = ["text_to_image", "image_to_image", "text_to_video", "image_to_video"]

    # 提交批量任务
    for i in range(5):
        task_type = task_types[i % len(task_types)]
        result = submit_mock_task(task_type, {
            "prompt": f"batch test task {i+1}"
        })

        if result.get("code") == 200:
            task_id = result["taskId"]
            task_ids.append(task_id)
            print(f"✅ 任务 {i+1} 已提交 ({task_type}): {task_id}")
        else:
            print(f"❌ 任务 {i+1} 提交失败: {result}")

    print(f"\n共提交 {len(task_ids)} 个任务\n")

    # 等待所有任务完成
    print("等待所有任务完成...")
    max_wait = 60
    start = time.time()
    completed = 0

    while completed < len(task_ids) and time.time() - start < max_wait:
        completed = 0
        success = 0
        failed = 0

        for tid in task_ids:
            status = query_mock_task(tid)
            state = status.get("status")

            if state == "SUCCESS":
                completed += 1
                success += 1
            elif state == "FAILED":
                completed += 1
                failed += 1

        print(f"  进度: {completed}/{len(task_ids)} 完成 (成功: {success}, 失败: {failed})")
        time.sleep(2)

    # 显示统计
    stats = get_mock_stats()
    print("\n📊 最终统计:")
    print(f"  总任务数: {stats['total_tasks']}")
    print(f"  成功: {stats['success']}")
    print(f"  失败: {stats['failed']}")
    print(f"  运行中: {stats['running']}")

    return completed == len(task_ids)


def test_error_handling():
    """测试错误处理"""
    print("\n" + "=" * 60)
    print("测试 3: 错误处理")
    print("=" * 60)

    # 测试缺少必需参数
    print("测试 3.1: 缺少 prompt 参数")
    result = submit_mock_task("text_to_image", {
        "aspectRatio": "16:9"
    })
    print(f"  结果: {result}")
    if result.get("code") == 400:
        print("  ✅ 正确返回 400 错误\n")
    else:
        print("  ❌ 应该返回 400 错误\n")

    # 测试不支持的任务类型
    print("测试 3.2: 不支持的任务类型")
    result = submit_mock_task("invalid_type", {
        "prompt": "test"
    })
    print(f"  结果: {result}")
    if result.get("code") == 400:
        print("  ✅ 正确返回 400 错误\n")
    else:
        print("  ❌ 应该返回 400 错误\n")

    # 测试查询不存在的任务
    print("测试 3.3: 查询不存在的任务")
    result = query_mock_task("non_existent_task_id")
    print(f"  结果: {result}")
    if result.get("code") == 404:
        print("  ✅ 正确返回 404 错误\n")
    else:
        print("  ❌ 应该返回 404 错误\n")


def test_concurrent_limit():
    """测试并发限制"""
    print("=" * 60)
    print("测试 4: 并发限制")
    print("=" * 60)

    reset_mock()

    # 尝试提交超过限制的任务数
    max_concurrent = 50
    print(f"最大并发数: {max_concurrent}")
    print(f"尝试提交 {max_concurrent + 10} 个任务...\n")

    success_count = 0
    rejected_count = 0

    for i in range(max_concurrent + 10):
        result = submit_mock_task("text_to_image", {
            "prompt": f"concurrent test {i+1}"
        })

        if result.get("code") == 200:
            success_count += 1
        else:
            rejected_count += 1
            print(f"  任务 {i+1} 被拒绝: {result.get('message')}")

    print(f"\n结果: {success_count} 成功, {rejected_count} 被拒绝")

    if rejected_count > 0:
        print("✅ 并发限制生效")
    else:
        print("⚠️ 并发限制未生效")


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("Mock API 客户端测试")
    print("=" * 60)
    print(f"当前模式: {get_api_mode()} API\n")

    try:
        # 运行测试
        test_single_task()
        test_batch_tasks()
        test_error_handling()
        test_concurrent_limit()

        print("\n" + "=" * 60)
        print("✅ 所有测试完成")
        print("=" * 60 + "\n")

    except KeyboardInterrupt:
        print("\n\n⚠️ 测试被中断")
    except Exception as e:
        print(f"\n\n❌ 测试出错: {str(e)}")
        import traceback
        traceback.print_exc()
