/**
 * 任务类型和配置常量
 * 从 api-create.tsx 提取，供多个组件复用
 */

import type { ApiTaskType } from '../types';

// 任务类型基础配置（不含 JSX，可用于 JSON 序列化）
export const TASK_TYPE_CONFIG: Record<
  | 'image_to_video'
  | 'text_to_video'
  | 'image_to_image'
  | 'text_to_image'
  | 'frame_to_video',
  {
  id: ApiTaskType;
  name: string;
  description: string;
  iconName: 'image' | 'edit' | 'video' | 'film';
  color: string;
}> = {
  image_to_video: {
    id: 'image_to_video',
    name: '图生视频',
    description: '基于参考图片生成视频',
    iconName: 'film',
    color: 'bg-orange-500',
  },
  text_to_video: {
    id: 'text_to_video',
    name: '文生视频',
    description: '根据描述生成视频',
    iconName: 'video',
    color: 'bg-green-500',
  },
  image_to_image: {
    id: 'image_to_image',
    name: '图生图',
    description: '基于参考图片编辑生成',
    iconName: 'edit',
    color: 'bg-purple-500',
  },
  text_to_image: {
    id: 'text_to_image',
    name: '文生图',
    description: '根据文本描述生成图片',
    iconName: 'image',
    color: 'bg-blue-500',
  },
  frame_to_video: {
    id: 'frame_to_video',
    name: '首尾帧生视频',
    description: '根据首尾帧图片生成中间过渡视频',
    iconName: 'film',
    color: 'bg-pink-500',
  },
};

// 图片任务宽高比选项（香蕉 API）
export const IMAGE_ASPECT_RATIOS = [
  { value: 'auto', label: '自动' },
  { value: '1:1', label: '1:1 (正方形)' },
  { value: '16:9', label: '16:9 (横版)' },
  { value: '9:16', label: '9:16 (竖版)' },
  { value: '4:3', label: '4:3 (横版)' },
  { value: '3:4', label: '3:4 (竖版)' },
  { value: '3:2', label: '3:2 (横版)' },
  { value: '2:3', label: '2:3 (竖版)' },
  { value: '5:4', label: '5:4 (横版)' },
  { value: '4:5', label: '4:5 (竖版)' },
  { value: '21:9', label: '21:9 (超宽)' },
];

// 视频任务宽高比选项（Sora2 API）
export const VIDEO_ASPECT_RATIOS = [
  { value: '9:16', label: '9:16 (竖版)' },
  { value: '16:9', label: '16:9 (横版)' },
];

// 视频时长选项（Sora2 API）
export const VIDEO_DURATIONS = [
  { value: '10', label: '10秒' },
  { value: '15', label: '15秒' },
];

// 工具函数：根据任务类型获取可用宽高比
export function getAspectRatiosForTaskType(taskType: ApiTaskType | null) {
  if (!taskType) return [];

  if (taskType === 'text_to_video' || taskType === 'image_to_video' || taskType === 'frame_to_video') {
    return VIDEO_ASPECT_RATIOS;
  }
  return IMAGE_ASPECT_RATIOS;
}

// 工具函数：判断任务类型是否需要图片输入
export function taskTypeRequiresImage(taskType: ApiTaskType | null): boolean {
  return taskType === 'image_to_image' || taskType === 'image_to_video' || taskType === 'frame_to_video';
}

// 工具函数：获取任务类型最大图片数
export function getMaxImagesForTaskType(taskType: ApiTaskType | null): number {
  if (taskType === 'image_to_image') return 5;
  if (taskType === 'image_to_video') return 1;
  if (taskType === 'frame_to_video') return 2;  // 首尾帧需要2张图片
  return 0;
}
