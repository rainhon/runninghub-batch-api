"""
API 路由模块
整合所有版本的 API 路由
"""
from fastapi import APIRouter
from .v1 import missions, api_missions, media, templates, app_missions_v2

# 创建 API 路由器
api_router = APIRouter()

# 包含 v1 版本的所有路由
api_router.include_router(missions.router)
api_router.include_router(api_missions.router)
api_router.include_router(app_missions_v2.router)
api_router.include_router(media.router)
api_router.include_router(templates.router)

__all__ = ['api_router']
