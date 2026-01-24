"""
Pydantic 数据模型
用于请求/响应验证和序列化
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# ========== 通用响应模型 ==========

class ApiResponse(BaseModel):
    """统一 API 响应格式"""
    code: int = Field(default=0, description="状态码，0表示成功")
    data: Any = Field(default=None, description="响应数据")
    msg: Optional[str] = Field(default=None, description="响应消息")


class PaginatedResponse(BaseModel):
    """分页响应"""
    items: List[Any] = Field(default_factory=list, description="数据列表")
    total: int = Field(default=0, description="总记录数")
    page: int = Field(default=1, description="当前页码")
    page_size: int = Field(default=20, description="每页大小")


# ========== App 任务模型 ==========

class CreateAppTaskRequest(BaseModel):
    """创建 App 任务请求"""
    app_id: str = Field(..., description="应用 ID")
    nodes: List[Dict[str, Any]] = Field(default_factory=list, description="节点配置列表")
    repeat_count: int = Field(default=1, ge=1, le=100, description="重复执行次数")


class AppTaskResponse(BaseModel):
    """App 任务响应"""
    mission_id: int = Field(..., description="任务 ID")
    repeat_count: int = Field(..., description="重复次数")
    status: str = Field(..., description="任务状态")


class AppTaskListItem(BaseModel):
    """App 任务列表项"""
    id: int
    workflow: str
    status: str
    status_code: int
    task_id: Optional[str]
    repeat_count: int
    completed_repeat: int
    error_message: Optional[str]
    created_at: str
    updated_at: str


# ========== API 任务模型 ==========

class CreateApiMissionRequest(BaseModel):
    """创建 API 任务请求"""
    name: str = Field(..., min_length=1, max_length=200, description="任务名称")
    description: Optional[str] = Field(default=None, description="任务描述")
    task_type: str = Field(..., description="任务类型")
    config: Dict[str, Any] = Field(..., description="任务配置，包含 batch_input")


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
    status: str
    total_count: int
    completed_count: int
    failed_count: int
    progress: float
    created_at: str
    updated_at: str


class ApiMissionItem(BaseModel):
    """API 任务子项"""
    id: int
    api_mission_id: int
    item_index: int
    input_params: Dict[str, Any]
    status: str
    result_url: Optional[str]
    error_message: Optional[str]
    runninghub_task_id: Optional[str]
    created_at: str
    updated_at: str


# ========== 模板模型 ==========

class CreateAppTemplateRequest(BaseModel):
    """创建 App 模板请求"""
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    app_id: str = Field(..., description="应用 ID")
    nodes: List[Dict[str, Any]] = Field(default_factory=list)
    repeat_count: int = Field(default=1, ge=1)


class CreateApiTemplateRequest(BaseModel):
    """创建 API 模板请求"""
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    task_type: str = Field(..., description="任务类型")
    config: Dict[str, Any] = Field(..., description="模板配置")


class TemplateResponse(BaseModel):
    """模板响应"""
    template_id: int


# ========== 队列状态模型 ==========

class QueueStatus(BaseModel):
    """队列状态"""
    queue_length: int = Field(description="队列中任务数量")
    running_items: int = Field(description="正在运行的任务数量")
    max_concurrent: int = Field(description="最大并发数")


# ========== 文件上传模型 ==========

class ImageUploadResponse(BaseModel):
    """图片上传响应"""
    filename: str
    url: str
    size: int


class MediaFileResponse(BaseModel):
    """媒体文件响应"""
    id: int
    original_name: str
    file_hash: str
    file_size: int
    runninghub_filename: Optional[str]
    mime_type: Optional[str]
    upload_count: int
    created_at: str
