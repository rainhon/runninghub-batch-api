"""
App 任务管理路由
v1 版本
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import json

import repositories as database
from services import task_manager
from utils import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/missions", tags=["App 任务管理"])


# ========== 请求模型 ==========

class CreateMissionRequest(BaseModel):
    """创建任务请求"""
    app_id: str
    nodes: list
    repeat_count: int = 1


# ========== App 任务 API ==========

@router.post("/submit")
async def submit_task(request: CreateMissionRequest):
    """提交 AI 任务"""
    try:
        nodes_json = json.dumps(request.nodes, ensure_ascii=False)

        # 创建任务记录
        sql = """
            INSERT INTO missions (workflow, status, status_code, repeat_count, current_repeat, nodes_list)
            VALUES (?, 'queued', 813, ?, 0, ?)
        """
        mission_id = database.execute_insert_returning_id(
            sql,
            (request.app_id, request.repeat_count, nodes_json)
        )

        # 提交到任务管理器
        task_manager.submit_mission(mission_id, request.repeat_count)

        return {
            "code": 0,
            "data": {
                "mission_id": mission_id,
                "repeat_count": request.repeat_count
            },
            "msg": f"任务已提交，将执行 {request.repeat_count} 次"
        }
    except Exception as e:
        logger.error(f"提交任务失败: {str(e)}")
        return {
            "code": 500,
            "data": None,
            "msg": f"任务提交失败: {str(e)}"
        }


@router.get("")
async def get_tasks(page: int = 1, page_size: int = 20):
    """获取任务列表（分页）"""
    try:
        # 查询总数
        count_result = database.execute_sql(
            "SELECT COUNT(*) as total FROM missions",
            fetch_one=True
        )
        total = count_result['total'] if count_result else 0

        # 计算偏移量
        offset = (page - 1) * page_size

        # 分页查询
        sql = "SELECT * FROM missions ORDER BY created_at DESC LIMIT ? OFFSET ?"
        result = database.execute_sql(sql, (page_size, offset), fetch_all=True)

        tasks = []
        for row in result or []:
            # 查询每个任务的已完成次数
            completed_result = database.execute_sql(
                """SELECT COUNT(DISTINCT repeat_index) as count
                   FROM results
                   WHERE mission_id = ? AND status IN ('success', 'fail', 'submit_failed', 'cancelled')""",
                (row["id"],),
                fetch_one=True
            )
            completed_count = completed_result['count'] if completed_result else 0

            tasks.append({
                "id": row["id"],
                "workflow": row["workflow"],
                "status": row["status"],
                "status_code": row["status_code"],
                "task_id": row["task_id"],
                "repeat_count": row["repeat_count"],
                "current_repeat": row["current_repeat"],
                "completed_repeat": completed_count,
                "error_message": row.get("error_message"),
                "nodes_list": json.loads(row["nodes_list"]) if row["nodes_list"] else [],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            })

        # 计算总页数
        total_pages = (total + page_size - 1) // page_size

        return {
            "code": 0,
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
        logger.error(f"获取任务列表失败: {str(e)}")
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


@router.get("/{task_id}")
async def get_task_detail(task_id: int):
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
            "repeat_count": result["repeat_count"],
            "current_repeat": result["current_repeat"],
            "error_message": result.get("error_message"),
            "nodes_list": json.loads(result["nodes_list"]) if result["nodes_list"] else [],
            "created_at": result["created_at"],
            "updated_at": result["updated_at"],
        }

        return {"code": 0, "data": task, "msg": "获取成功"}
    except Exception as e:
        logger.error(f"获取任务详情失败: {str(e)}")
        return {"code": 500, "data": None, "msg": f"获取任务详情失败: {str(e)}"}


@router.get("/{task_id}/results")
async def get_task_results(task_id: int):
    """获取任务结果"""
    try:
        # 获取任务信息
        task_info = database.execute_sql(
            "SELECT repeat_count FROM missions WHERE id = ?",
            (task_id,),
            fetch_one=True
        )

        if not task_info:
            return {"code": 404, "data": [], "msg": "任务不存在"}

        repeat_count = task_info["repeat_count"]

        # 获取已有的结果记录
        sql = "SELECT * FROM results WHERE mission_id = ? ORDER BY repeat_index ASC"
        existing_results = database.execute_sql(sql, (task_id,), fetch_all=True)

        # 创建字典，按 repeat_index 索引
        results_dict = {}
        for row in existing_results or []:
            results_dict[row["repeat_index"]] = {
                "id": row["id"],
                "mission_id": row["mission_id"],
                "repeat_index": row["repeat_index"],
                "status": row["status"],
                "error_message": row.get("error_message"),
                "file_path": row["file_path"],
                "file_url": row.get("file_url"),
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }

        # 生成完整的结果列表
        results = []
        for i in range(1, repeat_count + 1):
            if i in results_dict:
                results.append(results_dict[i])

        return {"code": 0, "data": results, "msg": "获取成功"}
    except Exception as e:
        logger.error(f"获取任务结果失败: {str(e)}")
        return {"code": 500, "data": [], "msg": f"获取任务结果失败: {str(e)}"}


@router.post("/{task_id}/retry")
async def retry_task(task_id: int):
    """重试失败的任务"""
    try:
        retry_count = task_manager.retry_failed_missions(task_id)

        if retry_count > 0:
            return {
                "code": 0,
                "data": {"retry_count": retry_count},
                "msg": f"已重试 {retry_count} 次失败的执行"
            }
        else:
            return {"code": 400, "data": None, "msg": "没有失败的执行可以重试"}
    except Exception as e:
        logger.error(f"重试任务失败: {str(e)}")
        return {"code": 500, "data": None, "msg": f"重试任务失败: {str(e)}"}


@router.post("/{task_id}/cancel")
async def cancel_task(task_id: int):
    """取消进行中的任务"""
    try:
        cancelled_count = task_manager.cancel_mission(task_id)

        if cancelled_count >= 0:
            return {
                "code": 0,
                "data": {"cancelled_count": cancelled_count},
                "msg": f"已取消 {cancelled_count} 个排队中的执行"
            }
        else:
            return {"code": 400, "data": None, "msg": "取消任务失败"}
    except Exception as e:
        logger.error(f"取消任务失败: {str(e)}")
        return {"code": 500, "data": None, "msg": f"取消任务失败: {str(e)}"}


@router.get("/queue/status")
async def get_queue_status():
    """获取队列状态"""
    try:
        status = task_manager.get_status()
        return {
            "code": 0,
            "data": status,
            "msg": "获取成功"
        }
    except Exception as e:
        logger.error(f"获取队列状态失败: {str(e)}")
        return {"code": 500, "data": None, "msg": f"获取队列状态失败: {str(e)}"}
