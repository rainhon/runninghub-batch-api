/**
 * 任务状态和类型配置常量
 * 从 api-tasks.tsx 提取，供多个组件复用
 */

import type { ApiMissionStatus } from '../types';

// API 任务状态配置
export const API_STATUS_CONFIG: Record<ApiMissionStatus, {
  label: string;
  color: string;
  iconName: 'loader' | 'x-circle';
}> = {
  queued: {
    label: '排队中',
    color: 'bg-gray-500',
    iconName: 'loader',
  },
  running: {
    label: '运行中',
    color: 'bg-blue-500',
    iconName: 'loader', // 需要动画
  },
  completed: {
    label: '已完成',
    color: 'bg-green-500',
    iconName: 'loader', // 实际不显示图标
  },
  cancelled: {
    label: '已取消',
    color: 'bg-yellow-500',
    iconName: 'x-circle',
  },
  failed: {
    label: '失败',
    color: 'bg-red-500',
    iconName: 'x-circle',
  },
};

// API 任务类型名称映射
export const API_TASK_TYPE_NAMES: Record<string, string> = {
  text_to_image: '文生图',
  image_to_image: '图生图',
  text_to_video: '文生视频',
  image_to_video: '图生视频',
};

// 工具函数：获取状态文本
export function getStatusLabel(status: ApiMissionStatus): string {
  return API_STATUS_CONFIG[status]?.label || status;
}

// 工具函数：获取状态颜色
export function getStatusColor(status: ApiMissionStatus): string {
  return API_STATUS_CONFIG[status]?.color || 'bg-gray-500';
}

// 工具函数：获取任务类型名称
export function getTaskTypeName(taskType: string): string {
  return API_TASK_TYPE_NAMES[taskType] || taskType;
}
