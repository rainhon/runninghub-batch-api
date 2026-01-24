"""
常量定义
"""
from enum import Enum


# ========== 任务状态枚举 ==========

class TaskStatus(str, Enum):
    """任务状态"""
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FAILED = "failed"
    PENDING = "pending"


class ApiItemStatus(str, Enum):
    """API 任务子项状态"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class ApiTaskType(str, Enum):
    """API 任务类型"""
    TEXT_TO_IMAGE = "text_to_image"
    IMAGE_TO_IMAGE = "image_to_image"
    TEXT_TO_VIDEO = "text_to_video"
    IMAGE_TO_VIDEO = "image_to_video"


# ========== API 任务类型配置 ==========

API_TASK_TYPE_NAMES = {
    "text_to_image": "文生图",
    "image_to_image": "图生图",
    "text_to_video": "文生视频",
    "image_to_video": "图生视频"
}

# 文生图宽高比选项
IMAGE_ASPECT_RATIOS = ["auto", "1:1", "3:4", "4:3", "16:9", "9:16"]

# 视频宽高比选项
VIDEO_ASPECT_RATIOS = ["16:9", "9:16", "1:1"]

# 视频时长选项（秒）
VIDEO_DURATIONS = ["5", "10", "15", "20"]


# ========== 状态码 ==========

class StatusCode(int, Enum):
    """业务状态码"""
    SUCCESS = 0
    ERROR = 500
    NOT_FOUND = 404
    BAD_REQUEST = 400
    UNAUTHORIZED = 401

    # RunningHub 状态码
    QUEUED = 813
    RUNNING = 804
    SUCCESS = 0
    FAILED = 805
