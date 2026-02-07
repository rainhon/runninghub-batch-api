// API 响应类型
export interface ApiResponse<T = any> {
  code: number;
  data: T;
  msg: string;
}

// 节点信息类型（来自 RunningHub API）
export interface NodeInfo {
  nodeId: string;
  fieldName: string;
  fieldType: 'TEXT' | 'NUMBER' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'SELECT' | 'TEXTAREA';
  fieldValue?: any;
  nodeName?: string;
  fieldOptions?: { label: string; value: string }[];
  required?: boolean;
  placeholder?: string;
  description?: string;
}

// 任务状态（RunningHub 状态码）
export const TaskStatus = {
  PENDING: 813,      // 排队中
  RUNNING: 804,      // 运行中
  SUCCESS: 0,        // 成功
  FAILED: 805,       // 失败
} as const;

export type TaskStatusCode = typeof TaskStatus[keyof typeof TaskStatus];

export type TaskStatusType = 'queued' | 'pending' | 'running' | 'completed' | 'cancelled';

// 任务信息
export interface Task {
  id: number;
  workflow: string;
  status: TaskStatusType;
  status_code: TaskStatusCode;
  repeat_count: number;  // 重复执行次数
  current_repeat: number;  // 已提交次数
  completed_repeat: number;  // 已完成次数
  error_message?: string;  // 失败原因
  nodes_list: NodeInfo[];
  task_id?: string;  // RunningHub 返回的 taskId
  created_at: string;
  updated_at: string;
}

// 任务结果
export interface TaskResult {
  id: number;
  mission_id: number;
  repeat_index: number;  // 第几次重复执行
  status: 'pending' | 'retry_pending' | 'submit' | 'success' | 'fail' | 'submit_failed' | 'cancelled';  // 执行状态
  runninghub_task_id?: string;  // RunningHub 返回的任务ID
  retries: number;  // 重试次数
  error_message?: string;  // 失败原因
  file_path?: string;  // 成功时的文件路径
  file_url?: string;  // 成功时的结果文件 URL
  created_at: string;
  updated_at: string;
}

// 提交任务请求
export interface SubmitTaskRequest {
  app_id: string;
  nodes: NodeInfo[];
  repeat_count?: number;  // 重复执行次数，默认1
}

// RunningHub API 响应类型
export interface RunningHubNodeResponse {
  nodeId: string;
  fieldName: string;
  fieldType: string;
  fieldValue?: any;
  nodeName?: string;
}

export interface RunningHubSubmitResponse {
  code: number;
  data: {
    taskId: string;
    promptTips?: string;
  };
  msg: string;
}

export interface RunningHubOutputsResponse {
  code: number;
  data: Array<{
    fileUrl: string;
    fileName?: string;
  }>;
  msg: string;
}

// 媒体文件类型
export interface MediaFile {
  id: number;
  originalName: string;
  fileHash: string;
  fileSize: number;
  runninghubFilename: string;
  mimeType: string;
  uploadCount: number;
  createdAt: string;
}

// 任务模板类型
export interface TaskTemplate {
  id: number;
  name: string;
  description: string;
  app_id: string;  // 后端使用下划线命名
  nodes: NodeInfo[];
  repeat_count: number;  // 后端使用下划线命名
  created_at: string;  // 后端使用下划线命名
  updated_at: string;  // 后端使用下划线命名
}

// 保存模板请求
export interface SaveTemplateRequest {
  name: string;
  description?: string;
  app_id: string;
  nodes: NodeInfo[];
  repeat_count?: number;
}

// ==================== API 任务相关类型 ====================

// API 任务类型（扩展以支持更多类型）
export type ApiTaskType =
  | 'text_to_image'
  | 'image_to_image'
  | 'text_to_video'
  | 'image_to_video'
  | 'frame_to_video';  // 首尾帧生视频

// 模型类型
export type ModelId = 'sora' | 'sorapro' | 'banana' | 'veo' | 'veopro';

// 模型能力配置
export interface ModelCapability {
  enabled: boolean;
  duration_options?: number[];  // 视频时长选项（秒）
  supported_aspect_ratios: string[];  // 支持的宽高比
  required_params: string[];  // 必需参数
  optional_params: string[];  // 可选参数
  description?: string;  // 能力描述
}

// 模型配置
export interface Model {
  model_id: ModelId;
  name: string;
  display_name: string;
  description: string;
  enabled: boolean;
  priority: number;
  capabilities: {
    [key in ApiTaskType]?: ModelCapability;
  };
  rate_limit: number;
  timeout: number;
}

// 模型列表响应
export interface ModelsListResponse {
  items: Model[];
  total: number;
}

// 模型任务类型信息（包含能力配置）
export interface ModelTaskTypeInfo extends ModelCapability {
  task_type: ApiTaskType;
}

