/**
 * API 批量任务预览组件
 * 显示批量生成任务的预览信息
 */

import { Card, CardContent } from '../../components/ui/card';
import type { ApiTaskType, ApiMissionConfig } from '../../types';
import { TASK_TYPE_CONFIG } from '../../constants/taskTypes';
import type { ImageBatch } from './ApiImageUpload';

export interface ApiBatchPreviewProps {
  taskType: ApiTaskType;
  prompts: string[];
  imageBatches: ImageBatch[];
  repeatCount: number;
  config: ApiMissionConfig;
  className?: string;
}

export function ApiBatchPreview({
  taskType,
  prompts,
  imageBatches,
  repeatCount,
  config,
  className = '',
}: ApiBatchPreviewProps) {
  // 计算批量生成数量
  const parseBatchInput = () => {
    const validPrompts = prompts.filter(p => p.trim().length > 0);
    // 收集所有批次的所有图片
    const allImages = imageBatches.flatMap(batch => batch.images);
    const hasImage = allImages.length > 0;

    if (!hasImage) {
      // 文生任务：每个提示词独立生成
      return validPrompts.length * repeatCount;
    }

    if (taskType === 'image_to_image') {
      // 图生图：所有图片作为一组
      return validPrompts.length * repeatCount;
    } else {
      // 图生视频：每张图片单独配合每个提示词
      return allImages.length * validPrompts.length * repeatCount;
    }
  };

  const totalCount = parseBatchInput();
  const validPromptsCount = prompts.filter(p => p.trim().length > 0).length;
  const taskConfig = TASK_TYPE_CONFIG[taskType];
  const allImages = imageBatches.flatMap(batch => batch.images);
  const totalImagesCount = allImages.length;
  const batchesCount = imageBatches.length;

  if (totalCount === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="p-4 bg-muted rounded-lg">
          <div className="text-sm font-medium mb-2">📊 批量生成预览</div>
          <div className="text-sm text-muted-foreground space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <span>任务类型:</span>
              <span className="font-medium text-foreground">{taskConfig.name}</span>

              <span>提示词数量:</span>
              <span className="font-medium text-foreground">{validPromptsCount} 个</span>

              {totalImagesCount > 0 && (
                <>
                  <span>图片批次:</span>
                  <span className="font-medium text-foreground">{batchesCount} 个批次，{totalImagesCount} 张图片</span>
                </>
              )}

              <span>重复次数:</span>
              <span className="font-medium text-foreground">{repeatCount} 次</span>
            </div>

            <div className="border-t border-border pt-2 mt-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">预计生成:</span>
                <span className="text-lg font-bold text-primary">{totalCount} 个子任务</span>
              </div>
            </div>

            {/* 生成逻辑说明 */}
            <div className="bg-background rounded-md p-2 text-xs">
              <p className="font-medium mb-1">生成逻辑:</p>
              {taskType === 'text_to_image' || taskType === 'text_to_video' ? (
                <p>每个提示词独立生成，重复 {repeatCount} 次</p>
              ) : taskType === 'image_to_image' ? (
                <p>所有 {batchesCount} 个批次的图片（共 {totalImagesCount} 张）作为一组，配合每个提示词生成，重复 {repeatCount} 次</p>
              ) : (
                <p>每张图片单独配合每个提示词生成，重复 {repeatCount} 次</p>
              )}
            </div>

            {config.aspectRatio && <p className="text-xs">• 宽高比: {config.aspectRatio}</p>}
            {config.duration && <p className="text-xs">• 时长: {config.duration}秒</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
