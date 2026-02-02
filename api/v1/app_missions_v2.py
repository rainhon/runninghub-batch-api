"""
App 任务管理路由 V2.0
批量输入模式 - 参考 API 任务架构
"""
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, Dict, List
import json
import hashlib
import os
import uuid

import repositories as database
from services.app_task_service_v2 import app_task_manager
from utils import get_logger
from integrations import runninghub
from core import UPLOAD_DIR

logger = get_logger(__name__)

router = APIRouter(prefix="/app_missions", tags=["App 任务管理 V2"])

# 确保上传目录存在
os.makedirs(UPLOAD_DIR, exist_ok=True)

# 允许的文件类型
ALLOWED_IMAGE_TYPES = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'}
ALLOWED_AUDIO_TYPES = {'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/wave'}
ALLOWED_VIDEO_TYPES = {'video/mp4', 'video/mpeg', 'video/quicktime'}


# ========== 请求/响应模型 ==========

class CreateAppMissionRequest(BaseModel):
    """创建 App 任务请求"""
    name: str
    description: Optional[str] = None
    app_id: str  # App ID (RunningHub AI 应用的 ID)
    config: Dict = {}  # 固定配置（所有子任务共享）
    batch_input: List[Dict]  # 批量输入（每个元素对应一个子任务）


# ========== App 任务管理接口 ==========

