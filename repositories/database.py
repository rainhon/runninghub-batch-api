import sqlite3
import traceback
from typing import Optional, Tuple, Any, Dict, List
from utils.datetime import parse_datetime_to_response

# 数据库文件路径（可根据需要修改）
DB_FILE_PATH = "./runninghub.db"


def format_datetime_fields(data: Any, fields: List[str] = None) -> Any:
    """
    格式化数据中的 datetime 字段为中国时区字符串

    Args:
        data: 可以是单个字典或字典列表
        fields: 需要格式化的字段名列表，默认为 ['created_at', 'updated_at']

    Returns:
        格式化后的数据
    """
    if fields is None:
        fields = ['created_at', 'updated_at']

    if isinstance(data, list):
        # 处理列表
        return [format_datetime_fields(item, fields) for item in data]
    elif isinstance(data, dict):
        # 处理单个字典
        result = dict(data)
        for field in fields:
            if field in result and result[field]:
                result[field] = parse_datetime_to_response(result[field])
        return result
    else:
        return data

def get_db_connection() -> sqlite3.Connection:
    """
    获取 SQLite 数据库连接
    :return: 数据库连接对象
    """
    try:
        conn = sqlite3.connect(DB_FILE_PATH)
        # 设置行工厂，查询结果以字典形式返回
        conn.row_factory = sqlite3.Row

        # 设置时区为中国时区 (UTC+8)
        # 注意：需要 SQLite 3.38.0+ 版本支持
        try:
            conn.execute("PRAGMA time_zone = '+08:00'")
        except sqlite3.OperationalError:
            # 如果 SQLite 版本不支持，忽略错误
            pass

        return conn
    except sqlite3.Error as e:
        raise Exception(f"数据库连接失败：{str(e)}")

def execute_sql(
    sql: str,
    params: Tuple[Any, ...] = (),
    fetch_one: bool = False,
    fetch_all: bool = False
) -> Optional[Any]:
    """
    通用 SQL 执行函数（核心工具函数）
    :param sql: 原生 SQL 语句
    :param params: SQL 参数（防注入，占位符为 ?）
    :param fetch_one: 是否返回单条结果
    :param fetch_all: 是否返回所有结果
    :return: 执行结果（增删改返回受影响行数，查询返回字典/字典列表）
    """
    conn = None
    cursor = None
    try:
        # 获取连接并创建游标
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 执行 SQL 语句（参数化查询）
        cursor.execute(sql, params)
        
        # 处理增删改操作（需要提交事务）
        sql_upper = sql.strip().upper()
        if sql_upper.startswith(("INSERT", "UPDATE", "DELETE")):
            conn.commit()
            return {"affected_rows": cursor.rowcount}
        
        # 处理查询操作
        result = None
        if fetch_one:
            row = cursor.fetchone()
            result = dict(row) if row else None
        if fetch_all:
            rows = cursor.fetchall()
            result = [dict(row) for row in rows] if rows else []
        return result
    
    except sqlite3.Error as e:
        # 记录详细错误日志
        error_detail = traceback.format_exc()
        print(f"SQL 执行失败 | SQL: {sql} | 参数: {params} | 错误: {e}\n{error_detail}")
        raise Exception(f"数据库操作失败：{str(e)}")
    
    finally:
        # 确保游标和连接关闭，避免资源泄露
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def execute_insert_returning_id(
    sql: str,
    params: Tuple[Any, ...] = ()
) -> int:
    """
    执行 INSERT 语句并返回新插入记录的 ID
    使用同一连接确保 last_insert_rowid() 的正确性
    :param sql: INSERT SQL 语句
    :param params: SQL 参数
    :return: 新插入记录的 ID
    """
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # 执行 INSERT
        cursor.execute(sql, params)
        conn.commit()

        # 在同一连接中获取 ID
        cursor.execute("SELECT last_insert_rowid() as id")
        row = cursor.fetchone()

        if row and row['id']:
            return row['id']
        else:
            raise Exception("无法获取插入记录的 ID")

    except sqlite3.Error as e:
        error_detail = traceback.format_exc()
        print(f"INSERT 执行失败 | SQL: {sql} | 参数: {params} | 错误: {e}\n{error_detail}")
        raise Exception(f"数据库插入失败：{str(e)}")

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# ========== API 任务相关辅助方法 ==========

def get_api_mission_list(page: int = 1, page_size: int = 20, status: Optional[str] = None) -> Dict:
    """
    获取 API 任务列表
    :param page: 页码（从1开始）
    :param page_size: 每页大小
    :param status: 状态过滤（可选）
    :return: 包含任务列表和总数的字典
    """
    # 构建查询条件
    where_clause = ""
    params = ()
    if status:
        where_clause = "WHERE status = ?"
        params = (status,)

    # 查询总数
    count_sql = f"SELECT COUNT(*) as total FROM api_missions {where_clause}"
    count_result = execute_sql(count_sql, params, fetch_one=True)
    total = count_result['total'] if count_result else 0

    # 查询列表
    offset = (page - 1) * page_size
    list_sql = f"""
        SELECT id, name, description, task_type, status,
               total_count, completed_count, failed_count,
               scheduled_time, started_at, created_at, updated_at
        FROM api_missions
        {where_clause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    """
    items = execute_sql(list_sql, params + (page_size, offset), fetch_all=True)

    # 计算进度百分比
    for item in items:
        if item['total_count'] > 0:
            item['progress'] = round((item['completed_count'] / item['total_count']) * 100, 2)
        else:
            item['progress'] = 0

    # 格式化时间字段为中国时区（包含所有时间字段）
    items = format_datetime_fields(items, fields=['created_at', 'updated_at', 'scheduled_time', 'started_at'])

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size
    }


