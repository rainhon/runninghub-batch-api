import { request } from './request';
import type { NodeInfo, Task, TaskResult, SubmitTaskRequest, MediaFile, TaskTemplate, SaveTemplateRequest } from '../types';

// 从环境变量获取 baseURL
const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:7777';

// API 服务
export const api = {
  // 测试数据库连接
  test: () => request.get('/api/test'),

  // 获取应用节点配置
  getAppNodes: (appId: string) => request.get<NodeInfo[]>(`/api/app/read/${appId}`),

  // 提交任务
  submitTask: (data: SubmitTaskRequest) => request.post<Task>('/api/task/submit', data),

  // 获取任务列表（分页）
  getTaskList: (page: number = 1, pageSize: number = 20) =>
    request.get<{
      items: Task[];
      total: number;
      page: number;
      page_size: number;
      total_pages: number;
    }>(`/api/tasks?page=${page}&page_size=${pageSize}`),

  // 获取任务详情
  getTaskDetail: (taskId: number) => request.get<Task>(`/api/task/${taskId}`),

  // 获取任务结果
  getTaskResults: (taskId: number) => request.get<TaskResult[]>(`/api/task/${taskId}/results`),

  // 重试失败的任务
  retryTask: (taskId: number) => request.post<{ retry_count: number }>(`/api/task/${taskId}/retry`),

  // 取消进行中的任务
  cancelTask: (taskId: number) => request.post<{ cancelled_count: number }>(`/api/task/${taskId}/cancel`),

  // 上传文件
  uploadFile: (file: File, onProgress?: (progress: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);

    return request.post<{ fileName: string; filePath: string; fileId: number; fileHash: string; existing: boolean }>('/api/upload', formData, {
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
  getMediaFiles: () => request.get<MediaFile[]>('/api/media/files'),

  // 根据文件名列表批量获取媒体文件信息
  getMediaFilesByNames: (filenames: string[]) => {
    const params = new URLSearchParams();
    filenames.forEach(name => params.append('filenames', name));
    return request.get<MediaFile[]>(`/api/media/files/by-names?${params.toString()}`);
  },

  // 获取媒体文件（用于预览）
  getMediaFile: (fileId: number) => `${baseURL}/api/media/file/${fileId}`,

  // ============== 任务模板 API ==============

  // 保存任务模板
  saveTemplate: (data: SaveTemplateRequest) => request.post<{ template_id: number }>('/api/templates', data),

  // 获取模板列表
  getTemplates: () => request.get<TaskTemplate[]>('/api/templates'),

  // 获取模板详情
  getTemplateDetail: (templateId: number) => request.get<TaskTemplate>(`/api/templates/${templateId}`),

  // 删除模板
  deleteTemplate: (templateId: number) => request.delete(`/api/templates/${templateId}`),
};
