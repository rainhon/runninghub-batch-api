"""
Mock 平台适配器
用于测试和开发环境，模拟平台 API 行为
"""
from typing import Dict, Any, List
import time
import uuid
from .base import BasePlatformAdapter
from utils import get_logger

logger = get_logger(__name__)


class MockAdapter(BasePlatformAdapter):
    """Mock 平台适配器 - 用于测试"""

    def __init__(self, config: Dict[str, Any]):
        """
        初始化 Mock 适配器

        Args:
            config: 配置字典，可包含：
                - task_delay: 任务模拟延迟（秒），默认 3
                - failure_rate: 失败率 0-1，默认 0（不失败）
                - platform_id: 模拟的平台 ID，默认 'mock'
        """
        self.config = config
        self.task_delay = config.get('task_delay', 3)
        self.failure_rate = config.get('failure_rate', 0)
        self.platform_id = config.get('platform_id', 'mock')

        # 模拟任务存储
        self.mock_tasks = {}

        logger.info(f"✅ 初始化 Mock 适配器 (platform={self.platform_id}, delay={self.task_delay}s)")

    def get_supported_task_types(self) -> List[str]:
        """获取支持的任务类型"""
        return ["text_to_image", "image_to_image", "text_to_video", "image_to_video"]

    def normalize_params(self, task_type: str, raw_params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Mock 适配器不需要参数转换
        """
        return raw_params

    def normalize_result(self, raw_result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Mock 适配器不需要结果转换
        """
        return raw_result

    def submit_task(self, task_type: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        提交任务到 Mock 平台

        Args:
            task_type: 任务类型
            params: 任务参数

        Returns:
            提交结果
        """
        # 检查是否应该模拟失败
        import random
        if self.failure_rate > 0 and random.random() < self.failure_rate:
            logger.warning(f"⚠️ Mock 模拟提交失败")
            return {
                "success": False,
                "status": "failed",
                "message": "Mock 模拟的提交失败",
                "raw_response": {}
            }

        # 生成模拟任务 ID
        task_id = f"mock_{self.platform_id}_{uuid.uuid4().hex[:12]}"

        # 存储任务信息
        self.mock_tasks[task_id] = {
            "task_id": task_id,
            "task_type": task_type,
            "params": params,
            "status": "RUNNING",
            "created_at": time.time(),
            "platform_id": self.platform_id
        }

        logger.info(f"📤 Mock 提交任务: {task_type} -> {task_id}")

        return {
            "success": True,
            "task_id": task_id,
            "status": "submitted",
            "message": "Mock 任务提交成功",
            "raw_response": {
                "code": 200,
                "taskId": task_id
            }
        }

    def query_task(self, task_id: str) -> Dict[str, Any]:
        """
        查询 Mock 任务状态

        Args:
            task_id: 任务 ID

        Returns:
            查询结果
        """
        # 检查任务是否存在
        if task_id not in self.mock_tasks:
            logger.error(f"❌ Mock 任务不存在: {task_id}")
            return {
                "success": False,
                "status": "FAILED",
                "error": f"任务不存在: {task_id}",
                "raw_response": {}
            }

        task = self.mock_tasks[task_id]
        elapsed = time.time() - task["created_at"]

        # 模拟任务进度
        if elapsed >= self.task_delay:
            # 任务完成
            task["status"] = "SUCCESS"

            # 生成模拟结果
            mock_result_url = f"mock_result://{self.platform_id}/{task_id}.png"
            if "video" in task["task_type"]:
                mock_result_url = f"mock_result://{self.platform_id}/{task_id}.mp4"

            return {
                "success": True,
                "status": "SUCCESS",
                "results": [{
                    "url": mock_result_url,
                    "type": task["task_type"]
                }],
                "raw_response": {
                    "code": 200,
                    "status": "SUCCESS",
                    "results": [{
                        "url": mock_result_url,
                        "type": task["task_type"]
                    }]
                }
            }
        else:
            # 任务还在运行
            progress = int(elapsed / self.task_delay * 100)
            logger.debug(f"🔍 Mock 任务运行中: {task_id} ({progress}%)")

            return {
                "success": True,
                "status": "RUNNING",
                "results": [],
                "raw_response": {
                    "code": 200,
                    "status": "RUNNING",
                    "results": []
                }
            }

    def reset(self):
        """重置 Mock 适配器，清除所有任务"""
        self.mock_tasks.clear()
        logger.info(f"🔄 Mock 适配器已重置")
