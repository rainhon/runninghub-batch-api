"""
测试多平台适配功能
"""
import os
import sys

# 设置 Mock 模式
os.environ["USE_MOCK_SERVICE"] = "true"
os.environ["RUNNINGHUB_DIRECT_API_KEY"] = ""

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core import (
    get_platform_config,
    get_enabled_platforms,
    get_platforms_for_task_type,
    get_platform_api_key,
    get_all_task_types,
    get_task_type_config,
    TASK_TYPE_CONFIG
)

print("=" * 60)
print("多平台适配功能测试")
print("=" * 60)
print()

# 测试 1: 获取所有启用的平台
print("【测试 1】获取所有启用的平台")
platforms = get_enabled_platforms()
print(f"✅ 共 {len(platforms)} 个启用平台:")
for p in platforms:
    print(f"  - {p['display_name']} (ID: {p['platform_id']}, 优先级: {p['priority']})")
    print(f"    支持类型: {', '.join(p['supported_task_types'])}")
print()

# 测试 2: 按任务类型过滤平台
print("【测试 2】按任务类型过滤平台")
for task_type in ["text_to_image", "image_to_video"]:
    platforms = get_platforms_for_task_type(task_type)
    config = get_task_type_config(task_type)
    print(f"✅ {config.get('label')} ({task_type}): {len(platforms)} 个平台支持")
    for p in platforms:
        print(f"  - {p['display_name']}")
print()

# 测试 3: 获取平台配置
print("【测试 3】获取平台配置")
try:
    config = get_platform_config("runninghub")
    print(f"✅ RunningHub 配置:")
    print(f"  - API 端点: {config['api_endpoint']}")
    print(f"  - 速率限制: {config['rate_limit']} 请求/分钟")
    print(f"  - 超时时间: {config['timeout']} 秒")
    print()
except Exception as e:
    print(f"❌ 获取配置失败: {e}")
    print()

# 测试 4: 获取 API Key
print("【测试 4】获取平台 API Key")
try:
    api_key = get_platform_api_key("runninghub")
    print(f"✅ RunningHub API Key: {api_key[:20]}...")
    print()
except Exception as e:
    print(f"❌ 获取 API Key 失败: {e}")
    print()

# 测试 5: 获取所有任务类型
print("【测试 5】获取所有任务类型")
task_types = get_all_task_types()
print(f"✅ 共 {len(task_types)} 种任务类型:")
for task_type in task_types:
    config = get_task_type_config(task_type)
    print(f"  {config.get('icon')} {config.get('label')} - {config.get('description')}")
print()

# 测试 6: 平台管理器
print("【测试 6】测试平台管理器")
try:
    from services import platform_manager

    print("✅ 平台管理器已加载")
    print(f"  - 已加载适配器: {len(platform_manager.adapters)} 个")

    # 测试平台选择
    for strategy in ["specified", "failover", "priority"]:
        selected = platform_manager.select_platform("text_to_image", strategy, "runninghub")
        print(f"  - {strategy} 策略: {selected}")
    print()

except Exception as e:
    print(f"❌ 平台管理器测试失败: {e}")
    import traceback
    traceback.print_exc()
    print()

print("=" * 60)
print("测试完成！")
print("=" * 60)
