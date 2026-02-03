"""
平台管理 API
提供平台列表查询接口
"""
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import List, Optional
from core import get_platforms_for_task_type, get_enabled_platforms, TASK_TYPE_CONFIG

router = APIRouter(prefix="/platforms", tags=["平台管理"])


class PlatformInfo(BaseModel):
    """平台信息模型"""
    platform_id: str
    name: str
    display_name: str
    enabled: bool
    priority: int
    supported_task_types: List[str]
    rate_limit: int
    timeout: int
    cost_per_task: Optional[float] = None


@router.get("")
async def get_platforms(
    task_type: Optional[str] = Query(None, description="按任务类型过滤平台")
):
    """
    获取平台列表

    Args:
        task_type: 可选，按任务类型过滤（text_to_image, image_to_image, etc.）

    Returns:
        平台列表
    """
    try:
        if task_type:
            platforms = get_platforms_for_task_type(task_type)
        else:
            platforms = get_enabled_platforms()

        data = [
            {
                "platform_id": p['platform_id'],
                "name": p['name'],
                "display_name": p['display_name'],
                "enabled": p.get('enabled', False),
                "priority": p.get('priority', 0),
                "supported_task_types": p.get('supported_task_types', []),
                "rate_limit": p.get('rate_limit', 60),
                "timeout": p.get('timeout', 300),
                "cost_per_task": p.get('cost_per_task')
            }
            for p in platforms
        ]

        return {
            "code": 0,
            "data": data,
            "msg": "获取平台列表成功"
        }
    except Exception as e:
        return {
            "code": 500,
            "data": [],
            "msg": f"获取平台列表失败: {str(e)}"
        }


@router.get("/task-types")
async def get_task_types():
    """
    获取所有任务类型

    Returns:
        任务类型列表及其配置
    """
    try:
        data = [
            {
                "type": task_type,
                "label": config.get("label"),
                "icon": config.get("icon"),
                "description": config.get("description"),
                "color": config.get("color")
            }
            for task_type, config in TASK_TYPE_CONFIG.items()
        ]

        return {
            "code": 0,
            "data": data,
            "msg": "获取任务类型成功"
        }
    except Exception as e:
        return {
            "code": 500,
            "data": [],
            "msg": f"获取任务类型失败: {str(e)}"
        }
