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
  appId: string;
  nodes: NodeInfo[];
  repeatCount: number;
  createdAt: string;
  updatedAt: string;
}

// 保存模板请求
export interface SaveTemplateRequest {
  name: string;
  description?: string;
  app_id: string;
  nodes: NodeInfo[];
  repeat_count?: number;
}
