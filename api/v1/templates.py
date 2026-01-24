"""
任务模板管理路由
v1 版本
"""
from fastapi import APIRouter
from typing import Optional
import json

import repositories as database
from utils import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/templates", tags=["模板管理"])


@router.post("")
async def save_template(
    name: str,
    description: Optional[str] = None,
    app_id: str = None,
    task_type: Optional[str] = None,
    nodes: Optional[str] = None,
    repeat_count: int = 1,
    config: Optional[str] = None
):
    """保存任务模板（支持 App 模板和 API 模板）"""
    try:
        if task_type:
            # API 模板
            if not name or not config:
                return {"code": 400, "data": None, "msg": "参数不完整"}

            import json
            config_dict = json.loads(config) if isinstance(config, str) else config

            template_id = database.execute_insert_returning_id(
                """INSERT INTO api_templates (name, description, task_type, config_json)
                   VALUES (?, ?, ?, ?)""",
                (name, description, task_type, json.dumps(config_dict))
            )

            return {"code": 0, "data": {"template_id": template_id}, "msg": "API模板保存成功"}

        else:
            # App 模板
            if not name or not app_id or not nodes:
                return {"code": 400, "data": None, "msg": "参数不完整"}

            nodes_dict = json.loads(nodes) if isinstance(nodes, str) else nodes

            template_id = database.execute_insert_returning_id(
                """INSERT INTO task_templates (name, description, app_id, nodes_list, repeat_count)
                   VALUES (?, ?, ?, ?, ?)""",
                (name, description, app_id, json.dumps(nodes_dict), repeat_count)
            )

            return {"code": 0, "data": {"template_id": template_id}, "msg": "App模板保存成功"}

    except Exception as e:
        logger.error(f"保存模板失败: {str(e)}")
        return {"code": 500, "data": None, "msg": f"保存模板失败: {str(e)}"}


@router.get("")
async def get_templates(template_type: Optional[str] = None, task_type: Optional[str] = None):
    """获取任务模板列表"""
    try:
        if template_type == "api" or task_type:
            # API 模板
            sql = "SELECT * FROM api_templates"
            params = ()
            if task_type:
                sql += " WHERE task_type = ?"
                params = (task_type,)
            sql += " ORDER BY created_at DESC"

            result = database.execute_sql(sql, params, fetch_all=True)

            templates = []
            for row in result or []:
                templates.append({
                    "id": row["id"],
                    "name": row["name"],
                    "description": row["description"],
                    "task_type": row["task_type"],
                    "config": json.loads(row["config_json"]) if row["config_json"] else {},
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                })

            return {"code": 0, "data": templates, "msg": "获取成功"}

        else:
            # App 模板
            sql = "SELECT * FROM task_templates ORDER BY created_at DESC"
            result = database.execute_sql(sql, fetch_all=True)

            templates = []
            for row in result or []:
                templates.append({
                    "id": row["id"],
                    "name": row["name"],
                    "description": row["description"],
                    "app_id": row["app_id"],
                    "nodes": json.loads(row["nodes_list"]) if row["nodes_list"] else [],
                    "repeat_count": row["repeat_count"],
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                })

            return {"code": 0, "data": templates, "msg": "获取成功"}

    except Exception as e:
        logger.error(f"获取模板列表失败: {str(e)}")
        return {"code": 500, "data": [], "msg": f"获取模板列表失败: {str(e)}"}


@router.get("/{template_id}")
async def get_template_detail(template_id: int, template_type: Optional[str] = None):
    """获取模板详情"""
    try:
        if template_type == "api":
            # API 模板
            sql = "SELECT * FROM api_templates WHERE id = ?"
            result = database.execute_sql(sql, (template_id,), fetch_one=True)

            if not result:
                return {"code": 404, "data": None, "msg": "模板不存在"}

            template = {
                "id": result["id"],
                "name": result["name"],
                "description": result["description"],
                "task_type": result["task_type"],
                "config": json.loads(result["config_json"]) if result["config_json"] else {},
                "created_at": result["created_at"],
                "updated_at": result["updated_at"],
            }

        else:
            # App 模板
            sql = "SELECT * FROM task_templates WHERE id = ?"
            result = database.execute_sql(sql, (template_id,), fetch_one=True)

            if not result:
                return {"code": 404, "data": None, "msg": "模板不存在"}

            template = {
                "id": result["id"],
                "name": result["name"],
                "description": result["description"],
                "app_id": result["app_id"],
                "nodes": json.loads(result["nodes_list"]) if result["nodes_list"] else [],
                "repeat_count": result["repeat_count"],
                "created_at": result["created_at"],
                "updated_at": result["updated_at"],
            }

        return {"code": 0, "data": template, "msg": "获取成功"}

    except Exception as e:
        logger.error(f"获取模板详情失败: {str(e)}")
        return {"code": 500, "data": None, "msg": f"获取模板详情失败: {str(e)}"}


@router.delete("/{template_id}")
async def delete_template(template_id: int, template_type: Optional[str] = None):
    """删除模板"""
    try:
        if template_type == "api":
            sql = "DELETE FROM api_templates WHERE id = ?"
        else:
            sql = "DELETE FROM task_templates WHERE id = ?"

        database.execute_sql(sql, (template_id,))

        return {"code": 0, "data": None, "msg": "删除成功"}

    except Exception as e:
        logger.error(f"删除模板失败: {str(e)}")
        return {"code": 500, "data": None, "msg": f"删除模板失败: {str(e)}"}
