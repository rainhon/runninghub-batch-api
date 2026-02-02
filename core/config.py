"""
配置管理模块
统一管理所有配置项
"""
import os
from typing import Dict
from pathlib import Path

# 项目根目录
BASE_DIR = Path(__file__).resolve().parent.parent

# 数据库配置
DB_FILE_PATH = BASE_DIR / "runninghub.db"

# 上传目录配置
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# RunningHub API 配置
# App 任务专用 API Key（用于调用 AI 应用）
RUNNINGHUB_APP_TASK_KEY = os.getenv("RUNNINGHUB_APP_TASK_KEY", "")

# 直接 API 任务专用 API Key（用于直接 API 调用）
RUNNINGHUB_DIRECT_API_KEY = os.getenv("RUNNINGHUB_DIRECT_API_KEY", "")

# 兼容旧配置（如果新的未设置，尝试使用旧的）
if not RUNNINGHUB_APP_TASK_KEY:
    RUNNINGHUB_APP_TASK_KEY = os.getenv("RUNNINGHUB_API_KEY", "")
if not RUNNINGHUB_DIRECT_API_KEY:
    RUNNINGHUB_DIRECT_API_KEY = os.getenv("RUNNINGHUB_API_KEY", "")

RUNNINGHUB_BASE_URL = "https://www.runninghub.cn"


def _get_use_mock_service() -> bool:
    """动态获取是否使用 Mock 服务"""
    return os.getenv("USE_MOCK_SERVICE", "false").lower() == "true"


# 为了向后兼容,保留这个变量,但改为函数调用
USE_MOCK_SERVICE = _get_use_mock_service()

# App 任务配置
MAX_CONCURRENT_APP_TASKS = 2
MAX_APP_RETRIES = 5
POLL_INTERVAL = 5  # 轮询间隔（秒）

# API 任务配置
MAX_CONCURRENT_API_TASKS = 50
API_POLL_INTERVAL = 5  # API 任务轮询间隔（秒）
API_MAX_POLLS = 120  # API 任务最多轮询次数（10分钟）

# API 任务类型配置
API_TASK_TYPES: Dict[str, Dict] = {
    "text_to_image": {
        "url": f"{RUNNINGHUB_BASE_URL}/openapi/v2/rhart-image-v1/text-to-image",
        "required_fields": ["prompt"],
        "optional_fields": ["aspectRatio"],
        "name": "文生图"
    },
    "image_to_image": {
        "url": f"{RUNNINGHUB_BASE_URL}/openapi/v2/rhart-image-v1/edit",
        "required_fields": ["imageUrls", "prompt"],
        "optional_fields": ["aspectRatio"],
        "name": "图生图"
    },
    "text_to_video": {
        "url": f"{RUNNINGHUB_BASE_URL}/openapi/v2/rhart-video-s/text-to-video",
        "required_fields": ["prompt"],
        "optional_fields": ["duration", "aspectRatio"],
        "name": "文生视频"
    },
    "image_to_video": {
        "url": f"{RUNNINGHUB_BASE_URL}/openapi/v2/rhart-video-s/image-to-video",
        "required_fields": ["imageUrl", "prompt"],
        "optional_fields": ["duration", "aspectRatio"],
        "name": "图生视频"
    }
}

# 分页配置
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100

# 文件上传配置
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]


def get_api_key(task_type: str = "app") -> str:
    """
    获取 RunningHub API Key

    Args:
        task_type: 任务类型
            - "app": App 任务（调用 AI 应用）
            - "direct": 直接 API 任务

    Returns:
        API Key 字符串

    Note:
        在 Mock 模式下（USE_MOCK_SERVICE=true），会返回一个模拟的 API Key
    """
    # 动态检查 Mock 模式
    if _get_use_mock_service():
        return "mock_api_key_for_testing"

    if task_type == "app":
        if not RUNNINGHUB_APP_TASK_KEY:
            raise ValueError("RUNNINGHUB_APP_TASK_KEY 环境变量未设置")
        return RUNNINGHUB_APP_TASK_KEY
    elif task_type == "direct":
        if not RUNNINGHUB_DIRECT_API_KEY:
            raise ValueError("RUNNINGHUB_DIRECT_API_KEY 环境变量未设置")
        return RUNNINGHUB_DIRECT_API_KEY
    else:
        raise ValueError(f"不支持的 task_type: {task_type}")


def validate_config() -> None:
    """验证配置是否完整"""
    errors = []

    if not RUNNINGHUB_APP_TASK_KEY:
        errors.append("RUNNINGHUB_APP_TASK_KEY 未配置")

    if not RUNNINGHUB_DIRECT_API_KEY:
        errors.append("RUNNINGHUB_DIRECT_API_KEY 未配置")

    if errors:
        raise ValueError(f"配置验证失败: {', '.join(errors)}")
