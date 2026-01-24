"""
媒体文件管理路由
v1 版本
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from typing import Optional
import os
import uuid
import hashlib
from datetime import datetime

import repositories as database
from core import UPLOAD_DIR
from integrations import runninghub
from utils import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/media", tags=["媒体文件管理"])


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """上传文件到本地并同步到 RunningHub（支持去重）"""
    try:
        file_content = await file.read()
        file_size = len(file_content)

        # 计算 SHA256 哈希
        file_hash = hashlib.sha256(file_content).hexdigest()

        # 检查文件是否已存在
        existing = database.execute_sql(
            "SELECT * FROM media_files WHERE file_hash = ?",
            (file_hash,),
            fetch_one=True
        )

        if existing:
            # 文件已存在，增加使用计数
            database.execute_sql(
                "UPDATE media_files SET upload_count = upload_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (existing['id'],)
            )
            logger.info(f"♻️ 文件已存在，复用: {existing['original_name']}")
            return {
                "code": 0,
                "data": {
                    "fileName": existing['runninghub_filename'],
                    "fileId": existing['id'],
                    "fileHash": file_hash,
                    "existing": True
                },
                "msg": "文件已存在，复用成功"
            }

        # 文件不存在，保存到本地
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        uniq_name = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}"
        path = os.path.join(UPLOAD_DIR, uniq_name)

        with open(path, "wb") as f:
            f.write(file_content)

        # 上传到 RunningHub
        result = runninghub.upload_file(path)

        if result.get('code') == 0:
            # 保存到媒体文件表
            runninghub_filename = result['data'].get('fileName')
            media_id = database.execute_insert_returning_id(
                """INSERT INTO media_files (file_hash, original_name, file_path, file_size, runninghub_filename, mime_type)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (file_hash, file.filename, path, file_size, runninghub_filename, file.content_type)
            )

            result['data']['fileId'] = media_id
            result['data']['fileHash'] = file_hash
            result['data']['existing'] = False
            logger.info(f"✅ 文件上传成功: {file.filename}")

        return {"code": 0, "data": result['data'], "msg": "上传成功"}

    except Exception as e:
        logger.error(f"文件上传失败: {str(e)}")
        return {"code": 500, "data": None, "msg": f"文件上传失败: {str(e)}"}


@router.get("/files")
async def get_media_files():
    """获取媒体文件列表"""
    try:
        sql = "SELECT * FROM media_files ORDER BY created_at DESC"
        result = database.execute_sql(sql, fetch_all=True)

        files = []
        for row in result or []:
            files.append({
                "id": row["id"],
                "originalName": row["original_name"],
                "fileHash": row["file_hash"],
                "fileSize": row["file_size"],
                "runninghubFilename": row["runninghub_filename"],
                "mimeType": row["mime_type"],
                "uploadCount": row["upload_count"],
                "createdAt": row["created_at"],
            })

        return {"code": 0, "data": files, "msg": "获取成功"}
    except Exception as e:
        logger.error(f"获取媒体文件列表失败: {str(e)}")
        return {"code": 500, "data": [], "msg": f"获取媒体文件列表失败: {str(e)}"}


@router.get("/file/{file_id}")
async def get_media_file(file_id: int):
    """获取媒体文件（用于预览）"""
    try:
        sql = "SELECT * FROM media_files WHERE id = ?"
        result = database.execute_sql(sql, (file_id,), fetch_one=True)

        if not result:
            return {"code": 404, "data": None, "msg": "文件不存在"}

        # 返回文件
        return FileResponse(
            result['file_path'],
            media_type=result['mime_type'] or 'application/octet-stream',
            filename=result['original_name']
        )
    except Exception as e:
        logger.error(f"获取文件失败: {str(e)}")
        return {"code": 500, "data": None, "msg": f"获取文件失败: {str(e)}"}


@router.get("/files/by-names")
async def get_media_files_by_names(filenames: Optional[str] = None):
    """根据文件名列表批量获取媒体文件信息"""
    try:
        if not filenames:
            return {"code": 0, "data": [], "msg": "获取成功"}

        filename_list = filenames.split(',')

        # 构建查询条件
        placeholders = ','.join(['?' for _ in filename_list])
        sql = f"SELECT * FROM media_files WHERE runninghub_filename IN ({placeholders})"
        result = database.execute_sql(sql, filename_list, fetch_all=True)

        files = []
        for row in result or []:
            files.append({
                "id": row["id"],
                "originalName": row["original_name"],
                "fileHash": row["file_hash"],
                "fileSize": row["file_size"],
                "runninghubFilename": row["runninghub_filename"],
                "mimeType": row["mime_type"],
                "filePath": row["file_path"],
                "uploadCount": row["upload_count"],
                "createdAt": row["created_at"],
            })

        return {"code": 0, "data": files, "msg": "获取成功"}
    except Exception as e:
        logger.error(f"获取媒体文件信息失败: {str(e)}")
        return {"code": 500, "data": [], "msg": f"获取媒体文件信息失败: {str(e)}"}
