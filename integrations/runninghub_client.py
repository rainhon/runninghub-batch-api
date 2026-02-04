"""
RunningHub API 客户端
只处理真实的 RunningHub API 调用
"""
import requests
from typing import Dict, Any
from core import get_api_key
from utils import get_logger

logger = get_logger(__name__)


# RunningHub API 端点配置
RUNNINGHUB_API_BASE = "https://www.runninghub.cn/openapi/v2"
QUERY_API_URL = f"{RUNNINGHUB_API_BASE}/query"


def submit_task(task_type: str, params: Dict[str, Any], api_url: str) -> Dict[str, Any]:
    """
    提交任务到 RunningHub API

    Args:
        task_type: 任务类型
        params: 任务参数
        api_url: API 端点 URL

    Returns:
        API 响应结果
    """
    try:
        # API 任务使用 "direct" 类型的 key
        api_key = get_api_key(task_type="direct")

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }

        logger.info(f"📤 提交到 RunningHub API: {task_type}")
        logger.debug(f"   URL: {api_url}")
        logger.debug(f"   参数: {params}")

        response = requests.post(api_url, headers=headers, json=params, timeout=30)

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


def query_task(task_id: str) -> Dict[str, Any]:
    """
    查询任务状态

    Args:
        task_id: 任务 ID

    Returns:
        API 响应结果
    """
    try:
        # API 任务使用 "direct" 类型的 key
        api_key = get_api_key(task_type="direct")

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }

        logger.debug(f"🔍 查询任务: {task_id}")

        response = requests.post(
            QUERY_API_URL,
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
