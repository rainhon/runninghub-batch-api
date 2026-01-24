"""
类型定义模块
定义所有数据模型和类型
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from enum import Enum


# ========== 枚举类型 ==========

class TaskStatus(str, Enum):
    """任务状态枚举"""
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FAILED = "failed"


class ApiTaskType(str, Enum):
    """API 任务类型枚举"""
    TEXT_TO_IMAGE = "text_to_image"
    IMAGE_TO_IMAGE = "image_to_image"
    TEXT_TO_VIDEO = "text_to_video"
    IMAGE_TO_VIDEO = "image_to_video"


class ApiItemStatus(str, Enum):
    """API 任务子项状态枚举"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


# ========== App 任务模型 ==========

class AppTaskCreate(BaseModel):
    """创建 App 任务请求"""
    app_id: str
    nodes: List[Dict[str, Any]]
    repeat_count: int = 1


class AppTaskResponse(BaseModel):
    """App 任务响应"""
    mission_id: int
    repeat_count: int
    status: str


# ========== API 任务模型 ==========

class ApiMissionCreate(BaseModel):
    """创建 API 任务请求"""
    name: str
    description: Optional[str] = None
    task_type: ApiTaskType
    config: Dict[str, Any]


class ApiMissionResponse(BaseModel):
    """API 任务响应"""
    api_mission_id: int
    total_count: int
    status: str


class ApiMissionListItem(BaseModel):
    """API 任务列表项"""
    id: int
    name: str
    description: Optional[str]
    task_type: str
    status: TaskStatus
    total_count: int
    completed_count: int
    failed_count: int
    progress: float
    created_at: str
    updated_at: str


class ApiMissionDetail(BaseModel):
    """API 任务详情"""
    id: int
    name: str
    description: Optional[str]
    task_type: str
    status: TaskStatus
    total_count: int
    completed_count: int
    failed_count: int
    config: Dict[str, Any]
    items: List[Dict[str, Any]]
    created_at: str
    updated_at: str


class ApiMissionItem(BaseModel):
    """API 任务子项"""
    id: int
    api_mission_id: int
    item_index: int
    input_params: Dict[str, Any]
    status: ApiItemStatus
    result_url: Optional[str]
    error_message: Optional[str]
    runninghub_task_id: Optional[str]
    created_at: str
    updated_at: str


# ========== 模板模型 ==========

class ApiTemplateCreate(BaseModel):
    """创建 API 模板请求"""
    name: str
    description: Optional[str] = None
    task_type: ApiTaskType
    config: Dict[str, Any]


class ApiTemplateResponse(BaseModel):
    """API 模板响应"""
    template_id: int


class ApiTemplate(BaseModel):
    """API 模板"""
    id: int
    name: str
    description: Optional[str]
    task_type: str
    config: Dict[str, Any]
    created_at: str
    updated_at: str


# ========== 通用响应模型 ==========

class ApiResponse(BaseModel):
    """统一 API 响应格式"""
    code: int
    data: Any
    msg: Optional[str] = None


class PaginatedResponse(BaseModel):
    """分页响应"""
    items: List[Any]
    total: int
    page: int
    page_size: int


# ========== 队列状态模型 ==========

class QueueStatus(BaseModel):
    """队列状态"""
    queue_length: int
    running_items: int
    max_concurrent: int


# ========== 文件上传模型 ==========

class ImageUploadResponse(BaseModel):
    """图片上传响应"""
    filename: str
    url: str
    size: int
