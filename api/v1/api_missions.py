"""
API 任务管理路由
v1 版本
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, Dict
import os
import uuid
from pathlib import Path

import repositories as database
from services import api_task_service
from core import UPLOAD_DIR, ALLOWED_IMAGE_TYPES, MAX_UPLOAD_SIZE
from utils import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api_missions", tags=["API 任务管理"])


# ========== 请求/响应模型 ==========

class CreateApiMissionRequest(BaseModel):
    """创建 API 任务请求"""
    name: str
    description: Optional[str] = None
    task_type: str  # text_to_image, image_to_image, text_to_video, image_to_video
    config: Dict  # 包含 fixed_config 和 batch_input
    scheduled_time: Optional[str] = None  # 定时执行时间（ISO 格式字符串）


class SaveTemplateRequest(BaseModel):
    """保存模板请求"""
    name: str
    description: Optional[str] = None
    task_type: str
    config: Dict


# ========== API 任务管理接口 ==========

@router.post("/submit")
async def create_api_mission(request: CreateApiMissionRequest):
    """创建 API 任务"""
    try:
        # 创建任务（支持定时执行）
        mission_id = api_task_service.create_mission(
            name=request.name,
            description=request.description,
            task_type=request.task_type,
            config=request.config,
            scheduled_time=request.scheduled_time
        )

        mission = database.execute_sql(
            "SELECT total_count, status, scheduled_time FROM api_missions WHERE id = ?",
            (mission_id,),
            fetch_one=True
        )

        return {
            "code": 0,
            "data": {
                "mission_id": mission_id,
                "total_count": mission['total_count'],
                "status": mission['status'],
                "scheduled_time": mission.get('scheduled_time')
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"创建任务失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"创建任务失败: {str(e)}")


@router.get("")
async def get_api_missions(page: int = 1, page_size: int = 20, status: Optional[str] = None):
    """获取 API 任务列表"""
    try:
        result = database.get_api_mission_list(page, page_size, status)
        return {
            "code": 0,
            "data": result
        }
    except Exception as e:
        logger.error(f"获取任务列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取任务列表失败: {str(e)}")


@router.get("/{api_mission_id}")
async def get_api_mission_detail(api_mission_id: int):
    """获取 API 任务详情"""
    try:
        mission = database.get_api_mission_detail(api_mission_id)
        if not mission:
            raise HTTPException(status_code=404, detail="任务不存在")
        return {
            "code": 0,
            "data": mission
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取任务详情失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取任务详情失败: {str(e)}")


@router.get("/{api_mission_id}/items")
async def get_api_mission_items(api_mission_id: int):
    """获取 API 任务的子任务列表"""
    try:
        items = database.execute_sql(
            "SELECT * FROM api_mission_items WHERE api_mission_id = ? ORDER BY item_index",
            (api_mission_id,),
            fetch_all=True
        )
        return {
            "code": 0,
            "data": items
        }
    except Exception as e:
        logger.error(f"获取子任务列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取子任务列表失败: {str(e)}")


@router.post("/{api_mission_id}/cancel")
async def cancel_api_mission(api_mission_id: int):
    """取消 API 任务（包括定时任务）"""
    try:
        # 获取任务当前状态
        mission = database.execute_sql(
            "SELECT status FROM api_missions WHERE id = ?",
            (api_mission_id,),
            fetch_one=True
        )

        if not mission:
            raise HTTPException(status_code=404, detail="任务不存在")

        # 如果是定时任务，直接标记为取消
        if mission['status'] == 'scheduled':
            database.execute_sql(
                "UPDATE api_missions SET status = 'cancelled' WHERE id = ?",
                (api_mission_id,)
            )
            return {
                "code": 0,
                "data": {"cancelled": True, "was_scheduled": True}
            }

        # 其他状态的任务按原有逻辑处理
        cancelled_count = database.cancel_api_mission(api_mission_id)
        return {
            "code": 0,
            "data": {
                "cancelled_count": cancelled_count,
                "was_scheduled": False
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"取消任务失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"取消任务失败: {str(e)}")


@router.post("/{api_mission_id}/retry")
async def retry_api_mission(api_mission_id: int):
    """重试失败的 API 任务子项"""
    try:
        retry_count = database.retry_api_mission(api_mission_id)
        api_task_service.add_to_queue(api_mission_id)

        return {
            "code": 0,
            "data": {
                "retry_count": retry_count
            }
        }
    except Exception as e:
        logger.error(f"重试任务失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"重试任务失败: {str(e)}")


@router.delete("/{api_mission_id}")
async def delete_api_mission(api_mission_id: int):
    """删除 API 任务"""
    try:
        database.execute_sql(
            "DELETE FROM api_missions WHERE id = ?",
            (api_mission_id,)
        )
        return {
            "code": 0,
            "data": {"deleted": True}
        }
    except Exception as e:
        logger.error(f"删除任务失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除任务失败: {str(e)}")


@router.get("/{api_mission_id}/download")
async def download_api_mission_results(api_mission_id: int):
    """批量下载 API 任务结果（返回 ZIP 文件）"""
    try:
        import zipfile
        import io

        mission = database.execute_sql(
            "SELECT name FROM api_missions WHERE id = ?",
            (api_mission_id,),
            fetch_one=True
        )

        if not mission:
            raise HTTPException(status_code=404, detail="任务不存在")

        items = database.execute_sql(
            "SELECT result_url FROM api_mission_items WHERE api_mission_id = ? AND status = 'completed' AND result_url IS NOT NULL",
            (api_mission_id,),
            fetch_all=True
        )

        if not items:
            raise HTTPException(status_code=404, detail="没有可下载的结果")

        zip_buffer = io.BytesIO()
        mission_name = mission['name'].replace(" ", "_").replace("/", "_")

        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for idx, item in enumerate(items, 1):
                url = item['result_url']
                filename = f"{mission_name}_result_{idx}.png"
                zip_file.writestr(filename, f"URL: {url}")

        zip_buffer.seek(0)

        from fastapi.responses import Response
        return Response(
            content=zip_buffer.getvalue(),
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename={mission_name}_results.zip"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"下载结果失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"下载结果失败: {str(e)}")


# ========== 图片上传接口 ==========

@router.post("/images/upload")
async def upload_image(request: Request, file: UploadFile = File(...)):
    """上传图片到本地，返回可访问的 URL"""
    try:
        # 验证文件类型
        if not file.content_type or file.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail=f"只支持上传图片文件: {', '.join(ALLOWED_IMAGE_TYPES)}")

        # 验证文件大小
        content = await file.read()
        if len(content) > MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=400, detail=f"文件大小超过限制 ({MAX_UPLOAD_SIZE / 1024 / 1024}MB)")

        # 生成唯一文件名
        file_ext = os.path.splitext(file.filename)[1] if file.filename else ".png"
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = UPLOAD_DIR / unique_filename

        # 保存文件
        with open(file_path, "wb") as buffer:
            buffer.write(content)

        # 动态获取服务器 host 和 port
        # 优先使用请求头中的 host，如果没有则使用 X-Forwarded-Host（代理场景）
        host = request.headers.get("host", "")
        if not host:
            # 尝试从 X-Forwarded-Host 获取（反向代理场景）
            host = request.headers.get("x-forwarded-host", "localhost:7777")

        # 确定协议（http 或 https）
        # 检查 X-Forwarded-Proto 请求头（反向代理会设置）
        scheme = request.headers.get("x-forwarded-proto", "")
        if not scheme:
            # 使用请求的 URL scheme
            scheme = request.url.scheme

        # 返回访问 URL（完整路径，包含 /api/v1/api_missions 前缀）
        file_url = f"{scheme}://{host}/api/v1/api_missions/images/{unique_filename}"

        logger.info(f"✅ 图片上传成功: {unique_filename} ({len(content)} bytes)")

        return {
            "code": 0,
            "data": {
                "filename": unique_filename,
                "url": file_url,
                "size": len(content)
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"上传图片失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"上传图片失败: {str(e)}")


@router.get("/images/{filename}")
async def get_image(filename: str):
    """获取上传的图片"""
    try:
        file_path = UPLOAD_DIR / filename

        if not file_path.exists():
            raise HTTPException(status_code=404, detail="文件不存在")

        return FileResponse(file_path)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取图片失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取图片失败: {str(e)}")


# ========== API 模板管理接口 ==========

@router.post("/templates")
async def create_api_template(request: SaveTemplateRequest):
    """保存 API 模板"""
    try:
        template_id = database.create_api_template(
            name=request.name,
            description=request.description,
            task_type=request.task_type,
            config=request.config
        )

        return {
            "code": 0,
            "data": {
                "template_id": template_id
            }
        }
    except Exception as e:
        logger.error(f"保存模板失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"保存模板失败: {str(e)}")


@router.get("/scheduled")
async def get_scheduled_missions():
    """获取定时任务列表"""
    try:
        from services.scheduler import task_scheduler
        missions = task_scheduler.get_scheduled_tasks()
        return {
            "code": 0,
            "data": {
                "items": missions,
                "total": len(missions)
            }
        }
    except Exception as e:
        logger.error(f"获取定时任务列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取定时任务列表失败: {str(e)}")


@router.get("/templates")
async def get_api_templates(task_type: Optional[str] = None):
    """获取 API 模板列表"""
    try:
        templates = database.get_api_template_list(task_type)
        return {
            "code": 0,
            "data": {
                "items": templates
            }
        }
    except Exception as e:
        logger.error(f"获取模板列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取模板列表失败: {str(e)}")


@router.delete("/templates/{template_id}")
async def delete_api_template(template_id: int):
    """删除 API 模板"""
    try:
        database.delete_api_template(template_id)
        return {
            "code": 0,
            "data": {"deleted": True}
        }
    except Exception as e:
        logger.error(f"删除模板失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除模板失败: {str(e)}")


# ========== 队列状态查询 ==========

@router.get("/queue/status")
async def get_queue_status():
    """获取 API 任务队列状态"""
    try:
        status = api_task_service.get_queue_status()
        return {
            "code": 0,
            "data": status
        }
    except Exception as e:
        logger.error(f"获取队列状态失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取队列状态失败: {str(e)}")
