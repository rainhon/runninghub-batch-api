"""
外部服务集成模块
包含 RunningHub API 和 Mock 服务
"""
import os
from . import runninghub
from . import mock_runninghub

# 根据环境变量选择使用真实服务还是 Mock 服务
USE_MOCK_SERVICE = os.getenv("USE_MOCK_SERVICE", "false").lower() == "true"

if USE_MOCK_SERVICE:
    runninghub_service = mock_runninghub
else:
    runninghub_service = runninghub

__all__ = [
    'runninghub',
    'mock_runninghub',
    'runninghub_service',
    'USE_MOCK_SERVICE'
]
