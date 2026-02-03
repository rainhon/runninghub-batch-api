/**
 * API 任务创建页面（重构版）
 * 使用新组件和 hooks，代码从 758 行减少到约 200 行
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import type { ApiTaskType, ApiMissionConfig } from '../types';

// 使用自定义 hooks
import { useApiTaskFormState } from '../hooks/useApiTaskFormState';
import { useApiPlatformSettings } from '../hooks/useApiPlatformSettings';

// 使用新组件
import { ApiTaskTypeTabs } from '../components/tasks';
import { ApiTaskNameInput, ApiTaskDescription, ApiPlatformSettings } from '../components/forms';
import { ApiPromptsInput, ApiImageUpload, ApiBatchPreview } from '../components/tasks';
import type { ImageBatch } from '../components/tasks';

// 使用常量
import { TASK_TYPE_CONFIG } from '../constants/taskTypes';
import { getAspectRatiosForTaskType, taskTypeRequiresImage } from '../constants/taskTypes';

// 初始化图片批次
const initialImageBatches: ImageBatch[] = [{ id: Date.now().toString(), images: [] }];

// 配置常量
const VIDEO_DURATIONS = [
  { value: '10', label: '10秒' },
  { value: '15', label: '15秒' },
];

export default function ApiCreatePage() {
  const navigate = useNavigate();

  // 任务类型状态
  const [taskType, setTaskType] = useState<ApiTaskType | null>('image_to_video');
  const [config, setConfig] = useState<ApiMissionConfig>({});
  const [imageBatches, setImageBatches] = useState<ImageBatch[]>(initialImageBatches);
  const [prompts, setPrompts] = useState<string[]>(['']);

  // 使用表单状态 hook
  const formState = useApiTaskFormState();

  // 使用平台设置 hook
  const platform = useApiPlatformSettings({
    taskType,
    defaultStrategy: 'failover',
  });

  // 当前任务类型配置
  const currentTaskConfig = taskType ? TASK_TYPE_CONFIG[taskType] : null;

  // 提交任务
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!taskType || !formState.taskName.trim()) {
      formState.setError('请填写任务名称');
      return;
    }

    const validPrompts = prompts.filter(p => p.trim().length > 0);
    if (validPrompts.length === 0) {
      formState.setError('请至少输入一个提示词');
      return;
    }

    const needsImage = taskTypeRequiresImage(taskType);
    const hasImages = imageBatches.some(batch => batch.images.length > 0);
    if (needsImage && !hasImages) {
      formState.setError('请上传参考图片');
      return;
    }

    formState.setSubmitting(true);
    formState.clearMessages();

    try {
      // 构造 batch_input（笛卡尔积）
      const batch_input: any[] = [];
      const validPrompts = prompts.filter(p => p.trim().length > 0);

      // 重复次数
      const repeatCount = formState.repeatCount;

      // 收集所有批次的所有图片
      const allBatchImages = imageBatches.flatMap(batch => batch.images);

      // 根据任务类型构造批量输入
      if (taskType === 'image_to_image') {
        // 图生图：所有批次的图片作为一组，配合每个提示词，重复指定次数
        for (let repeat = 0; repeat < repeatCount; repeat++) {
          for (const prompt of validPrompts) {
            batch_input.push({
              prompt: prompt.trim(),
              imageUrls: allBatchImages.join(','), // 所有图片用逗号分隔
              aspectRatio: config.aspectRatio,
            });
          }
        }
      } else if (taskType === 'image_to_video') {
        // 图生视频：每个批次的图片分别配合每个提示词，重复指定次数
        for (let repeat = 0; repeat < repeatCount; repeat++) {
          for (const batch of imageBatches) {
            for (const imageUrl of batch.images) {
              for (const prompt of validPrompts) {
                batch_input.push({
                  prompt: prompt.trim(),
                  imageUrl: imageUrl,
                  aspectRatio: config.aspectRatio,
                  duration: config.duration,
                });
              }
            }
          }
        }
      } else {
        // 文生图/文生视频：每个提示词独立生成，重复指定次数
        for (let repeat = 0; repeat < repeatCount; repeat++) {
          for (const prompt of validPrompts) {
            const item: any = {
              prompt: prompt.trim(),
              aspectRatio: config.aspectRatio,
            };
            if (taskType === 'text_to_video') {
              item.duration = config.duration;
            }
            batch_input.push(item);
          }
        }
      }

      const submitConfig: ApiMissionConfig = {
        ...config,
        batch_input: batch_input,
      };

      await api.submitApiMission({
        name: formState.taskName,
        description: formState.taskDescription,
        task_type: taskType,
        config: submitConfig,
        platform_strategy: platform.platformStrategy,
        platform_id: platform.platformStrategy === 'specified' ? platform.selectedPlatform : undefined,
      });

      formState.setSuccessMessage('任务提交成功！正在跳转到任务列表...');
      setTimeout(() => {
        navigate('/api-tasks');
      }, 1500);
    } catch (err: any) {
      formState.setError(err.message || '提交失败');
    } finally {
      formState.setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* 任务类型 Tab 选择器 */}
      <div className="mb-6">
        <ApiTaskTypeTabs
          value={taskType || ''}
          onChange={(value) => {
            setTaskType(value);
            setConfig({});
            setImageBatches(initialImageBatches);
          }}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>创建 API 任务</CardTitle>
          <CardDescription>
            {taskType
              ? `配置${currentTaskConfig?.name}任务参数后批量提交`
              : '选择任务类型，配置参数后批量提交'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {taskType ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 任务名称 */}
              <ApiTaskNameInput
                value={formState.taskName}
                onChange={formState.setTaskName}
                placeholder={`例如：批量${currentTaskConfig?.name}测试`}
              />

              {/* 任务描述 */}
              <ApiTaskDescription
                value={formState.taskDescription}
                onChange={formState.setTaskDescription}
              />

              {/* 平台设置 */}
              <ApiPlatformSettings
                taskType={taskType}
                strategy={platform.platformStrategy}
                onStrategyChange={platform.setPlatformStrategy}
                selectedPlatform={platform.selectedPlatform}
                onPlatformChange={platform.setSelectedPlatform}
                platforms={platform.platforms}
                loadingPlatforms={platform.loadingPlatforms}
              />

              {/* 配置表单 */}
              {renderConfigForm()}

              {/* 提示词输入 */}
              <ApiPromptsInput
                prompts={prompts}
                onChange={setPrompts}
                maxCount={50}
              />

              {/* 图片上传（如果需要） */}
              {taskTypeRequiresImage(taskType) && (
                <ApiImageUpload
                  imageBatches={imageBatches}
                  onBatchesChange={setImageBatches}
                  taskType={taskType}
                  onUploadingChange={formState.setSubmitting}
                  onError={formState.setError}
                  onSuccess={formState.setSuccessMessage}
                />
              )}

              {/* 批量预览 */}
              <ApiBatchPreview
                taskType={taskType}
                prompts={prompts}
                imageBatches={imageBatches}
                repeatCount={formState.repeatCount}
                config={config}
              />

              {/* 错误提示 */}
              {formState.error && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                  {formState.error}
                </div>
              )}

              {/* 成功提示 */}
              {formState.successMessage && (
                <div className="p-3 bg-green-500/10 text-green-600 dark:text-green-400 rounded-md text-sm">
                  {formState.successMessage}
                </div>
              )}

              {/* 提交按钮 */}
              <div className="flex gap-2">
                <Button type="submit" disabled={formState.submitting} className="flex-1">
                  {formState.submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      提交中...
                    </>
                  ) : (
                    '提交任务'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/api-tasks')}
                >
                  任务列表
                </Button>
              </div>
            </form>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              请先选择上方的任务类型
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // 渲染配置表单（内部函数）
  function renderConfigForm() {
    if (!taskType) return null;

    const isVideoTask = taskType === 'text_to_video' || taskType === 'image_to_video';
    const aspectRatios = getAspectRatiosForTaskType(taskType);

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">任务配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 宽高比 */}
          <div>
            <label className="text-sm font-medium">宽高比</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mt-2"
              value={config.aspectRatio || (aspectRatios[0]?.value as any)}
              onChange={(e) => setConfig({ ...config, aspectRatio: e.target.value as any })}
            >
              {aspectRatios.map((ratio) => (
                <option key={ratio.value} value={ratio.value}>
                  {ratio.label}
                </option>
              ))}
            </select>
          </div>

          {/* 视频时长（仅视频任务） */}
          {isVideoTask && (
            <div>
              <label className="text-sm font-medium">视频时长</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mt-2"
                value={config.duration || '10'}
                onChange={(e) => setConfig({ ...config, duration: e.target.value })}
              >
                {VIDEO_DURATIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
}
