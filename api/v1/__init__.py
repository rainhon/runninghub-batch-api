"""
API v1 版本路由
"""
from fastapi import APIRouter
from . import missions, api_missions, media, templates, platforms, app_missions_v2

# 创建 v1 路由器
v1_router = APIRouter(prefix="/v1")

# 包含所有子路由
v1_router.include_router(missions.router)
v1_router.include_router(api_missions.router)
v1_router.include_router(app_missions_v2.router)
v1_router.include_router(media.router)
v1_router.include_router(templates.router)
v1_router.include_router(platforms.router)

__all__ = ['v1_router', 'missions', 'api_missions', 'app_missions_v2', 'media', 'templates', 'platforms']
