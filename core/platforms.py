"""
平台配置管理模块
统一管理所有 AI 平台的配置信息
"""
from typing import Dict, List, Any


# 平台配置列表
PLATFORMS_CONFIG: List[Dict[str, Any]] = [
    {
        "platform_id": "runninghub",
        "name": "RunningHub",
        "display_name": "RunningHub",
        "enabled": True,
        "priority": 10,
        "supported_task_types": ["text_to_image", "image_to_image", "text_to_video", "image_to_video"],
        "api_key_env": "RUNNINGHUB_DIRECT_API_KEY",  # 环境变量名
        "api_endpoint": "https://www.runninghub.cn/openapi/v2",
        "rate_limit": 60,  # 请求/分钟
        "timeout": 300,   # 秒
        "cost_per_task": 0.0,
        "endpoints": {
            "text_to_image": "/rhart-image-v1/text-to-image",
            "image_to_image": "/rhart-image-v1/image-to-image",
            "text_to_video": "/rhart-video-v1/text-to-video",
            "image_to_video": "/rhart-video-v1/image-to-video"
        }
    }
]


def get_platform_config(platform_id: str) -> Dict[str, Any]:
    """
    获取指定平台的配置

    Args:
        platform_id: 平台 ID

    Returns:
        平台配置字典

    Raises:
        ValueError: 如果平台不存在
    """
    for platform in PLATFORMS_CONFIG:
        if platform["platform_id"] == platform_id:
            return platform
    raise ValueError(f"未找到平台配置: {platform_id}")


def get_enabled_platforms() -> List[Dict[str, Any]]:
    """
    获取所有启用的平台

    Returns:
        启用的平台列表（按优先级排序）
    """
    enabled = [p for p in PLATFORMS_CONFIG if p.get("enabled", False)]
    # 按优先级降序排序
    return sorted(enabled, key=lambda x: x.get("priority", 0), reverse=True)


def get_platforms_for_task_type(task_type: str) -> List[Dict[str, Any]]:
    """
    获取支持指定任务类型的平台（按优先级排序）

    Args:
        task_type: 任务类型 (text_to_image, image_to_image, etc.)

    Returns:
        支持该任务类型的平台列表
    """
    platforms = get_enabled_platforms()
    filtered = [p for p in platforms if task_type in p.get("supported_task_types", [])]
    # 按优先级降序排序
    return sorted(filtered, key=lambda x: x.get("priority", 0), reverse=True)


def get_platform_api_key(platform_id: str) -> str:
    """
    获取平台的 API Key

    Args:
        platform_id: 平台 ID

    Returns:
        API Key 字符串

    Raises:
        ValueError: 如果平台未配置 api_key_env 或环境变量未设置
    """
    import os
    from .config import _get_use_mock_service

    # Mock 模式返回测试 Key
    if _get_use_mock_service():
        return f"mock_{platform_id}_api_key"

    config = get_platform_config(platform_id)
    env_key = config.get("api_key_env")

    if not env_key:
        raise ValueError(f"平台 {platform_id} 未配置 api_key_env")

    api_key = os.getenv(env_key, "")
    if not api_key:
        raise ValueError(f"环境变量 {env_key} 未设置")

    return api_key


def get_platform_endpoint(platform_id: str, task_type: str) -> str:
    """
    获取平台指定任务类型的 API 端点

    Args:
        platform_id: 平台 ID
        task_type: 任务类型

    Returns:
        完整的 API 端点 URL
    """
    config = get_platform_config(platform_id)
    base_endpoint = config.get("api_endpoint", "")
    endpoint_path = config.get("endpoints", {}).get(task_type, "")

    if not endpoint_path:
        raise ValueError(f"平台 {platform_id} 不支持任务类型 {task_type}")

    return f"{base_endpoint}{endpoint_path}"


# 任务类型配置（从 core/config.py 迁移）
TASK_TYPE_CONFIG = {
    "text_to_image": {
        "label": "文生图",
        "icon": "📝",
        "description": "输入文字生成图片",
        "color": "bg-blue-500"
    },
    "image_to_image": {
        "label": "图生图",
        "icon": "🖼️",
        "description": "根据参考图生成新图片",
        "color": "bg-purple-500"
    },
    "text_to_video": {
        "label": "文生视频",
        "icon": "🎬",
        "description": "输入文字生成视频",
        "color": "bg-green-500"
    },
    "image_to_video": {
        "label": "图生视频",
        "icon": "🎞️",
        "description": "根据图片生成视频",
        "color": "bg-orange-500"
    }
}


def get_task_type_config(task_type: str) -> Dict[str, Any]:
    """
    获取任务类型的配置信息

    Args:
        task_type: 任务类型

    Returns:
        任务类型配置字典
    """
    return TASK_TYPE_CONFIG.get(task_type, {})


def get_all_task_types() -> List[str]:
    """
    获取所有支持的任务类型

    Returns:
        任务类型列表
    """
    return list(TASK_TYPE_CONFIG.keys())
