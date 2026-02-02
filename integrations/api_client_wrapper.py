"""
API 客户端包装器
根据配置自动选择使用真实 API 或 Mock API
"""
import os
import requests
from typing import Dict, Any
from core import USE_MOCK_SERVICE, get_api_key
from utils import get_logger

logger = get_logger(__name__)


def submit_api_task(task_type: str, payload: Dict[str, Any], api_url: str) -> Dict[str, Any]:
    """
    提交 API 任务（自动选择真实 API 或 Mock）

    Args:
        task_type: 任务类型
        payload: 任务参数
        api_url: API 地址

    Returns:
        提交结果
    """
    if USE_MOCK_SERVICE:
        logger.info(f"🔶 使用 Mock 服务提交任务: {task_type}")
        from integrations.mock_api_client import submit_mock_task
        return submit_mock_task(task_type, payload)
    else:
        logger.info(f"🌐 使用真实 API 提交任务: {task_type}")
        return _submit_real_task(api_url, payload)


def query_api_task(task_id: str) -> Dict[str, Any]:
    """
    查询 API 任务状态（自动选择真实 API 或 Mock）

    Args:
        task_id: 任务ID

    Returns:
        任务状态和结果
    """
    if USE_MOCK_SERVICE:
        logger.info(f"🔶 使用 Mock 服务查询任务: {task_id}")
        from integrations.mock_api_client import query_mock_task
        return query_mock_task(task_id)
    else:
        logger.info(f"🌐 使用真实 API 查询任务: {task_id}")
        return _query_real_task(task_id)


def _submit_real_task(api_url: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """调用真实 API 提交任务"""
    try:
        # API 任务使用 "direct" 类型的 key
        api_key = get_api_key(task_type="direct")

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }

        logger.info(f"📤 提交到真实 API (使用 Direct API Key): {api_url}")
        logger.debug(f"   参数: {payload}")

        response = requests.post(api_url, headers=headers, json=payload, timeout=30)

        if response.status_code == 200:
            result = response.json()
            logger.info(f"✅ 提交成功: task_id={result.get('taskId')}")
            return result
        else:
            error_msg = f"提交失败: {response.status_code}, {response.text}"
            logger.error(error_msg)
            return {
                "code": response.status_code,
                "message": error_msg
            }

    except Exception as e:
        logger.error(f"❌ 提交任务异常: {str(e)}")
        return {
            "code": 500,
            "message": f"提交异常: {str(e)}"
        }


def _query_real_task(task_id: str) -> Dict[str, Any]:
    """调用真实 API 查询任务"""
    try:
        # API 任务使用 "direct" 类型的 key
        api_key = get_api_key(task_type="direct")

        query_url = "https://www.runninghub.cn/openapi/v2/query"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }

        response = requests.post(
            query_url,
            headers=headers,
            json={"taskId": task_id},
            timeout=30
        )

        if response.status_code == 200:
            result = response.json()
            logger.debug(f"   查询结果: status={result.get('status')}")
            return result
        else:
            error_msg = f"查询失败: {response.status_code}, {response.text}"
            logger.error(error_msg)
            return {
                "code": response.status_code,
                "message": error_msg
            }

    except Exception as e:
        logger.error(f"❌ 查询任务异常: {str(e)}")
        return {
            "code": 500,
            "message": f"查询异常: {str(e)}"
        }


def get_api_mode() -> str:
    """获取当前 API 模式"""
    return "Mock" if USE_MOCK_SERVICE else "Real"


if __name__ == "__main__":
    # 测试代码
    print(f"=== API 客户端包装器测试 ===")
    print(f"当前模式: {get_api_mode()} API\n")

    if USE_MOCK_SERVICE:
        print("测试 Mock 服务:")
        result = submit_api_task("text_to_image", {
            "prompt": "a beautiful sunset",
            "aspectRatio": "16:9"
        }, "https://mock.url")

        print(f"提交结果: {result}")

        if result.get("code") == 200:
            task_id = result.get("taskId")
            print(f"\n轮询查询任务 {task_id}:")

            import time
            for i in range(10):
                time.sleep(2)
                status = query_api_task(task_id)
                print(f"  第{i+1}次: {status.get('status')} - {status.get('message')}")

                if status.get("status") in ["SUCCESS", "FAILED"]:
                    break
    else:
        print("⚠️ 真实 API 模式需要配置 RUNNINGHUB_API_KEY")
