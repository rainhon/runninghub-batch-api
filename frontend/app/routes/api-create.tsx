/**
 * API 任务创建页面（新版：先选择模型，再根据模型能力选择任务类型）
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import type { ApiTaskType, ApiMissionConfig, Model } from '../types';

// 使用自定义 hooks
import { useApiTaskFormState } from '../hooks/useApiTaskFormState';

// 使用新组件
import { ModelSelector, ModelTaskTypeSelector } from '../components/tasks';
import { ApiTaskNameInput, ApiTaskDescription, ApiRepeatCountInput } from '../components/forms';
import { ApiPromptsInput, ApiImageUpload, ApiBatchPreview } from '../components/tasks';
import { BatchModeSelector } from '../components/tasks/BatchModeSelector';
import { PreciseTaskList } from '../components/tasks/PreciseTaskList';
import { ScheduledExecutionToggle } from '../components/tasks/ScheduledExecutionToggle';
import type { ImageBatch } from '../components/tasks';
import type { PreciseTaskConfig } from '../components/tasks/TaskCard';

// 初始化图片批次
const initialImageBatches: ImageBatch[] = [{ id: Date.now().toString(), images: [] }];

export default function ApiCreatePage() {
  const navigate = useNavigate();

  // 模型和任务类型状态
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [taskType, setTaskType] = useState<ApiTaskType | null>(null);

  // 表单状态
  const [config, setConfig] = useState<ApiMissionConfig>({});
  const [imageBatches, setImageBatches] = useState<ImageBatch[]>(initialImageBatches);
  const [prompts, setPrompts] = useState<string[]>(['']);

  // 批量模式状态（默认精确模式）
  const [batchMode, setBatchMode] = useState<'precise' | 'combinatorial'>('precise');

  // 精确模式任务列表状态
  const [preciseTasks, setPreciseTasks] = useState<PreciseTaskConfig[]>([]);

  // 定时执行时间
  const [scheduledTime, setScheduledTime] = useState<string | undefined>();

  // 初始化默认配置（在任务类型改变时）
  useEffect(() => {
    if (taskType && selectedModel) {
      initConfigForTaskType(taskType);
    }
  }, [taskType, selectedModel]);

  // 使用表单状态 hook
  const formState = useApiTaskFormState();

  // 初始化任务类型配置
  const initConfigForTaskType = (tt: ApiTaskType) => {
    const isVideoTask = tt === 'text_to_video' || tt === 'image_to_video' || tt === 'frame_to_video';

    // 从模型能力配置获取支持的宽高比
    const capability = selectedModel?.capabilities?.[tt];
    const aspectRatios = capability?.supported_aspect_ratios || ['16:9', '9:16', '1:1'];

    setConfig({
      aspectRatio: aspectRatios[0] as any,
      duration: isVideoTask ? '10' : undefined
    });
  };

  // 提交任务
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedModel || !taskType || !formState.taskName.trim()) {
      formState.setError('请填写完整信息');
      return;
    }

    // 验证定时时间
    if (scheduledTime) {
      const scheduledDate = new Date(scheduledTime);
      const now = new Date();

      if (scheduledDate < now) {
        formState.setError('定时时间不能早于当前时间');
        return;
      }
    }

    // 组合模式才需要验证 prompts 和 imageBatches
    if (batchMode === 'combinatorial') {
      const validPrompts = prompts.filter(p => p.trim().length > 0);
      if (validPrompts.length === 0) {
        formState.setError('请至少输入一个提示词');
        return;
      }

      const needsImage = doesTaskTypeRequireImage(taskType);
      const hasImages = imageBatches.some(batch => batch.images.length > 0);
      if (needsImage && !hasImages) {
        formState.setError('请上传参考图片');
        return;
      }
    }

    formState.setSubmitting(true);
    formState.clearMessages();

    try {
      let batch_input: any[] = [];

      if (batchMode === 'combinatorial') {
        // 组合模式：构造笛卡尔积，再重复
        const validPrompts = prompts.filter(p => p.trim().length > 0);

        // 收集所有批次的所有图片
        const allBatchImages = imageBatches.flatMap(batch => batch.images);

        // 第一步：根据任务类型构造笛卡尔积的基本任务
        const baseTasks: any[] = [];

        if (taskType === 'image_to_image') {
          // 图生图：所有批次的图片作为一组，配合每个提示词
          for (const prompt of validPrompts) {
            baseTasks.push({
              prompt: prompt.trim(),
              imageUrls: allBatchImages.join(','),
              aspectRatio: config.aspectRatio,
            });
          }
        } else if (taskType === 'image_to_video') {
          // 图生视频：每个批次的图片分别配合每个提示词
          for (const batch of imageBatches) {
            for (const imageUrl of batch.images) {
              for (const prompt of validPrompts) {
                baseTasks.push({
                  prompt: prompt.trim(),
                  imageUrl: imageUrl,
                  aspectRatio: config.aspectRatio,
                  duration: config.duration,
                });
              }
            }
          }
        } else if (taskType === 'frame_to_video') {
          // 首尾帧生视频：需要首尾帧图片
          for (let i = 0; i < allBatchImages.length - 1; i += 2) {
            for (const prompt of validPrompts) {
              baseTasks.push({
                prompt: prompt.trim(),
                imageUrl: allBatchImages[i],
                endImageUrl: allBatchImages[i + 1],
                aspectRatio: config.aspectRatio,
                duration: config.duration,
              });
            }
          }
        } else {
          // 文生图/文生视频：每个提示词独立生成
          for (const prompt of validPrompts) {
            const item: any = {
              prompt: prompt.trim(),
              aspectRatio: config.aspectRatio,
            };
            if (taskType === 'text_to_video') {
              item.duration = config.duration;
            }
            baseTasks.push(item);
          }
        }

        // 第二步：对笛卡尔积的结果进行重复
        const repeatCount = formState.repeatCount;
        for (let repeat = 0; repeat < repeatCount; repeat++) {
          batch_input.push(...baseTasks);
        }
      } else {
        // 精确模式：直接转换任务列表
        if (preciseTasks.length === 0) {
          formState.setError('请至少添加一个任务');
          formState.setSubmitting(false);
          return;
        }

        // 验证所有任务都有提示词
        const invalidTasks = preciseTasks.filter(t => !t.prompt || t.prompt.trim().length === 0);
        if (invalidTasks.length > 0) {
          formState.setError('所有任务都必须填写提示词');
          formState.setSubmitting(false);
          return;
        }

        // 验证需要图片的任务类型
        const needsImage = doesTaskTypeRequireImage(taskType);
        if (needsImage) {
          const tasksWithoutImage = preciseTasks.filter(t => !t.imageUrl && !t.imageUrls && !t.endImageUrl);
          if (tasksWithoutImage.length > 0) {
            formState.setError('所有任务都必须上传参考图片');
            formState.setSubmitting(false);
            return;
          }
        }

        // 转换为后端格式并应用重复次数
        const baseTasks = preciseTasks.map(task => ({
          prompt: task.prompt.trim(),
          ...(task.imageUrl && { imageUrl: task.imageUrl }),
          ...(task.imageUrls && { imageUrls: task.imageUrls }),
          ...(task.endImageUrl && { endImageUrl: task.endImageUrl }),
          aspectRatio: task.config.aspectRatio,
          ...(task.config.duration && { duration: task.config.duration })
        }));

        // 应用重复次数
        const repeatCount = formState.repeatCount;
        for (let repeat = 0; repeat < repeatCount; repeat++) {
          batch_input.push(...baseTasks);
        }
      }

      const submitConfig: ApiMissionConfig = {
        ...config,
        batch_input: batch_input,
      };

      console.log('📤 提交配置:', {
        model: selectedModel,
        taskType,
        mode: batchMode,
        config: submitConfig,
        batch_input_count: batch_input.length,
        sample_items: batch_input.slice(0, 3)
      });

      await api.submitApiMission({
        name: formState.taskName,
        description: formState.taskDescription,
        model_id: selectedModel.model_id,
        task_type: taskType,
        config: submitConfig,
        scheduled_time: scheduledTime,
      });

      const successMsg = scheduledTime
        ? `任务已创建，将在 ${new Date(scheduledTime).toLocaleString('zh-CN')} 执行`
        : '任务提交成功！';

      formState.setSuccessMessage(successMsg + ' 正在跳转到任务列表...');
      setTimeout(() => {
        navigate('/api-tasks');
      }, 1500);
    } catch (err: any) {
      formState.setError(err.message || '提交失败');
    } finally {
      formState.setSubmitting(false);
    }
  };

  // 处理模型选择
  const handleModelSelect = (model: Model, _taskTypes: ApiTaskType[]) => {
    setSelectedModel(model);
    setTaskType(null); // 重置任务类型
    setPreciseTasks([]); // 清空任务列表
  };

  // 处理任务类型选择
  const handleTaskTypeSelect = (tt: ApiTaskType) => {
    setTaskType(tt);
    setPreciseTasks([]); // 清空任务列表
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* 步骤指示器 */}
      <div className="mb-6 flex items-center justify-center gap-4 text-sm">
        <div className={`flex items-center gap-2 ${selectedModel ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedModel ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            {selectedModel ? <CheckCircle2 className="w-4 h-4" /> : '1'}
          </div>
          <span>选择模型</span>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
        <div className={`flex items-center gap-2 ${taskType ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${taskType ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
            {taskType ? <CheckCircle2 className="w-4 h-4" /> : '2'}
          </div>
          <span>选择任务类型</span>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
        <div className={`flex items-center gap-2 ${taskType ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-muted`}>
            3
          </div>
          <span>配置参数</span>
        </div>
      </div>

      {/* 步骤 1: 选择模型 */}
      {!selectedModel && (
        <ModelSelector
          value={null}
          onChange={handleModelSelect}
          disabled={formState.submitting}
        />
      )}

      {/* 步骤 2: 选择任务类型（在模型选择后显示） */}
      {selectedModel && !taskType && (
        <ModelTaskTypeSelector
          modelCapabilities={selectedModel.capabilities}
          value={taskType}
          onChange={handleTaskTypeSelect}
          disabled={formState.submitting}
        />
      )}

      {/* 步骤 3: 配置参数（在任务类型选择后显示） */}
      {selectedModel && taskType && (
        <>
          {/* 返回按钮 */}
          <div className="mb-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSelectedModel(null);
                setTaskType(null);
              }}
              disabled={formState.submitting}
            >
              ← 重新选择模型
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>配置任务参数</CardTitle>
              <CardDescription>
                已选择模型：<strong>{selectedModel.display_name}</strong> |
                任务类型：<strong>{getTaskTypeLabel(taskType)}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* 任务名称 */}
                <ApiTaskNameInput
                  value={formState.taskName}
                  onChange={formState.setTaskName}
                  placeholder={`例如：批量${getTaskTypeLabel(taskType)}测试`}
                />

                {/* 任务描述 */}
                <ApiTaskDescription
                  value={formState.taskDescription}
                  onChange={formState.setTaskDescription}
                />

                {/* 定时执行 */}
                <ScheduledExecutionToggle
                  scheduledTime={scheduledTime}
                  onChange={setScheduledTime}
                  disabled={formState.submitting}
                />

                {/* 重复次数 */}
                <ApiRepeatCountInput
                  value={formState.repeatCount}
                  onChange={formState.setRepeatCount}
                  min={1}
                  max={100}
                />

                {/* 批量模式切换器 */}
                <BatchModeSelector
                  value={batchMode}
                  onChange={setBatchMode}
                />

                {/* 根据模式显示不同界面 */}
                {batchMode === 'precise' ? (
                  /* 精确模式：任务列表 */
                  <PreciseTaskList
                    tasks={preciseTasks}
                    onChange={setPreciseTasks}
                    taskType={taskType}
                    model={selectedModel}
                  />
                ) : (
                  /* 组合模式：笛卡尔积方式 */
                  <>
                    {/* 配置表单 */}
                    {renderConfigForm()}

                    {/* 提示词输入 */}
                    <ApiPromptsInput
                      prompts={prompts}
                      onChange={setPrompts}
                      maxCount={50}
                    />

                    {/* 图片上传（如果需要） */}
                    {doesTaskTypeRequireImage(taskType) && (
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
                  </>
                )}

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
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );

  // 渲染配置表单（内部函数）
  function renderConfigForm() {
    if (!taskType || !selectedModel) return null;

    const isVideoTask = taskType === 'text_to_video' || taskType === 'image_to_video' || taskType === 'frame_to_video';
    const capability = selectedModel.capabilities?.[taskType];
    const aspectRatios = capability?.supported_aspect_ratios || ['16:9', '9:16', '1:1'];
    const durationOptions = capability?.duration_options || [5, 10, 15];

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
              value={config.aspectRatio || aspectRatios[0]}
              onChange={(e) => setConfig({ ...config, aspectRatio: e.target.value as any })}
            >
              {aspectRatios.map((ratio) => (
                <option key={ratio} value={ratio}>
                  {ratio}
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
                value={config.duration || String(durationOptions[0])}
                onChange={(e) => setConfig({ ...config, duration: e.target.value })}
              >
                {durationOptions.map((d) => (
                  <option key={d} value={String(d)}>
                    {d}秒
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

// 辅助函数
function getTaskTypeLabel(taskType: ApiTaskType): string {
  const labels: Record<ApiTaskType, string> = {
    text_to_image: '文生图',
    image_to_image: '图生图',
    text_to_video: '文生视频',
    image_to_video: '图生视频',
    frame_to_video: '首尾帧生视频'
  };
  return labels[taskType];
}

function doesTaskTypeRequireImage(taskType: ApiTaskType): boolean {
  return taskType === 'image_to_image' || taskType === 'image_to_video' || taskType === 'frame_to_video';
}
