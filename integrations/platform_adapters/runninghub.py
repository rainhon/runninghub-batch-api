"""
RunningHub 平台适配器
将 RunningHub API 封装为统一的平台适配器接口
"""
from typing import Dict, Any, List
from .base import BasePlatformAdapter
from utils import get_logger

logger = get_logger(__name__)


class RunningHubAdapter(BasePlatformAdapter):
    """RunningHub 平台适配器"""

    def get_supported_task_types(self) -> List[str]:
        """获取支持的任务类型"""
        return ["text_to_image", "image_to_image", "text_to_video", "image_to_video"]

    def normalize_params(self, task_type: str, raw_params: Dict[str, Any]) -> Dict[str, Any]:
        """
        将标准化参数转换为 RunningHub 格式

        RunningHub 的 API 已经使用标准化格式，直接返回
        """
        return raw_params

    def normalize_result(self, raw_result: Dict[str, Any]) -> Dict[str, Any]:
        """
        将 RunningHub 结果转换为标准格式

        Args:
            raw_result: RunningHub API 原始响应

        Returns:
            标准格式结果
        """
        # RunningHub API 响应格式：
        # {
        #     "code": 200,
        #     "taskId": "xxx",
        #     "status": "SUCCESS",
        #     "data": {
        #         "fileUrl": "xxx",
        #         "previewUrl": "xxx",
        #         "metadata": {...}
        #     }
        # }

        return {
            "task_id": raw_result.get("taskId"),
            "status": raw_result.get("status"),
            "result_url": raw_result.get("data", {}).get("fileUrl"),
            "preview_url": raw_result.get("data", {}).get("previewUrl"),
            "metadata": raw_result.get("data", {}).get("metadata", {}),
            "error": raw_result.get("message") if raw_result.get("code") != 200 else None,
            "raw_response": raw_result
        }

    def submit_task(self, task_type: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        提交任务到 RunningHub

        Args:
            task_type: 任务类型
            params: 任务参数

        Returns:
            提交结果
        """
        from integrations.runninghub_client import submit_task
        from core import API_TASK_TYPES

        if task_type not in self.get_supported_task_types():
            return {
                "success": False,
                "status": "failed",
                "message": f"不支持的任务类型: {task_type}",
                "raw_response": {}
            }

        # 获取 API URL
        if task_type not in API_TASK_TYPES:
            return {
                "success": False,
                "status": "failed",
                "message": f"未配置任务类型: {task_type}",
                "raw_response": {}
            }

        api_url = API_TASK_TYPES[task_type]["url"]

        # 调用 RunningHub API 客户端
        response = submit_task(task_type, params, api_url)

        # RunningHub API 返回格式:
        # {
        #     "taskId": "xxx",
        #     "status": "RUNNING",
        #     "errorCode": "",
        #     "errorMessage": "",
        #     "results": null,
        #     "clientId": "xxx",
        #     "promptTips": "{...}"
        # }

        # 检查是否有错误码
        error_code = response.get("errorCode", "")
        error_message = response.get("errorMessage", "")
        task_id = response.get("taskId")

        if task_id and not error_code:
            return {
                "success": True,
                "task_id": task_id,
                "status": response.get("status", "submitted").lower(),
                "message": "任务提交成功",
                "raw_response": response
            }
        else:
            return {
                "success": False,
                "status": "failed",
                "message": error_message or "提交失败",
                "raw_response": response
            }

    def query_task(self, task_id: str) -> Dict[str, Any]:
        """
        查询 RunningHub 任务状态

        Args:
            task_id: 任务 ID

        Returns:
            查询结果（直接返回原始响应的 status 和 results）
        """
        from integrations.runninghub_client import query_task

        response = query_task(task_id)

        # RunningHub API 返回格式:
        # {
        #     "taskId": "xxx",
        #     "status": "RUNNING" | "SUCCESS" | "FAILED",
        #     "errorCode": "",
        #     "errorMessage": "",
        #     "failedReason": {},
        #     "usage": {...},
        #     "results": [
        #         {
        #             "url": "xxx",
        #             "outputType": "png",
        #             "text": null
        #         }
        #     ] or null,
        #     "clientId": "xxx",
        #     "promptTips": ""
        # }

        # 检查是否有错误码
        error_code = response.get("errorCode", "")
        error_message = response.get("errorMessage", "")
        failed_reason = response.get("failedReason", {})

        if error_code or failed_reason:
            return {
                "success": False,
                "status": "FAILED",
                "error": error_message or str(failed_reason) or "查询失败",
                "raw_response": response
            }

        # 转换状态为统一格式
        status = response.get("status", "UNKNOWN").upper()
        results = response.get("results", [])

        # 提取结果URL列表
        result_urls = []
        if results:
            for result in results:
                if isinstance(result, dict):
                    url = result.get("url")
                    if url:
                        result_urls.append(url)

        return {
            "success": True,
            "status": status,
            "results": result_urls,
            "raw_response": response
        }
