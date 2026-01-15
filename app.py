from fastapi import FastAPI, Request, APIRouter, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os
from pathlib import Path
import uuid
import hashlib
import database
import runninghub
import json
from datetime import datetime
from typing import Optional
from task_manager import task_manager  # 导入任务管理器


app = FastAPI(title="runninghub任务管理")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")


# ============== 生命周期管理 ==============

@app.on_event("startup")
async def startup_event():
    """应用启动时初始化任务管理器"""
    task_manager.start()
    task_manager.restore_tasks()

@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭时停止任务管理器"""
    task_manager.stop()


# ============== API 端点 ==============

@api_router.get("/test")
def test():
    try:
        result = database.execute_sql("SELECT COUNT(*) as count FROM medias", fetch_one=True)
        return {"code": 200, "data": result, "msg": "数据库连接正常"}
    except Exception as e:
        return {"code": 500, "data": None, "msg": f"数据库连接失败: {str(e)}"}

@api_router.get('/app/read/{app_id}')
def read_workflow(app_id: str):
    """获取应用的节点配置"""
    try:
        result = runninghub.get_nodo(app_id)
        return {"code": 200, "data": result}
    except Exception as e:
        return {"code": 500, "data": None, "msg": f"获取应用配置失败: {str(e)}"}

@api_router.post('/upload')
async def upload(file: UploadFile = File(...)):
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
            print(f"♻️ 文件已存在，复用: {existing['original_name']}")
            return {
                "code": 200,
                "data": {
                    "fileName": existing['runninghub_filename'],
                    "fileId": existing['id'],
                    "fileHash": file_hash,
                    "existing": True
                },
                "msg": "文件已存在，复用成功"
            }

        # 文件不存在，保存到本地
        UPLOAD_DIR = "./uploads"
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
            print(f"✅ 文件上传成功: {file.filename}")

        return {"code": 200, "data": result['data'], "msg": "上传成功"}

    except Exception as e:
        return {"code": 500, "data": None, "msg": f"文件上传失败: {str(e)}"}

@api_router.get('/media/files')
def get_media_files():
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

        return {"code": 200, "data": files, "msg": "获取成功"}
    except Exception as e:
        return {"code": 500, "data": [], "msg": f"获取媒体文件列表失败: {str(e)}"}

@api_router.get('/media/file/{file_id}')
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
        return {"code": 500, "data": None, "msg": f"获取文件失败: {str(e)}"}

@api_router.get('/media/files/by-names')
def get_media_files_by_names(request: Request):
    """根据文件名列表批量获取媒体文件信息"""
    try:
        # 从查询参数获取文件名列表
        filenames = request.query_params.getlist('filenames')

        if not filenames:
            return {"code": 200, "data": [], "msg": "获取成功"}

        # 构建查询条件
        placeholders = ','.join(['?' for _ in filenames])
        sql = f"SELECT * FROM media_files WHERE runninghub_filename IN ({placeholders})"
        result = database.execute_sql(sql, filenames, fetch_all=True)

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

        return {"code": 200, "data": files, "msg": "获取成功"}
    except Exception as e:
        return {"code": 500, "data": [], "msg": f"获取媒体文件信息失败: {str(e)}"}

@api_router.post('/task/submit')
async def submit_task(request: Request):
    """提交 AI 任务"""
    try:
        data = await request.json()
        app_id = data.get('app_id')
        nodes = data.get('nodes', [])
        repeat_count = data.get('repeat_count', 1)  # 默认执行1次

        if not app_id or not nodes:
            return {"code": 400, "data": None, "msg": "参数不完整"}

        if repeat_count < 1:
            return {"code": 400, "data": None, "msg": "重复次数必须大于等于1"}

        nodes_json = json.dumps(nodes, ensure_ascii=False)

        # 创建任务记录并获取 ID
        sql = """
            INSERT INTO missions (workflow, status, status_code, repeat_count, current_repeat, nodes_list)
            VALUES (?, 'queued', 813, ?, 1, ?)
        """
        mission_id = database.execute_insert_returning_id(sql, (app_id, repeat_count, nodes_json))

        # 使用任务管理器提交任务的所有重复执行
        task_manager.submit_mission(mission_id, repeat_count)

        return {
            "code": 200,
            "data": {"mission_id": mission_id, "repeat_count": repeat_count},
            "msg": f"任务已提交，将执行 {repeat_count} 次"
        }

    except Exception as e:
        return {"code": 500, "data": None, "msg": f"任务提交失败: {str(e)}"}

@api_router.get('/tasks')
def get_tasks(page: int = 1, page_size: int = 20):
    """获取任务列表（分页）"""
    try:
        # 查询总数
        count_result = database.execute_sql("SELECT COUNT(*) as total FROM missions", fetch_one=True)
        total = count_result['total'] if count_result else 0

        # 计算偏移量
        offset = (page - 1) * page_size

        # 分页查询
        sql = "SELECT * FROM missions ORDER BY created_at DESC LIMIT ? OFFSET ?"
        result = database.execute_sql(sql, (page_size, offset), fetch_all=True)

        tasks = []
        for row in result or []:
            tasks.append({
                "id": row["id"],
                "workflow": row["workflow"],
                "status": row["status"],
                "status_code": row["status_code"],
                "task_id": row["task_id"],
                "retries": row["retries"],
                "repeat_count": row["repeat_count"],
                "current_repeat": row["current_repeat"],
                "error_message": row.get("error_message"),
                "nodes_list": json.loads(row["nodes_list"]) if row["nodes_list"] else [],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            })

        # 计算总页数
        total_pages = (total + page_size - 1) // page_size

        return {
            "code": 200,
            "data": {
                "items": tasks,
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages
            },
            "msg": "获取成功"
        }
    except Exception as e:
        return {
            "code": 500,
            "data": {
                "items": [],
                "total": 0,
                "page": page,
                "page_size": page_size,
                "total_pages": 0
            },
            "msg": f"获取任务列表失败: {str(e)}"
        }

@api_router.get('/task/{task_id}')
def get_task_detail(task_id: int):
    """获取任务详情"""
    try:
        sql = "SELECT * FROM missions WHERE id = ?"
        result = database.execute_sql(sql, (task_id,), fetch_one=True)

        if not result:
            return {"code": 404, "data": None, "msg": "任务不存在"}

        task = {
            "id": result["id"],
            "workflow": result["workflow"],
            "status": result["status"],
            "status_code": result["status_code"],
            "task_id": result["task_id"],
            "retries": result["retries"],
            "repeat_count": result["repeat_count"],
            "current_repeat": result["current_repeat"],
            "error_message": result.get("error_message"),
            "nodes_list": json.loads(result["nodes_list"]) if result["nodes_list"] else [],
            "created_at": result["created_at"],
            "updated_at": result["updated_at"],
        }

        return {"code": 200, "data": task, "msg": "获取成功"}
    except Exception as e:
        return {"code": 500, "data": None, "msg": f"获取任务详情失败: {str(e)}"}

@api_router.get('/task/{task_id}/results')
def get_task_results(task_id: int):
    """获取任务结果"""
    try:
        sql = "SELECT * FROM results WHERE mission_id = ? ORDER BY created_at DESC"
        result = database.execute_sql(sql, (task_id,), fetch_all=True)

        results = []
        for row in result or []:
            results.append({
                "id": row["id"],
                "mission_id": row["mission_id"],
                "repeat_index": row["repeat_index"],
                "status": row["status"],
                "error_message": row.get("error_message"),
                "file_path": row["file_path"],
                "file_url": row.get("file_url"),
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            })

        return {"code": 200, "data": results, "msg": "获取成功"}
    except Exception as e:
        return {"code": 500, "data": [], "msg": f"获取任务结果失败: {str(e)}"}

@api_router.get('/queue/status')
def get_queue_status():
    """获取队列状态"""
    try:
        status = task_manager.get_status()
        return {
            "code": 200,
            "data": status,
            "msg": "获取成功"
        }
    except Exception as e:
        return {"code": 500, "data": None, "msg": f"获取队列状态失败: {str(e)}"}


# ============== 任务模板 API ==============

@api_router.post('/templates')
async def save_template(request: Request):
    """保存任务模板"""
    try:
        data = await request.json()
        name = data.get('name')
        description = data.get('description', '')
        app_id = data.get('app_id')
        nodes = data.get('nodes', [])
        repeat_count = data.get('repeat_count', 1)

        if not name or not app_id or not nodes:
            return {"code": 400, "data": None, "msg": "参数不完整"}

        nodes_json = json.dumps(nodes, ensure_ascii=False)

        sql = """
            INSERT INTO task_templates (name, description, app_id, nodes_list, repeat_count)
            VALUES (?, ?, ?, ?, ?)
        """
        template_id = database.execute_insert_returning_id(sql, (name, description, app_id, nodes_json, repeat_count))

        return {"code": 200, "data": {"template_id": template_id}, "msg": "模板保存成功"}

    except Exception as e:
        return {"code": 500, "data": None, "msg": f"保存模板失败: {str(e)}"}

@api_router.get('/templates')
def get_templates():
    """获取任务模板列表"""
    try:
        sql = "SELECT * FROM task_templates ORDER BY created_at DESC"
        result = database.execute_sql(sql, fetch_all=True)

        templates = []
        for row in result or []:
            templates.append({
                "id": row["id"],
                "name": row["name"],
                "description": row["description"],
                "appId": row["app_id"],
                "nodes": json.loads(row["nodes_list"]) if row["nodes_list"] else [],
                "repeatCount": row["repeat_count"],
                "createdAt": row["created_at"],
                "updatedAt": row["updated_at"],
            })

        return {"code": 200, "data": templates, "msg": "获取成功"}
    except Exception as e:
        return {"code": 500, "data": [], "msg": f"获取模板列表失败: {str(e)}"}

@api_router.get('/templates/{template_id}')
def get_template_detail(template_id: int):
    """获取模板详情"""
    try:
        sql = "SELECT * FROM task_templates WHERE id = ?"
        result = database.execute_sql(sql, (template_id,), fetch_one=True)

        if not result:
            return {"code": 404, "data": None, "msg": "模板不存在"}

        template = {
            "id": result["id"],
            "name": result["name"],
            "description": result["description"],
            "appId": result["app_id"],
            "nodes": json.loads(result["nodes_list"]) if result["nodes_list"] else [],
            "repeatCount": result["repeat_count"],
            "createdAt": result["created_at"],
            "updatedAt": result["updated_at"],
        }

        return {"code": 200, "data": template, "msg": "获取成功"}
    except Exception as e:
        return {"code": 500, "data": None, "msg": f"获取模板详情失败: {str(e)}"}

@api_router.delete('/templates/{template_id}')
def delete_template(template_id: int):
    """删除模板"""
    try:
        sql = "DELETE FROM task_templates WHERE id = ?"
        database.execute_sql(sql, (template_id,))

        return {"code": 200, "data": None, "msg": "删除成功"}
    except Exception as e:
        return {"code": 500, "data": None, "msg": f"删除模板失败: {str(e)}"}


@api_router.post('/task/{task_id}/retry')
def retry_task(task_id: int):
    """重试失败的任务"""
    try:
        retry_count = task_manager.retry_failed_missions(task_id)

        if retry_count > 0:
            return {
                "code": 200,
                "data": {"retry_count": retry_count},
                "msg": f"已重试 {retry_count} 次失败的执行"
            }
        else:
            return {"code": 400, "data": None, "msg": "没有失败的执行可以重试"}
    except Exception as e:
        return {"code": 500, "data": None, "msg": f"重试任务失败: {str(e)}"}


@api_router.post('/task/{task_id}/cancel')
def cancel_task(task_id: int):
    """取消进行中的任务"""
    try:
        cancelled_count = task_manager.cancel_mission(task_id)

        if cancelled_count >= 0:
            return {
                "code": 200,
                "data": {"cancelled_count": cancelled_count},
                "msg": f"已取消 {cancelled_count} 个排队中的执行"
            }
        else:
            return {"code": 400, "data": None, "msg": "取消任务失败"}
    except Exception as e:
        return {"code": 500, "data": None, "msg": f"取消任务失败: {str(e)}"}


DIST = Path("static")
app.include_router(api_router)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/static/{path:path}")
def spa_fallback(path: str):
    """SPA fallback: 对于不存在的路径，返回 index.html"""
    candidate = DIST / path
    if candidate.exists() and candidate.is_file():
        return FileResponse(candidate)
    return FileResponse(DIST / "index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7777)
