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

// API 任务类型
export type ApiTaskType = 'text_to_image' | 'image_to_image' | 'text_to_video' | 'image_to_video';

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
  status: ApiMissionStatus;
  total_count: number;
  completed_count: number;
  failed_count: number;
  progress: number;  // 完成百分比
  config_json: string;  // JSON string
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
  task_type: ApiTaskType;
  config: ApiMissionConfig;
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
