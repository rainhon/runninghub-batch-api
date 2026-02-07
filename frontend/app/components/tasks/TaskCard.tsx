/**
 * 精确模式任务卡片
 * 显示单个任务的配置，支持编辑、删除、复制操作
 */
import { useState } from 'react';
import { MoreVertical, Edit, Copy, Trash2, ExternalLink } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { TaskEditDialog } from './TaskEditDialog';
import type { ApiTaskType } from '@/types';

export interface PreciseTaskConfig {
  id: string;
  prompt: string;
  imageUrl?: string;
  imageUrls?: string;
  endImageUrl?: string;  // 用于首尾帧生视频
  config: {
    aspectRatio: string;
    duration?: string;
  };
}

interface TaskCardProps {
  task: PreciseTaskConfig;
  index: number;
  taskType: ApiTaskType;
  modelId?: string;  // 新增：模型ID
  onEdit: (task: PreciseTaskConfig) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export function TaskCard({ task, index, taskType, modelId, onEdit, onDelete, onDuplicate }: TaskCardProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);

  const requiresImage = taskType === 'image_to_image' || taskType === 'image_to_video';
  const requiresEndImage = taskType === 'frame_to_video';

  return (
    <div className="border rounded-lg p-3 space-y-2 hover:border-primary/50 transition-colors">
      {/* 任务标题和操作菜单 */}
      <div className="flex items-center justify-between">
        <div className="font-medium text-xs">任务 #{index + 1}</div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
              <Edit className="mr-2 h-3 w-3" />
              编辑
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="mr-2 h-3 w-3" />
              复制
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="mr-2 h-3 w-3" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 任务详情 */}
      <div className="text-xs space-y-1">
        <div className="line-clamp-2">
          <span className="text-muted-foreground">提示：</span>
          <span className="ml-1">{task.prompt || <span className="text-red-500">未设置</span>}</span>
        </div>

        {requiresImage && (task.imageUrl || task.imageUrls) && (
          <div>
            <span className="text-muted-foreground block mb-1">图片：</span>
            <div
              className="relative cursor-pointer group"
              onClick={() => setShowImagePreview(true)}
            >
              <img
                src={task.imageUrl || task.imageUrls}
                alt="参考图片"
                className="w-full h-24 object-cover rounded-md border"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
                <ExternalLink className="h-5 w-5 text-white" />
              </div>
            </div>
          </div>
        )}

        {requiresEndImage && task.imageUrl && (
          <div>
            <span className="text-muted-foreground block mb-1">首帧图片：</span>
            <img
              src={task.imageUrl}
              alt="首帧图片"
              className="w-full h-24 object-cover rounded-md border"
            />
          </div>
        )}

        {requiresEndImage && task.endImageUrl && (
          <div>
            <span className="text-muted-foreground block mb-1">尾帧图片：</span>
            <img
              src={task.endImageUrl}
              alt="尾帧图片"
              className="w-full h-24 object-cover rounded-md border"
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{task.config.aspectRatio}</span>
          {task.config.duration && <span>| {task.config.duration}秒</span>}
        </div>
      </div>

      {/* 编辑对话框 */}
      <TaskEditDialog
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        onSave={(updatedTask) => {
          onEdit(updatedTask);
          setShowEditDialog(false);
        }}
        taskType={taskType}
        modelId={modelId}
        editingTask={task}
      />

      {/* 图片预览对话框 */}
      {showImagePreview && (task.imageUrl || task.imageUrls) && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowImagePreview(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={task.imageUrl || task.imageUrls}
              alt="预览图片"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
              onClick={() => setShowImagePreview(false)}
            >
              ✕
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
