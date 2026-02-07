/**
 * 任务编辑对话框
 * 支持添加新任务和编辑现有任务，支持图片上传和预览
 */
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X } from 'lucide-react';
import { api } from '@/lib/api';
import { generateUUID } from '@/lib/utils';
import type { PreciseTaskConfig } from './TaskCard';
import { getAspectRatiosForTaskType, taskTypeRequiresImage } from '@/constants/taskTypes';
import { VIDEO_DURATIONS } from '@/constants/taskTypes';
import type { ApiTaskType } from '@/types';

interface TaskEditDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (task: PreciseTaskConfig) => void;
  taskType: ApiTaskType;
  modelId?: string;  // 新增：模型ID，用于获取模型能力
  // 编辑模式时传入现有任务，添加模式时不传
  editingTask?: PreciseTaskConfig;
}

export function TaskEditDialog({
  open,
  onClose,
  onSave,
  taskType,
  modelId,
  editingTask
}: TaskEditDialogProps) {
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [endImageUrl, setEndImageUrl] = useState('');  // 新增：尾帧图片
  const [aspectRatio, setAspectRatio] = useState('auto');
  const [duration, setDuration] = useState('10');
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const endFileInputRef = useRef<HTMLInputElement>(null);  // 新增：尾帧文件输入

  const requiresImage = taskTypeRequiresImage(taskType);
  const requiresEndImage = taskType === 'frame_to_video';  // 新增：首尾帧生视频需要尾帧
  const requiresDuration = taskType === 'text_to_video' || taskType === 'image_to_video' || taskType === 'frame_to_video';
  const isEditMode = !!editingTask;

  // 根据任务类型获取可用的宽高比选项
  const aspectRatios = getAspectRatiosForTaskType(taskType);

  // 初始化表单数据
  useEffect(() => {
    if (editingTask) {
      setPrompt(editingTask.prompt);
      setImageUrl(editingTask.imageUrl || '');
      setEndImageUrl(editingTask.endImageUrl || '');
      setAspectRatio(editingTask.config.aspectRatio);
      setDuration(editingTask.config.duration || '10');
    } else {
      // 重置为默认值 - 使用当前任务类型的第一个宽高比作为默认值
      setPrompt('');
      setImageUrl('');
      setEndImageUrl('');
      setAspectRatio(aspectRatios[0]?.value || 'auto');
      setDuration('10');
    }
  }, [editingTask, open, taskType, aspectRatios]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const result = await api.uploadApiImage(file);
      setImageUrl(result.data.url);
    } catch (err: any) {
      alert(err.message || '图片上传失败');
    } finally {
      setUploading(false);
      // 清空 input
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  // 新增：尾帧图片上传
  const handleEndImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const result = await api.uploadApiImage(file);
      setEndImageUrl(result.data.url);
    } catch (err: any) {
      alert(err.message || '图片上传失败');
    } finally {
      setUploading(false);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleRemoveImage = () => {
    setImageUrl('');
  };

  // 新增：移除尾帧图片
  const handleRemoveEndImage = () => {
    setEndImageUrl('');
  };

  const handleSave = () => {
    if (!prompt.trim()) {
      alert('请输入提示词');
      return;
    }

    if (requiresImage && !imageUrl) {
      alert('请上传参考图片');
      return;
    }

    if (requiresEndImage && (!imageUrl || !endImageUrl)) {
      alert('请上传首帧和尾帧图片');
      return;
    }

    const task: PreciseTaskConfig = {
      id: editingTask?.id || generateUUID(),
      prompt: prompt.trim(),
      ...(requiresImage && imageUrl && { imageUrl }),
      ...(requiresEndImage && endImageUrl && { endImageUrl }),
      config: {
        aspectRatio,
        ...(requiresDuration && { duration })
      }
    };

    onSave(task);

    // 如果不是编辑模式，重置表单
    if (!isEditMode) {
      setPrompt('');
      setImageUrl('');
      setEndImageUrl('');
      setAspectRatio('auto');
      setDuration('10');
    }
  };

  const handleCancel = () => {
    // 重置表单
    setPrompt('');
    setImageUrl('');
    setEndImageUrl('');
    setAspectRatio('auto');
    setDuration('10');
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-medium mb-4">
          {isEditMode ? `编辑任务 #${editingTask?.id.slice(0, 8)}` : '添加新任务'}
        </h3>

        <div className="space-y-4">
          {/* 提示词 */}
          <div>
            <label className="block text-sm font-medium mb-2">
              提示词 <span className="text-destructive">*</span>
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full min-h-[100px] p-3 border rounded-md resize-none"
              placeholder="输入提示词..."
              disabled={uploading}
            />
          </div>

          {/* 图片上传（图生任务需要） */}
          {requiresImage && (
            <div>
              <label className="block text-sm font-medium mb-2">
                参考图片 {requiresImage && <span className="text-destructive">*</span>}
              </label>

              {imageUrl ? (
                <div className="relative">
                  <img
                    src={imageUrl}
                    alt="上传的图片"
                    className="w-full h-40 object-cover rounded-md border"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={handleRemoveImage}
                    disabled={uploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-md p-6">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {uploading ? '上传中...' : '选择图片'}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* 尾帧图片上传（首尾帧生视频需要） */}
          {requiresEndImage && (
            <div>
              <label className="block text-sm font-medium mb-2">
                尾帧图片 <span className="text-destructive">*</span>
              </label>

              {endImageUrl ? (
                <div className="relative">
                  <img
                    src={endImageUrl}
                    alt="上传的尾帧图片"
                    className="w-full h-40 object-cover rounded-md border"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={handleRemoveEndImage}
                    disabled={uploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-md p-6">
                  <input
                    ref={endFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleEndImageUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => endFileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {uploading ? '上传中...' : '选择尾帧图片'}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* 宽高比 */}
          <div>
            <label className="block text-sm font-medium mb-2">宽高比</label>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              className="w-full p-3 border rounded-md"
              disabled={uploading}
            >
              {aspectRatios.map((ratio) => (
                <option key={ratio.value} value={ratio.value}>
                  {ratio.label}
                </option>
              ))}
            </select>
          </div>

          {/* 视频时长（视频任务需要） */}
          {requiresDuration && (
            <div>
              <label className="block text-sm font-medium mb-2">视频时长</label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full p-3 border rounded-md"
                disabled={uploading}
              >
                {VIDEO_DURATIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-3 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={uploading}
          >
            取消
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={uploading}
          >
            {isEditMode ? '保存' : '添加'}
          </Button>
        </div>
      </div>
    </div>
  );
}
