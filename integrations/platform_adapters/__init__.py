"""
平台适配器模块
提供统一的平台适配接口
"""
from .base import BasePlatformAdapter
from .runninghub import RunningHubAdapter
from .mock import MockAdapter

__all__ = [
    'BasePlatformAdapter',
    'RunningHubAdapter',
    'MockAdapter'
]