def get_api_mission_detail(mission_id: int) -> Optional[Dict]:
    """
    获取 API 任务详情
    :param mission_id: 任务ID
    :return: 任务详情字典
    """
    # 获取主任务信息
    mission = execute_sql(
        "SELECT * FROM api_missions WHERE id = ?",
        (mission_id,),
        fetch_one=True
    )

    if not mission:
        return None

    # 获取子任务列表
    items = execute_sql(
        "SELECT * FROM api_mission_items WHERE api_mission_id = ? ORDER BY item_index",
        (mission_id,),
        fetch_all=True
    )

    # 解析配置JSON
    import json
    mission_dict = dict(mission)
    mission_dict['config'] = json.loads(mission_dict['config_json'])
    del mission_dict['config_json']

    # 格式化时间字段为中国时区
    mission_dict = format_datetime_fields(
        mission_dict,
        fields=['created_at', 'updated_at', 'scheduled_time', 'started_at']
    )

    # 解析子任务参数并格式化时间
    for item in items:
        item_dict = dict(item)
        item_dict['input_params'] = json.loads(item_dict['input_params'])
        # 格式化子任务的时间字段
        item_dict = format_datetime_fields(
            item_dict,
            fields=['created_at', 'updated_at', 'next_retry_at']
        )
        items[items.index(item)] = item_dict

    mission_dict['items'] = items

    return mission_dict


def cancel_api_mission(mission_id: int) -> int:
    """
    取消 API 任务
    :param mission_id: 任务ID
    :return: 取消的子任务数量
    """
    # 获取当前任务状态
    mission = execute_sql(
        "SELECT status FROM api_missions WHERE id = ?",
        (mission_id,),
        fetch_one=True
    )

    if not mission:
        return 0

    if mission['status'] not in ['queued', 'running']:
        return 0

    # 更新任务状态
    execute_sql(
        "UPDATE api_missions SET status = 'cancelled' WHERE id = ?",
        (mission_id,)
    )

    # 取消所有待处理和处理中的子任务
    execute_sql(
        """UPDATE api_mission_items
           SET status = 'failed', error_message = '任务已取消'
           WHERE api_mission_id = ? AND status IN ('pending', 'processing')""",
        (mission_id,)
    )

    # 统计取消的子任务数
    result = execute_sql(
        "SELECT COUNT(*) as count FROM api_mission_items WHERE api_mission_id = ? AND status = 'failed' AND error_message = '任务已取消'",
        (mission_id,),
        fetch_one=True
    )

    return result['count'] if result else 0


def retry_api_mission(mission_id: int) -> int:
    """
    重试失败的 API 任务子项
    :param mission_id: 任务ID
    :return: 重试的子任务数量
    """
    # 获取失败的子任务
    failed_items = execute_sql(
        "SELECT id, item_index FROM api_mission_items WHERE api_mission_id = ? AND status = 'failed'",
        (mission_id,),
        fetch_all=True
    )

    if not failed_items:
        return 0

    # 重置失败的子任务状态
    for item in failed_items:
        execute_sql(
            """UPDATE api_mission_items
               SET status = 'pending', error_message = NULL, platform_task_id = NULL
               WHERE id = ?""",
            (item['id'],)
        )

    # 重置任务状态
    execute_sql(
        "UPDATE api_missions SET status = 'queued' WHERE id = ?",
        (mission_id,)
    )

    return len(failed_items)


def get_api_template_list(task_type: Optional[str] = None) -> List[Dict]:
    """
    获取 API 模板列表
    :param task_type: 任务类型过滤（可选）
    :return: 模板列表
    """
    if task_type:
        templates = execute_sql(
            "SELECT * FROM api_templates WHERE task_type = ? ORDER BY created_at DESC",
            (task_type,),
            fetch_all=True
        )
    else:
        templates = execute_sql(
            "SELECT * FROM api_templates ORDER BY created_at DESC",
            fetch_all=True
        )

    # 解析配置JSON
    import json
    for template in templates:
        template_dict = dict(template)
        template_dict['config'] = json.loads(template_dict['config_json'])
        del template_dict['config_json']
        templates[templates.index(template)] = template_dict

    return templates


def create_api_template(name: str, description: str, task_type: str, config: Dict) -> int:
    """
    创建 API 模板
    :param name: 模板名称
    :param description: 模板描述
    :param task_type: 任务类型
    :param config: 配置字典
    :return: 模板ID
    """
    import json

    template_id = execute_insert_returning_id(
        """INSERT INTO api_templates
           (name, description, task_type, config_json)
           VALUES (?, ?, ?, ?)""",
        (name, description, task_type, json.dumps(config))
    )

    return template_id


def delete_api_template(template_id: int) -> bool:
    """
    删除 API 模板
    :param template_id: 模板ID
    :return: 是否成功
    """
    execute_sql(
        "DELETE FROM api_templates WHERE id = ?",
        (template_id,)
    )
    return True