@router.post("/submit")
async def create_app_mission(request: CreateAppMissionRequest):
    """创建 App 任务（批量输入模式）"""
    try:
        mission_id = app_task_manager.create_mission(
            name=request.name,
            description=request.description,
            app_id=request.app_id,
            config=request.config,
            batch_input=request.batch_input
        )

        return {
            "code": 0,
            "data": {
                "mission_id": mission_id,
                "total_count": len(request.batch_input)
            },
            "msg": f"任务已创建，共 {len(request.batch_input)} 个子任务"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"创建任务失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"创建任务失败: {str(e)}")


@router.get("")
async def get_app_missions(
    page: int = 1,
    page_size: int = 20,
    status: Optional[str] = None
):
    """获取 App 任务列表（分页）"""
    try:
        # 构建查询条件
        where_clause = ""
        params = []
        if status:
            where_clause = "WHERE status = ?"
            params.append(status)

        # 查询总数
        count_sql = f"SELECT COUNT(*) as total FROM app_missions {where_clause}"
        count_result = database.execute_sql(count_sql, tuple(params), fetch_one=True)
        total = count_result['total'] if count_result else 0

        # 计算偏移量
        offset = (page - 1) * page_size

        # 分页查询
        params.extend([page_size, offset])
        list_sql = f"""
            SELECT
                id, name, description, app_id, status,
                total_count, completed_count, failed_count,
                config_json, created_at, updated_at
            FROM app_missions
            {where_clause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        """
        result = database.execute_sql(list_sql, tuple(params), fetch_all=True)

        missions = []
        for row in result or []:
            missions.append({
                "id": row["id"],
                "name": row["name"],
                "description": row["description"],
                "app_id": row["app_id"],
                "status": row["status"],
                "total_count": row["total_count"],
                "completed_count": row["completed_count"] or 0,
                "failed_count": row["failed_count"] or 0,
                "config_json": row["config_json"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"]
            })

        return {
            "code": 0,
            "data": {
                "missions": missions,
                "total": total,
                "page": page,
                "page_size": page_size
            }
        }
    except Exception as e:
        logger.error(f"获取任务列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取任务列表失败: {str(e)}")


@router.get("/{mission_id}")
async def get_app_mission_detail(mission_id: int):
    """获取 App 任务详情"""
    try:
        mission = database.execute_sql(
            """SELECT
               id, name, description, app_id, status,
               total_count, completed_count, failed_count,
               config_json, created_at, updated_at
               FROM app_missions
               WHERE id = ?""",
            (mission_id,),
            fetch_one=True
        )

        if not mission:
            raise HTTPException(status_code=404, detail="任务不存在")

        return {
            "code": 0,
            "data": {
                "id": mission["id"],
                "name": mission["name"],
                "description": mission["description"],
                "app_id": mission["app_id"],
                "status": mission["status"],
                "total_count": mission["total_count"],
                "completed_count": mission["completed_count"] or 0,
                "failed_count": mission["failed_count"] or 0,
                "config_json": mission["config_json"],
                "created_at": mission["created_at"],
                "updated_at": mission["updated_at"]
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取任务详情失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取任务详情失败: {str(e)}")


@router.get("/{mission_id}/items")
async def get_app_mission_items(mission_id: int):
    """获取 App 任务的子任务列表"""
    try:
        # 验证任务存在
        mission = database.execute_sql(
            "SELECT id FROM app_missions WHERE id = ?",
            (mission_id,),
            fetch_one=True
        )

        if not mission:
            raise HTTPException(status_code=404, detail="任务不存在")

        # 查询子任务列表
        items = database.execute_sql(
            """SELECT
               id, app_mission_id, item_index, input_params,
               status, result_url, result_path, error_message,
               runninghub_task_id, retry_count, created_at, updated_at
               FROM app_mission_items
               WHERE app_mission_id = ?
               ORDER BY item_index""",
            (mission_id,),
            fetch_all=True
        )

        result_items = []
        for item in items or []:
            result_items.append({
                "id": item["id"],
                "app_mission_id": item["app_mission_id"],
                "item_index": item["item_index"],
                "input_params": item["input_params"],
                "status": item["status"],
                "result_url": item["result_url"],
                "result_path": item["result_path"],
                "error_message": item["error_message"],
                "runninghub_task_id": item["runninghub_task_id"],
                "retry_count": item["retry_count"] or 0,
                "created_at": item["created_at"],
                "updated_at": item["updated_at"]
            })

        return {
            "code": 0,
            "data": result_items
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取子任务列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取子任务列表失败: {str(e)}")


@router.post("/{mission_id}/cancel")
async def cancel_app_mission(mission_id: int):
    """取消 App 任务"""
    try:
        count = app_task_manager.cancel_mission(mission_id)
        return {
            "code": 0,
            "data": {"cancelled_count": count},
            "msg": "任务已取消"
        }
    except Exception as e:
        logger.error(f"取消任务失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"取消任务失败: {str(e)}")


@router.post("/{mission_id}/retry")
async def retry_app_mission(mission_id: int):
    """重试失败的子任务"""
    try:
        count = app_task_manager.retry_failed_items(mission_id)
        return {
            "code": 0,
            "data": {"retry_count": count},
            "msg": f"已重试 {count} 个失败子任务"
        }
    except Exception as e:
        logger.error(f"重试任务失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"重试任务失败: {str(e)}")


@router.delete("/{mission_id}")
async def delete_app_mission(mission_id: int):
    """删除 App 任务"""
    try:
        # 先取消任务
        app_task_manager.cancel_mission(mission_id)

        # 删除任务（CASCADE 会自动删除子任务）
        database.execute_sql(
            "DELETE FROM app_missions WHERE id = ?",
            (mission_id,)
        )

        return {
            "code": 0,
            "data": None,
            "msg": "任务已删除"
        }
    except Exception as e:
        logger.error(f"删除任务失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除任务失败: {str(e)}")


@router.get("/{mission_id}/download")
async def download_app_mission_results(mission_id: int):
    """下载 App 任务的所有结果（打包为 ZIP）"""
    # TODO: 实现打包下载功能
    return {
        "code": 0,
        "data": {"download_url": f"/api/v1/app_missions/{mission_id}/results.zip"},
        "msg": "功能开发中"
    }


@router.get("/status")
async def get_app_task_status():
    """获取 App 任务管理器状态"""
    try:
        status = app_task_manager.get_status()
        return {
            "code": 0,
            "data": status
        }
    except Exception as e:
        logger.error(f"获取状态失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取状态失败: {str(e)}")


# ========== 文件上传接口 ==========

@router.post("/upload")
async def upload_app_task_file(file: UploadFile = File(...)):
    """
    上传文件到本地并同步到 RunningHub（支持去重）
    用于 App 任务中的图片、音频、视频文件上传
    """
    try:
        # 读取文件内容
        file_content = await file.read()
        file_size = len(file_content)

        # 计算文件哈希
        file_hash = hashlib.sha256(file_content).hexdigest()

        # 检查文件是否已存在（去重）
        existing_file = database.execute_sql(
            "SELECT * FROM media_files WHERE file_hash = ?",
            (file_hash,),
            fetch_one=True
        )

        if existing_file:
            # 文件已存在，增加使用计数
            database.execute_sql(
                "UPDATE media_files SET upload_count = upload_count + 1 WHERE id = ?",
                (existing_file['id'],)
            )
            logger.info(f"文件已存在，复用文件: {existing_file['file_name']} (ID: {existing_file['id']})")

            return {
                "code": 0,
                "data": {
                    "fileId": existing_file['runninghub_file_id'],
                    "id": existing_file['id'],
                    "url": existing_file['url'],
                    "fileName": existing_file['file_name'],
                    "fileSize": file_size,
                    "fileType": existing_file['file_type'],
                    "existing": True
                },
                "msg": "文件已存在，复用成功"
            }

        # 新文件，生成唯一文件名
        file_ext = os.path.splitext(file.filename or "")[1]
        uniq_name = f"{uuid.uuid4().hex}{file_ext}"
        local_path = os.path.join(UPLOAD_DIR, uniq_name)

        # 保存到本地
        with open(local_path, "wb") as f:
            f.write(file_content)

        logger.info(f"文件已保存到本地: {local_path}")

        # 上传到 RunningHub
        try:
            rh_result = runninghub.upload_file(local_path)

            if not rh_result or rh_result.get("code") != 0:
                # RunningHub 上传失败，但本地已保存，记录错误但继续
                error_msg = rh_result.get("msg", "Unknown error") if rh_result else "No response"
                logger.error(f"上传到 RunningHub 失败: {error_msg}")
                raise Exception(f"上传到 RunningHub 失败: {error_msg}")

            rh_data = rh_result.get("data", {})
            runninghub_file_id = rh_data.get("fileId")
            file_url = rh_data.get("url")

            if not runninghub_file_id:
                raise Exception("RunningHub 返回的 fileId 为空")

        except Exception as e:
            # 清理本地文件
            if os.path.exists(local_path):
                os.remove(local_path)
            raise Exception(f"上传到 RunningHub 失败: {str(e)}")

        # 确定文件类型
        content_type = file.content_type or 'application/octet-stream'
        if content_type in ALLOWED_IMAGE_TYPES:
            file_type = 'IMAGE'
        elif content_type in ALLOWED_AUDIO_TYPES:
            file_type = 'AUDIO'
        elif content_type in ALLOWED_VIDEO_TYPES:
            file_type = 'VIDEO'
        else:
            file_type = 'FILE'

        # 保存到数据库
        database.execute_sql(
            """INSERT INTO media_files
               (file_name, file_hash, file_size, file_type, local_path, url,
                runninghub_file_id, upload_count, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
            (file.filename, file_hash, file_size, file_type, local_path,
             file_url, runninghub_file_id, 1)
        )

        # 获取插入的记录 ID
        new_file = database.execute_sql(
            "SELECT * FROM media_files WHERE runninghub_file_id = ?",
            (runninghub_file_id,),
            fetch_one=True
        )

        logger.info(f"文件上传成功: {file.filename} -> {runninghub_file_id}")

        return {
            "code": 0,
            "data": {
                "fileId": runninghub_file_id,
                "id": new_file['id'],
                "url": file_url,
                "fileName": file.filename,
                "fileSize": file_size,
                "fileType": file_type,
                "existing": False
            },
            "msg": "上传成功"
        }

    except Exception as e:
        logger.error(f"上传文件失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"上传文件失败: {str(e)}")


@router.get("/file/{file_id}")
async def get_app_task_file(file_id: int):
    """
    获取上传的文件（用于预览）
    支持本地文件回显
    """
    try:
        # 查询文件信息
        file_record = database.execute_sql(
            "SELECT * FROM media_files WHERE id = ?",
            (file_id,),
            fetch_one=True
        )

        if not file_record:
            raise HTTPException(status_code=404, detail="文件不存在")

        local_path = file_record['local_path']

        # 检查本地文件是否存在
        if not os.path.exists(local_path):
            raise HTTPException(status_code=404, detail="本地文件不存在")

        # 返回文件
        return FileResponse(
            path=local_path,
            media_type='application/octet-stream',
            filename=file_record['file_name']
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取文件失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取文件失败: {str(e)}")


@router.get("/files/by-names")
async def get_files_by_names(names: str):
    """
    批量获取文件信息（通过文件名，逗号分隔）
    用于显示已上传的文件信息
    """
    try:
        if not names or not names.strip():
            return {
                "code": 0,
                "data": [],
                "msg": "未提供文件名"
            }

        name_list = [name.strip() for name in names.split(",") if name.strip()]

        if not name_list:
            return {
                "code": 0,
                "data": [],
                "msg": "未提供有效的文件名"
            }

        # 构建 IN 查询
        placeholders = ",".join(["?" for _ in name_list])
        query = f"SELECT * FROM media_files WHERE file_name IN ({placeholders})"

        files = database.execute_sql(query, tuple(name_list), fetch_all=True)

        return {
            "code": 0,
            "data": files or [],
            "msg": f"找到 {len(files or [])} 个文件"
        }

    except Exception as e:
        logger.error(f"批量获取文件信息失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"批量获取文件信息失败: {str(e)}")
