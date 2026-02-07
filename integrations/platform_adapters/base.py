"""
平台适配器基类
定义所有平台适配器必须实现的接口
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, List


class BasePlatformAdapter(ABC):
    """平台适配器基类"""

    def __init__(self, config: Dict[str, Any]):
        """
        初始化适配器

        Args:
            config: 平台配置字典
                - platform_id: 平台 ID
                - api_key: API 密钥
                - api_endpoint: API 端点
                - timeout: 超时时间（秒）
                - rate_limit: 速率限制（请求/分钟）
        """
        self.config = config
        self.platform_id = config.get('platform_id')
        self.api_key = config.get('api_key')
        self.api_endpoint = config.get('api_endpoint')
        self.timeout = config.get('timeout', 300)
        self.rate_limit = config.get('rate_limit', 60)

    @abstractmethod
    def get_supported_task_types(self) -> List[str]:
        """
        获取支持的任务类型列表

        Returns:
            任务类型列表，如 ["text_to_image", "image_to_image"]
        """
        pass

    @abstractmethod
    def submit_task(self, task_type: str, params: Dict[str, Any], model_id: str) -> Dict[str, Any]:
        """
        提交任务到平台

        Args:
            task_type: 任务类型
            params: 任务参数（标准化格式）
            model_id: 模型 ID（必需，用于根据模型选择不同端点）

        Returns:
            提交结果字典：
            {
                "success": True/False,
                "task_id": "平台任务ID",
                "status": "submitted/running/failed",
                "message": "提示信息",
                "raw_response": {...}  # 原始响应
            }
        """
        pass

    @abstractmethod
    def query_task(self, task_id: str) -> Dict[str, Any]:
        """
        查询任务状态

        Args:
            task_id: 平台任务 ID

        Returns:
            查询结果字典：
            {
                "success": True/False,
                "status": "pending/running/success/failed",
                "result": {...},  # 任务结果
                "error": "错误信息"
            }
        """
        pass

    @abstractmethod
    def normalize_params(self, task_type: str, raw_params: Dict[str, Any]) -> Dict[str, Any]:
        """
        将标准化参数转换为平台特定格式

        Args:
            task_type: 任务类型
            raw_params: 标准化参数

        Returns:
            平台特定格式的参数
        """
        pass

    @abstractmethod
    def normalize_result(self, raw_result: Dict[str, Any]) -> Dict[str, Any]:
        """
        将平台结果转换为标准格式

        Args:
            raw_result: 平台原始结果

        Returns:
            标准格式结果：
            {
                "task_id": "任务ID",
                "status": "状态",
                "result_url": "结果URL",
                "preview_url": "预览URL",
                "metadata": {...},
                "error": "错误信息"
            }
        """
        pass

    def check_health(self) -> bool:
        """
        健康检查

        Returns:
            True if platform is healthy, False otherwise
        """
        try:
            # 简单的健康检查 - 子类可以重写实现更复杂的检查
            return self.api_key is not None and len(self.api_key) > 0
        except Exception:
            return False

    def get_platform_info(self) -> Dict[str, Any]:
        """
        获取平台信息

        Returns:
            平台信息字典
        """
        return {
            "platform_id": self.platform_id,
            "api_endpoint": self.api_endpoint,
            "timeout": self.timeout,
            "rate_limit": self.rate_limit,
            "supported_task_types": self.get_supported_task_types()
        }
