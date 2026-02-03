import { request } from './request';
import type {
  NodeInfo, Task, TaskResult, SubmitTaskRequest, MediaFile, TaskTemplate, SaveTemplateRequest,
  ApiMission, ApiMissionDetail, ApiMissionListResponse, CreateApiMissionRequest,
  ApiMissionItem, ApiTemplate, SaveApiTemplateRequest,
  AppMission, AppMissionDetail, AppMissionListResponse, CreateAppMissionRequest, AppMissionItem
} from '../types';

// 从环境变量获取 baseURL
const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:7777';

// API 服务
export const api = {
  // 测试数据库连接
  test: () => request.get('/api/test'),

  // 获取应用节点配置
  getAppNodes: (appId: string) => request.get<NodeInfo[]>(`/api/app/read/${appId}`),

  // 提交任务
  submitTask: (data: SubmitTaskRequest) => request.post<Task>('/api/v1/missions/submit', data),

  // 获取任务列表（分页）
  getTaskList: (page: number = 1, pageSize: number = 20) =>
    request.get<{
      items: Task[];
      total: number;
      page: number;
      page_size: number;
      total_pages: number;
    }>(`/api/v1/missions?page=${page}&page_size=${pageSize}`),

  // 获取任务详情
  getTaskDetail: (taskId: number) => request.get<Task>(`/api/v1/missions/${taskId}`),

  // 获取任务结果
  getTaskResults: (taskId: number) => request.get<TaskResult[]>(`/api/v1/missions/${taskId}/results`),

  // 重试失败的任务
  retryTask: (taskId: number) => request.post<{ retry_count: number }>(`/api/v1/missions/${taskId}/retry`),

  // 取消进行中的任务
  cancelTask: (taskId: number) => request.post<{ cancelled_count: number }>(`/api/v1/missions/${taskId}/cancel`),

  // 上传文件
  uploadFile: (file: File, onProgress?: (progress: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);

    return request.post<{ fileName: string; filePath: string; fileId: number; fileHash: string; existing: boolean }>('/api/v1/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
  },

  // 获取媒体文件列表
  getMediaFiles: () => request.get<MediaFile[]>('/api/v1/media/files'),

  // 根据文件名列表批量获取媒体文件信息
  getMediaFilesByNames: (filenames: string[]) => {
    const params = new URLSearchParams();
    filenames.forEach(name => params.append('filenames', name));
    return request.get<MediaFile[]>(`/api/v1/media/files/by-names?${params.toString()}`);
  },

  // 获取媒体文件（用于预览）
  getMediaFile: (fileId: number) => `${baseURL}/api/v1/media/file/${fileId}`,

  // ============== 任务模板 API ==============

  // 保存任务模板
  saveTemplate: (data: SaveTemplateRequest) => request.post<{ template_id: number }>('/api/v1/templates', data),

  // 获取模板列表
  getTemplates: () => request.get<TaskTemplate[]>('/api/v1/templates'),

  // 获取模板详情
  getTemplateDetail: (templateId: number) => request.get<TaskTemplate>(`/api/v1/templates/${templateId}`),

  // 删除模板
  deleteTemplate: (templateId: number) => request.delete(`/api/v1/templates/${templateId}`),

  // ============== API 任务管理 API ==============

  // 提交 API 任务
  submitApiMission: (data: CreateApiMissionRequest) =>
    request.post<{ mission_id: number }>('/api/v1/api_missions/submit', data),

  // 获取 API 任务列表（分页）
  getApiMissions: (page: number = 1, pageSize: number = 20, status?: string) =>
    request.get<ApiMissionListResponse>(
      `/api/v1/api_missions?page=${page}&page_size=${pageSize}${status ? `&status=${status}` : ''}`
    ),

  // 获取 API 任务详情
  getApiMissionDetail: (missionId: number) =>
    request.get<ApiMissionDetail>(`/api/v1/api_missions/${missionId}`),

  // 获取 API 任务的子任务列表
  getApiMissionItems: (missionId: number) =>
    request.get<ApiMissionItem[]>(`/api/v1/api_missions/${missionId}/items`),

  // 取消 API 任务
  cancelApiMission: (missionId: number) =>
    request.post<{ cancelled_count: number }>(`/api/v1/api_missions/${missionId}/cancel`),

  // 重试失败的子任务
  retryApiMission: (missionId: number) =>
    request.post<{ retry_count: number }>(`/api/v1/api_missions/${missionId}/retry`),

  // 下载 API 任务结果（返回文件 URL）
  downloadApiMissionResults: (missionId: number) => {
    return `${baseURL}/api/v1/api_missions/${missionId}/download`;
  },

  // 删除 API 任务
  deleteApiMission: (missionId: number) =>
    request.delete(`/api/v1/api_missions/${missionId}`),

  // 上传 API 任务图片
  uploadApiImage: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    return request.post<{ filename: string; url: string; size: number }>(
      '/api/v1/api_missions/images/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
  },

  // ============== 平台管理 API ==============

  // 获取平台列表
  getPlatforms: (taskType?: string) => {
    const params = taskType ? `?task_type=${taskType}` : '';
    return request.get<any[]>(`/api/v1/platforms${params}`);
  },

  // 获取任务类型列表
  getTaskTypes: () => {
    return request.get<any[]>('/api/v1/platforms/task-types');
  },

  // ============== API 模板管理 API ==============

  // 保存 API 模板
  saveApiTemplate: (data: SaveApiTemplateRequest) =>
    request.post<{ template_id: number }>('/api/v1/api_templates', data),

  // 获取 API 模板列表
  getApiTemplates: (taskType?: string) =>
    request.get<ApiTemplate[]>(
      `/api/v1/api_templates${taskType ? `?task_type=${taskType}` : ''}`
    ),

  // 获取 API 模板详情
  getApiTemplateDetail: (templateId: number) =>
    request.get<ApiTemplate>(`/api/v1/api_templates/${templateId}`),

  // 删除 API 模板
  deleteApiTemplate: (templateId: number) =>
    request.delete(`/api/v1/api_templates/${templateId}`),

  // ============== App 任务管理 API ==============

  // 提交 App 任务
  createAppMission: (data: CreateAppMissionRequest) =>
    request.post<{ mission_id: number; total_count: number }>('/api/v1/app_missions/submit', data),

  // 获取 App 任务列表（分页）
  getAppMissions: (page: number = 1, pageSize: number = 20, status?: string) =>
    request.get<AppMissionListResponse>(
      `/api/v1/app_missions?page=${page}&page_size=${pageSize}${status ? `&status=${status}` : ''}`
    ),

  // 获取 App 任务详情
  getAppMissionDetail: (missionId: number) =>
    request.get<AppMissionDetail>(`/api/v1/app_missions/${missionId}`),

  // 获取 App 任务的子任务列表
  getAppMissionItems: (missionId: number) =>
    request.get<AppMissionItem[]>(`/api/v1/app_missions/${missionId}/items`),

  // 取消 App 任务
  cancelAppMission: (missionId: number) =>
    request.post<{ cancelled_count: number }>(`/api/v1/app_missions/${missionId}/cancel`),

  // 重试失败的子任务
  retryAppMission: (missionId: number) =>
    request.post<{ retry_count: number }>(`/api/v1/app_missions/${missionId}/retry`),

  // 下载 App 任务结果（返回文件 URL）
  downloadAppMissionResults: (missionId: number) => {
    return `${baseURL}/api/v1/app_missions/${missionId}/download`;
  },

  // 删除 App 任务
  deleteAppMission: (missionId: number) =>
    request.delete(`/api/v1/app_missions/${missionId}`),

  // 上传 App 任务文件（图片、音频、视频）
  uploadAppTaskFile: (file: File, onProgress?: (progress: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);

    return request.post<{
      fileId: string;
      id: number;
      url: string;
      fileName: string;
      fileSize: number;
      fileType: string;
      existing: boolean;
    }>('/api/v1/app_missions/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
  },

  // 获取 App 任务文件（用于预览）
  getAppTaskFile: (fileId: number) => `${baseURL}/api/v1/app_missions/file/${fileId}`,

  // 批量获取 App 任务文件信息
  getAppTaskFilesByNames: (filenames: string[]) => {
    const names = filenames.join(',');
    return request.get<any[]>(`/api/v1/app_missions/files/by-names?names=${encodeURIComponent(names)}`);
  },
};