// API 任务状态
export type ApiMissionStatus = 'queued' | 'running' | 'completed' | 'cancelled' | 'failed';

// API 子任务状态
export type ApiItemStatus = 'pending' | 'processing' | 'completed' | 'failed';

// API 任务配置
export interface ApiMissionConfig {
  // 固定参数
  aspectRatio?: 'auto' | '3:4' | '1:1' | '16:9' | '4:3' | '3:2' | '9:16';
  duration?: string;
  prompt?: string;
  // 图片相关参数
  imageUrl?: string;   // 单个图片 URL（用于图生视频）
  imageUrls?: string;  // 图片 URL（用于图生图）
  // 批量输入
  batch_input?: any[];
}

// API 任务信息
export interface ApiMission {
  id: number;
  name: string;
  description?: string;
  task_type: ApiTaskType;
  model_id?: ModelId;  // 使用的模型
  status: ApiMissionStatus;
  total_count: number;
  completed_count: number;
  failed_count: number;
  progress: number;  // 完成百分比
  config_json: string;  // JSON string
  scheduled_time?: string;  // 定时执行时间（中国时区 ISO 格式）
  started_at?: string;  // 任务实际开始执行时间
  created_at: string;
  updated_at: string;
}

// API 子任务信息
export interface ApiMissionItem {
  id: number;
  api_mission_id: number;
  item_index: number;
  input_params: string;  // JSON string
  status: ApiItemStatus;
  result_url?: string;
  error_message?: string;
  runninghub_task_id?: string;
  platform_id?: string;  // 使用的平台ID
  platform_task_id?: string;  // 平台任务ID
  retry_count?: number;  // 重试次数
  next_retry_at?: string;  // 下次重试时间（中国时区 ISO 格式）
  created_at: string;
  updated_at: string;
}

// API 任务详情（包含子任务列表）
export interface ApiMissionDetail extends ApiMission {
  items: ApiMissionItem[];
}

// 创建 API 任务请求
export interface CreateApiMissionRequest {
  name: string;
  description?: string;
  model_id: ModelId;  // 模型 ID
  task_type: ApiTaskType;
  config: ApiMissionConfig;
  scheduled_time?: string;  // 定时执行时间（中国时区 ISO 格式）
  platform_strategy?: string;  // specified, failover, priority
  platform_id?: string;
}

// 平台信息
export interface Platform {
  platform_id: string;
  name: string;
  display_name: string;
  enabled: boolean;
  priority: number;
  supported_task_types: string[];
  rate_limit: number;
  timeout: number;
  cost_per_task?: number;
}

// 任务类型信息
export interface TaskTypeInfo {
  type: string;
  label: string;
  description: string;
  icon: string;
  color: string;
}

// API 任务列表响应
export interface ApiMissionListResponse {
  items: ApiMission[];
  total: number;
  page: number;
  page_size: number;
}

// API 模板（与任务模板区分）
export interface ApiTemplate {
  id: number;
  name: string;
  description?: string;
  task_type: ApiTaskType;
  config_json: string;  // JSON string
  created_at: string;
  updated_at: string;
}

// 保存 API 模板请求
export interface SaveApiTemplateRequest {
  name: string;
  description?: string;
  task_type: ApiTaskType;
  config: ApiMissionConfig;
}

// ==================== App 任务相关类型 ====================

// App 任务状态
export type AppMissionStatus = 'queued' | 'running' | 'completed' | 'cancelled' | 'failed';

// App 子任务状态
export type AppItemStatus = 'pending' | 'processing' | 'completed' | 'failed';

// App 任务配置
export interface AppMissionConfig {
  [key: string]: any;  // 灵活的配置，根据 App 的节点而定
}

// App 任务信息
export interface AppMission {
  id: number;
  name: string;
  description?: string;
  app_id: string;
  status: AppMissionStatus;
  total_count: number;
  completed_count: number;
  failed_count: number;
  config_json: string;  // JSON string
  created_at: string;
  updated_at: string;
}

// App 子任务信息
export interface AppMissionItem {
  id: number;
  app_mission_id: number;
  item_index: number;
  input_params: string;  // JSON string
  status: AppItemStatus;
  result_url?: string;
  result_path?: string;
  error_message?: string;
  runninghub_task_id?: string;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

// App 任务详情
export interface AppMissionDetail extends AppMission {}

// 创建 App 任务请求
export interface CreateAppMissionRequest {
  name: string;
  description?: string;
  app_id: string;
  config: AppMissionConfig;  // 固定配置
  batch_input: AppMissionConfig[];  // 批量输入
}

// App 任务列表响应
export interface AppMissionListResponse {
  missions: AppMission[];
  total: number;
  page: number;
  page_size: number;
}
