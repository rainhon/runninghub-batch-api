"""
时间格式化工具
统一处理中国时区 (Asia/Shanghai, UTC+8) 的时间显示
"""
from datetime import datetime, timezone, timedelta
from typing import Optional

# 中国时区 (UTC+8)
CHINA_TZ = timezone(timedelta(hours=8))


def format_datetime(dt: Optional[datetime], format_str: str = "%Y-%m-%d %H:%M:%S") -> str:
    """
    格式化 datetime 为中国时区字符串

    Args:
        dt: datetime 对象，如果为 None 则返回 '-'
        format_str: 格式化字符串，默认 "%Y-%m-%d %H:%M:%S"

    Returns:
        格式化后的时间字符串

    Examples:
        >>> format_datetime(datetime.now())
        '2026-02-04 15:30:45'
    """
    if dt is None:
        return "-"

    # 如果是 naive datetime（无时区信息），假设是 UTC 并转换为中国时区
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc).astimezone(CHINA_TZ)
    # 如果有时区信息，转换为中国时区
    else:
        dt = dt.astimezone(CHINA_TZ)

    return dt.strftime(format_str)


def format_datetime_iso(dt: Optional[datetime]) -> str:
    """
    格式化 datetime 为 ISO 格式字符串（中国时区）

    Args:
        dt: datetime 对象

    Returns:
        ISO 格式字符串，如 "2026-02-04T15:30:45+08:00"
    """
    if dt is None:
        return "-"

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc).astimezone(CHINA_TZ)
    else:
        dt = dt.astimezone(CHINA_TZ)

    return dt.isoformat()


def parse_datetime_to_response(dt: Optional[datetime]) -> Optional[str]:
    """
    将数据库的 datetime 对象转换为 API 响应字符串
    统一输出格式：YYYY-MM-DD HH:MM:SS（中国时区）

    Args:
        dt: 数据库查询返回的 datetime 对象

    Returns:
        格式化后的字符串，如果 dt 为 None 则返回 None
    """
    if dt is None:
        return None

    # SQLite 返回的是字符串，需要解析
    if isinstance(dt, str):
        try:
            # 尝试解析 ISO 格式
            dt = datetime.fromisoformat(dt.replace('Z', '+00:00'))
        except:
            # 解析失败，返回原字符串
            return dt

    return format_datetime(dt)


def format_now() -> str:
    """
    获取当前时间的格式化字符串（中国时区）

    Returns:
        格式化后的当前时间字符串
    """
    return format_datetime(datetime.now())


def get_current_timestamp() -> datetime:
    """
    获取当前时间（中国时区的 datetime 对象）

    Returns:
        带时区信息的 datetime 对象
    """
    return datetime.now(CHINA_TZ)
