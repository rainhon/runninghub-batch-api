"""
模型配置模块
定义 AI 模型及其能力
平台无关的模型定义，具体 API 实现由平台适配器处理
"""
from typing import Dict, List, Any

# 模型配置列表
MODELS_CONFIG: List[Dict[str, Any]] = [
    {
        "model_id": "sora",
        "name": "Sora",
        "display_name": "Sora",
        "description": "OpenAI 的视频生成模型",
        "enabled": True,
        "priority": 10,
        "capabilities": {
            "image_to_video": {
                "enabled": True,
                "supported_aspect_ratios": ["16:9", "9:16"],
                "duration_options": [10, 15],
                "required_params": ["imageUrl", "prompt"],
                "optional_params": ["duration", "aspectRatio"]
            },
            "text_to_video": {
                "enabled": True,
                "supported_aspect_ratios": ["16:9", "9:16"],
                "duration_options": [10, 15],
                "required_params": ["prompt"],
                "optional_params": ["duration", "aspectRatio"]
            }
        },
        "rate_limit": 60,
        "timeout": 600
    },
    {
        "model_id": "sorapro",
        "name": "Sora Pro",
        "display_name": "Sora Pro",
        "description": "OpenAI Sora 的专业版本",
        "enabled": True,
        "priority": 9,
        "capabilities": {
            "image_to_video": {
                "enabled": True,
                "supported_aspect_ratios": ["16:9", "9:16"],
                "duration_options": [15, 25],
                "required_params": ["imageUrl", "prompt"],
                "optional_params": ["duration", "aspectRatio"]
            },
            "text_to_video": {
                "enabled": True,
                "supported_aspect_ratios": ["16:9", "9:16"],
                "duration_options": [15, 25],
                "required_params": ["prompt"],
                "optional_params": ["duration", "aspectRatio"]
            }
        },
        "rate_limit": 100,
        "timeout": 900
    },
    {
        "model_id": "banana",
        "name": "Banana",
        "display_name": "Banana",
        "description": "NanoBanana",
        "enabled": False,
        "priority": 8,
        "capabilities": {
            "image_to_image": {
                "enabled": True,
                "supported_aspect_ratios": ["16:9", "9:16"],
                "required_params": ["imageUrls", "prompt"],
                "optional_params": ["aspectRatio"]
            },
            "text_to_image": {
                "enabled": True,
                "supported_aspect_ratios": ["16:9", "9:16"],
                "required_params": ["prompt"],
                "optional_params": ["aspectRatio"]
            }
        },
        "rate_limit": 60,
        "timeout": 300
    },
    {
        "model_id": "veo",
        "name": "Veo",
        "display_name": "Veo",
        "description": "Google 的视频生成模型",
        "enabled": False,
        "priority": 7,
        "capabilities": {
            "text_to_image": {
                "enabled": True,
                "supported_aspect_ratios": ["16:9", "9:16", "1:1", "4:3", "3:4"],
                "required_params": ["prompt"],
                "optional_params": ["aspectRatio"]
            },
            "image_to_video": {
                "enabled": True,
                "supported_aspect_ratios": ["16:9", "9:16", "1:1"],
                "duration_options": [5, 10, 15],
                "required_params": ["imageUrl", "prompt"],
                "optional_params": ["duration", "aspectRatio"]
            },
            "text_to_video": {
                "enabled": True,
                "supported_aspect_ratios": ["16:9", "9:16", "1:1"],
                "duration_options": [5, 10, 15],
                "required_params": ["prompt"],
                "optional_params": ["duration", "aspectRatio"]
            },
            "frame_to_video": {
                "enabled": True,
                "supported_aspect_ratios": ["16:9", "9:16", "1:1"],
                "duration_options": [5, 10, 15],
                "required_params": ["imageUrl", "endImageUrl", "prompt"],
                "optional_params": ["duration", "aspectRatio"],
                "description": "首尾帧生视频"
            }
        },
        "rate_limit": 50,
        "timeout": 600
    },
    {
        "model_id": "veopro",
        "name": "Veo Pro",
        "display_name": "Veo Pro",
        "description": "Google Veo 的专业版本",
        "enabled": False,
        "priority": 6,
        "capabilities": {
            "text_to_video": {
                "enabled": True,
                "supported_aspect_ratios": ["16:9", "9:16", "1:1", "4:3", "3:4"],
                "duration_options": [5, 10, 15, 20, 25, 30, 60],
                "required_params": ["prompt"],
                "optional_params": ["duration", "aspectRatio"]
            },
            "frame_to_video": {
                "enabled": True,
                "supported_aspect_ratios": ["16:9", "9:16", "1:1", "4:3", "3:4"],
                "duration_options": [5, 10, 15, 20, 25, 30, 60],
                "required_params": ["imageUrl", "endImageUrl", "prompt"],
                "optional_params": ["duration", "aspectRatio"],
                "description": "首尾帧生视频"
            }
        },
        "rate_limit": 80,
        "timeout": 900
    }
]


def get_model_config(model_id: str) -> Dict[str, Any]:
    """
    获取指定模型的配置

    Args:
        model_id: 模型 ID

    Returns:
        模型配置字典

    Raises:
        ValueError: 如果模型不存在
    """
    for model in MODELS_CONFIG:
        if model["model_id"] == model_id:
            return model
    raise ValueError(f"未找到模型配置: {model_id}")


def get_enabled_models() -> List[Dict[str, Any]]:
    """
    获取所有启用的模型（按优先级排序）

    Returns:
        启用的模型列表
    """
    enabled = [m for m in MODELS_CONFIG if m.get("enabled", False)]
    # 按优先级降序排序
    return sorted(enabled, key=lambda x: x.get("priority", 0), reverse=True)


def get_model_capabilities(model_id: str) -> Dict[str, Any]:
    """
    获取模型的能力配置

    Args:
        model_id: 模型 ID

    Returns:
        能力配置字典
    """
    config = get_model_config(model_id)
    return config.get("capabilities", {})


def get_task_types_for_model(model_id: str) -> List[str]:
    """
    获取模型支持的任务类型列表

    Args:
        model_id: 模型 ID

    Returns:
        支持的任务类型列表
    """
    capabilities = get_model_capabilities(model_id)
    return [task_type for task_type, config in capabilities.items()
            if config.get("enabled", False)]


def is_task_type_supported(model_id: str, task_type: str) -> bool:
    """
    检查模型是否支持指定任务类型

    Args:
        model_id: 模型 ID
        task_type: 任务类型

    Returns:
        是否支持
    """
    capabilities = get_model_capabilities(model_id)
    task_config = capabilities.get(task_type, {})
    return task_config.get("enabled", False)


def get_capability_config(model_id: str, task_type: str) -> Dict[str, Any]:
    """
    获取模型指定任务类型的详细能力配置

    Args:
        model_id: 模型 ID
        task_type: 任务类型

    Returns:
        能力配置字典

    Raises:
        ValueError: 如果模型不支持该任务类型
    """
    if not is_task_type_supported(model_id, task_type):
        raise ValueError(f"模型 {model_id} 不支持任务类型 {task_type}")

    capabilities = get_model_capabilities(model_id)
    return capabilities[task_type]


def get_all_model_ids() -> List[str]:
    """
    获取所有模型 ID

    Returns:
        模型 ID 列表
    """
    return [m["model_id"] for m in MODELS_CONFIG]
