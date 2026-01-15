import sqlite3
import traceback
from typing import Optional, Tuple, Any

# 数据库文件路径（可根据需要修改）
DB_FILE_PATH = "./runninghub.db"

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
