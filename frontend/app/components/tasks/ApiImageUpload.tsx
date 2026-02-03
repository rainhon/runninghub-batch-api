/**
 * API 图片上传组件（支持批次）
 * 图片批次上传和管理，类似提示词输入的方式
 */

import { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Upload, X, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import type { ApiTaskType } from '../../types';
import { getMaxImagesForTaskType } from '../../constants/taskTypes';

export interface ImageBatch {
  id: string;
  images: string[];
}

export interface ApiImageUploadProps {
  imageBatches: ImageBatch[];
  onBatchesChange: (batches: ImageBatch[]) => void;
  taskType: ApiTaskType;
  onUploadingChange?: (uploading: boolean) => void;
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
  className?: string;
}

export function ApiImageUpload({
  imageBatches,
  onBatchesChange,
  taskType,
  onUploadingChange,
  onError,
  onSuccess,
  className = '',
}: ApiImageUploadProps) {
  const maxImages = getMaxImagesForTaskType(taskType);
  const allowMultiple = maxImages > 1;
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleImageUpload = async (batchId: string) => {
    const input = fileInputRefs.current[batchId];
    if (!input || !input.files || input.files.length === 0) return;

    const files = Array.from(input.files);
    const batchIndex = imageBatches.findIndex(b => b.id === batchId);
    if (batchIndex === -1) return;

    const currentBatch = imageBatches[batchIndex];
    const currentCount = currentBatch.images.length;

    // 限制本次上传数量
    if (currentCount + files.length > maxImages) {
      onError?.(`该批次最多支持 ${maxImages} 张图片，当前已有 ${currentCount} 张`);
      // 清空 input 以便重新选择
      input.value = '';
      return;
    }

    try {
      onUploadingChange?.(true);
      const uploadPromises = files.map(file => api.uploadApiImage(file));
      const results = await Promise.all(uploadPromises);

      const newImages = results.map(r => r.data.url);

      // 更新批次
      const updatedBatches = [...imageBatches];
      updatedBatches[batchIndex] = {
        ...currentBatch,
        images: [...currentBatch.images, ...newImages]
      };
      onBatchesChange(updatedBatches);

      onSuccess?.(`成功上传 ${newImages.length} 张图片到批次 ${batchIndex + 1}`);
    } catch (err: any) {
      onError?.(err.message || '图片上传失败');
    } finally {
      onUploadingChange?.(false);
      // 清空 input 以便重复选择同一文件
      input.value = '';
    }
  };

  const addBatch = () => {
    const newBatch: ImageBatch = {
      id: Date.now().toString(),
      images: []
    };
    onBatchesChange([...imageBatches, newBatch]);
  };

  const removeBatch = (batchId: string) => {
    if (imageBatches.length > 1) {
      onBatchesChange(imageBatches.filter(b => b.id !== batchId));
    }
  };

  const removeImageFromBatch = (batchId: string, imageUrl: string) => {
    const updatedBatches = imageBatches.map(batch => {
      if (batch.id === batchId) {
        return {
          ...batch,
          images: batch.images.filter(img => img !== imageUrl)
        };
      }
      return batch;
    });
    onBatchesChange(updatedBatches);
  };

  const totalImages = imageBatches.reduce((sum, batch) => sum + batch.images.length, 0);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">图片批次</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addBatch}
          >
            <Plus className="w-4 h-4 mr-1" />
            添加批次
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-xs text-muted-foreground">
          {taskType === 'image_to_image'
            ? `每个批次最多 ${maxImages} 张图片，提交时将使用所有批次的图片`
            : `每个批次 ${maxImages} 张图片，提交时将与提示词组合生成`
          }
        </div>

        {imageBatches.map((batch, batchIndex) => (
          <Card key={batch.id} className="border">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">批次 {batchIndex + 1}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {batch.images.length}/{maxImages} 张
                  </Badge>
                  {imageBatches.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeBatch(batch.id)}
                      className="h-6 text-destructive hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>

              {/* 图片列表 */}
              {batch.images.length > 0 && (
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {batch.images.map((imageUrl, imgIndex) => (
                    <div key={imgIndex} className="relative group">
                      <img
                        src={imageUrl}
                        alt={`批次${batchIndex + 1}-图片${imgIndex + 1}`}
                        className="w-full h-32 object-cover rounded-md border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeImageFromBatch(batch.id, imageUrl)}
                        className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* 上传按钮 */}
              <input
                ref={(el) => { fileInputRefs.current[batch.id] = el; }}
                type="file"
                accept="image/*"
                multiple={allowMultiple}
                className="hidden"
                onChange={() => handleImageUpload(batch.id)}
                disabled={batch.images.length >= maxImages}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={batch.images.length >= maxImages}
                className="w-full"
                onClick={() => fileInputRefs.current[batch.id]?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                {batch.images.length === 0 ? '上传图片' : '继续添加'}
              </Button>
            </CardContent>
          </Card>
        ))}

        {imageBatches.length === 0 && (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-md">
            <Upload className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">点击上方"添加批次"开始上传图片</p>
          </div>
        )}

        {/* 统计信息 */}
        {totalImages > 0 && (
          <div className="p-3 bg-muted rounded-md text-sm">
            <div className="flex items-center justify-between">
              <span>总计</span>
              <span className="font-medium">{imageBatches.length} 个批次，{totalImages} 张图片</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
