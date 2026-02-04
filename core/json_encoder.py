"""
自定义 JSON 编码器
统一处理 datetime 类型为中国时区字符串
"""
from datetime import datetime
from fastapi.responses import JSONResponse
from typing import Any
from utils.datetime import parse_datetime_to_response


class ChinaTZJSONResponse(JSONResponse):
    """
    自定义 JSON 响应类
    自动将 datetime 对象转换为中国时区字符串
    """

    def render(self, content: Any) -> bytes:
        """
        序列化内容为 JSON，处理 datetime 类型

        Args:
            content: 要序列化的内容

        Returns:
            JSON 字符串的 bytes
        """
        def convert_datetime(obj: Any) -> Any:
            """递归转换对象中的 datetime"""
            if isinstance(obj, datetime):
                return parse_datetime_to_response(obj)
            elif isinstance(obj, dict):
                return {key: convert_datetime(value) for key, value in obj.items()}
            elif isinstance(obj, list):
                return [convert_datetime(item) for item in obj]
            elif isinstance(obj, tuple):
                return tuple(convert_datetime(item) for item in obj)
            else:
                return obj

        # 转换内容中的 datetime
        converted_content = convert_datetime(content)

        # 使用父类渲染
        return super().render(converted_content)
