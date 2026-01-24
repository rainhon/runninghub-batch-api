import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Loader2, Image as ImageIcon, Edit, Video, Film, XCircle } from 'lucide-react';
import { api } from '../lib/api';
import type { ApiTaskType, ApiMissionConfig } from '../types';

// 任务类型配置
const TASK_TYPES = [
  {
    id: 'text_to_image' as ApiTaskType,
    name: '文生图',
    description: '根据文本描述生成图片',
    icon: <ImageIcon className="w-5 h-5" />,
    color: 'bg-blue-500',
  },
  {
    id: 'image_to_image' as ApiTaskType,
    name: '图生图',
    description: '基于参考图片编辑生成',
    icon: <Edit className="w-5 h-5" />,
    color: 'bg-purple-500',
  },
  {
    id: 'text_to_video' as ApiTaskType,
    name: '文生视频',
    description: '根据描述生成视频',
    icon: <Video className="w-5 h-5" />,
    color: 'bg-green-500',
  },
  {
    id: 'image_to_video' as ApiTaskType,
    name: '图生视频',
    description: '基于参考图片生成视频',
    icon: <Film className="w-5 h-5" />,
    color: 'bg-orange-500',
  },
];

// 宽高比选项
const ASPECT_RATIOS = [
  { value: 'auto', label: '自动' },
  { value: '3:4', label: '3:4 (竖版)' },
  { value: '1:1', label: '1:1 (正方形)' },
  { value: '16:9', label: '16:9 (横版)' },
  { value: '4:3', label: '4:3 (横版)' },
  { value: '3:2', label: '3:2 (横版)' },
  { value: '9:16', label: '9:16 (手机竖版)' },
];

// 时长选项
const DURATIONS = [
  { value: '5', label: '5秒' },
  { value: '10', label: '10秒' },
  { value: '15', label: '15秒' },
  { value: '20', label: '20秒' },
];

export default function ApiCreatePage() {
  const navigate = useNavigate();
  const [taskType, setTaskType] = useState<ApiTaskType | null>(null);
  const [taskName, setTaskName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [config, setConfig] = useState<ApiMissionConfig>({});
  const [repeatCount, setRepeatCount] = useState(1);  // 重复次数
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 获取当前任务类型配置
  const currentTaskConfig = TASK_TYPES.find(t => t.id === taskType);

  // 状态：存储上传的图片完整 URL 列表
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);

  // 状态：存储提示词列表
  const [prompts, setPrompts] = useState<string[]>(['']);  // 默认一个空输入

  // 添加提示词
  const addPrompt = () => {
    setPrompts([...prompts, '']);
  };

  // 删除提示词
  const removePrompt = (index: number) => {
    if (prompts.length > 1) {
      setPrompts(prompts.filter((_, i) => i !== index));
    }
  };

  // 更新提示词
  const updatePrompt = (index: number, value: string) => {
    const newPrompts = [...prompts];
    newPrompts[index] = value;
    setPrompts(newPrompts);
  };

  // 上传图片文件
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setSubmitting(true);
      const uploadPromises = Array.from(files).map(file => api.uploadApiImage(file));
      const results = await Promise.all(uploadPromises);

      // 添加到已上传图片列表（保存完整的 URL）
      const newImages = results.map(r => r.data.url);
      setUploadedImages([...uploadedImages, ...newImages]);

      setSuccessMessage(`成功上传 ${newImages.length} 张图片`);
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: any) {
      setError(err.message || '图片上传失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 移除已上传的图片
  const removeUploadedImage = (imageUrl: string) => {
    setUploadedImages(uploadedImages.filter(img => img !== imageUrl));
  };

  // 解析批量输入 - 转换为对象数组（支持图片和提示词组合，并考虑重复次数）
  const parseBatchInput = (): any[] => {
    // 过滤掉空的提示词
    const validPrompts = prompts.filter(p => p.trim().length > 0);

    if (validPrompts.length === 0) return [];

    const combinations: any[] = [];

    // 根据任务类型构建不同的输入格式
    if (taskType === 'text_to_image' || taskType === 'text_to_video') {
      // 文生图/文生视频：只需要 prompt，每个重复 repeatCount 次
      for (const prompt of validPrompts) {
        for (let i = 0; i < repeatCount; i++) {
          combinations.push({ prompt });
        }
      }
    } else if (taskType === 'image_to_image') {
      // 图生图：笛卡尔积（图片 × 提示词 × 重复次数）
      if (uploadedImages.length === 0) {
        // 没有图片时，只按提示词和重复次数
        for (const prompt of validPrompts) {
          for (let i = 0; i < repeatCount; i++) {
            combinations.push({
              prompt,
              imageUrls: ''
            });
          }
        }
      } else {
        // 有图片：笛卡尔积
        for (const imageUrl of uploadedImages) {
          for (const prompt of validPrompts) {
            for (let i = 0; i < repeatCount; i++) {
              combinations.push({
                prompt,
                imageUrls: imageUrl
              });
            }
          }
        }
      }
    } else if (taskType === 'image_to_video') {
      // 图生视频：笛卡尔积（图片 × 提示词 × 重复次数）
      if (uploadedImages.length === 0) {
        // 没有图片时，只按提示词和重复次数
        for (const prompt of validPrompts) {
          for (let i = 0; i < repeatCount; i++) {
            combinations.push({
              prompt,
              imageUrl: ''
            });
          }
        }
      } else {
        // 有图片：笛卡尔积
        for (const imageUrl of uploadedImages) {
          for (const prompt of validPrompts) {
            for (let i = 0; i < repeatCount; i++) {
              combinations.push({
                prompt,
                imageUrl: imageUrl
              });
            }
          }
        }
      }
    }

    return combinations;
  };

  // 提交任务
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // 验证
    if (!taskType) {
      setError('请选择任务类型');
      return;
    }

    if (!taskName.trim()) {
      setError('请输入任务名称');
      return;
    }

    const batchList = parseBatchInput();
    if (batchList.length === 0) {
      setError('请输入批量生成内容');
      return;
    }

    setSubmitting(true);

    try {
      const submitConfig: ApiMissionConfig = {
        ...config,
        batch_input: batchList,
      };

      await api.submitApiMission({
        name: taskName,
        description: taskDescription,
        task_type: taskType,
        config: submitConfig,
      });

      setSuccessMessage('任务提交成功！正在跳转到任务列表...');
      setTimeout(() => {
        navigate('/api-tasks');
      }, 1500);
    } catch (err: any) {
      setError(err.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 渲染任务类型选择器
  const renderTaskTypeSelector = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {TASK_TYPES.map((type) => (
        <Card
          key={type.id}
          className={`cursor-pointer transition-all hover:shadow-md ${
            taskType === type.id ? 'ring-2 ring-primary' : ''
          }`}
          onClick={() => setTaskType(type.id)}
        >
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-lg ${type.color} text-white`}>
                {type.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">{type.name}</h3>
                <p className="text-sm text-muted-foreground">{type.description}</p>
              </div>
              {taskType === type.id && (
                <Badge variant="default" className="ml-auto">
                  已选择
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  // 渲染配置表单
  const renderConfigForm = () => {
    if (!taskType) return null;

    const isImageTask = taskType === 'text_to_image' || taskType === 'image_to_image';
    const isVideoTask = taskType === 'text_to_video' || taskType === 'image_to_video';
    const needsImage = taskType === 'image_to_image' || taskType === 'image_to_video';

    return (
      <div className="space-y-6">
        {/* 宽高比（图片任务） */}
        {isImageTask && (
          <div className="space-y-2">
            <Label htmlFor="aspectRatio">宽高比</Label>
            <select
              id="aspectRatio"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={config.aspectRatio || 'auto'}
              onChange={(e) => setConfig({ ...config, aspectRatio: e.target.value as any })}
            >
              {ASPECT_RATIOS.map(ratio => (
                <option key={ratio.value} value={ratio.value}>
                  {ratio.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 时长和宽高比（视频任务） */}
        {isVideoTask && (
          <>
            <div className="space-y-2">
              <Label htmlFor="duration">视频时长</Label>
              <select
                id="duration"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={config.duration || '10'}
                onChange={(e) => setConfig({ ...config, duration: e.target.value })}
              >
                {DURATIONS.map(d => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="videoAspectRatio">宽高比</Label>
              <select
                id="videoAspectRatio"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={config.aspectRatio || '9:16'}
                onChange={(e) => setConfig({ ...config, aspectRatio: e.target.value as any })}
              >
                {ASPECT_RATIOS
                  .filter(r => r.value === '9:16' || r.value === '16:9' || r.value === '1:1')
                  .map(ratio => (
                    <option key={ratio.value} value={ratio.value}>
                      {ratio.label}
                    </option>
                  ))}
              </select>
            </div>
          </>
        )}

        {/* 批量输入 */}
        <div className="space-y-4">
          {/* 图片上传区（仅图生图/图生视频需要） */}
          {needsImage && (
            <div className="space-y-2">
              <Label>上传参考图片</Label>
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                disabled={submitting}
                className="cursor-pointer"
              />

              {/* 已上传图片列表 */}
              {uploadedImages.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    已上传 {uploadedImages.length} 张图片
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {uploadedImages.map((imageUrl, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={imageUrl}
                          alt={`上传的图片 ${idx + 1}`}
                          className="w-full h-24 object-cover rounded border"
                        />
                        <button
                          type="button"
                          onClick={() => removeUploadedImage(imageUrl)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 提示词输入区（所有任务类型都需要） */}
          <div className="space-y-2">
            <Label>
              提示词
              <span className="text-destructive">*</span>
            </Label>

            {/* 提示词列表 */}
            {prompts.map((prompt, index) => (
              <div key={index} className="flex gap-2">
                <div className="flex-1">
                  <textarea
                    className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder={`输入提示词 ${index + 1}`}
                    value={prompt}
                    onChange={(e) => updatePrompt(index, e.target.value)}
                  />
                </div>
                {prompts.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removePrompt(index)}
                  >
                    删除
                  </Button>
                )}
              </div>
            ))}

            {/* 添加提示词按钮 */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addPrompt}
              className="w-full"
            >
              + 添加提示词
            </Button>

            {/* 统计信息 */}
            <div className="text-sm text-muted-foreground">
              共 {prompts.filter(p => p.trim().length > 0).length} 个有效提示词，预计生成 {parseBatchInput().length} 个子任务
            </div>
          </div>
        </div>

        {/* 重复次数 */}
        <div className="space-y-2">
          <Label htmlFor="repeatCount">重复次数</Label>
          <Input
            id="repeatCount"
            type="number"
            min="1"
            max="100"
            value={repeatCount}
            onChange={(e) => setRepeatCount(parseInt(e.target.value) || 1)}
            className="w-32"
          />
          <p className="text-xs text-muted-foreground">
            每个组合任务将重复执行 {repeatCount} 次，预计生成 {parseBatchInput().length} 个子任务
          </p>
        </div>

        {/* 预览 */}
        {parseBatchInput().length > 0 && (
          <div className="p-4 bg-muted rounded-lg">
            <div className="text-sm font-medium mb-2">任务预览</div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>• 任务类型: {currentTaskConfig?.name}</p>
              <p>• 总数量: {parseBatchInput().length} 个</p>
              {config.aspectRatio && <p>• 宽高比: {config.aspectRatio}</p>}
              {config.duration && <p>• 时长: {config.duration}秒</p>}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>创建 API 任务</CardTitle>
          <CardDescription>
            选择任务类型，配置参数后批量提交
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 任务名称 */}
            <div className="space-y-2">
              <Label htmlFor="taskName">
                任务名称 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="taskName"
                placeholder="例如：批量文生图测试"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
              />
            </div>

            {/* 任务描述 */}
            <div className="space-y-2">
              <Label htmlFor="taskDescription">任务描述（可选）</Label>
              <textarea
                id="taskDescription"
                className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="简要描述此任务的用途"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
              />
            </div>

            {/* 任务类型选择 */}
            <div className="space-y-2">
              <Label>
                任务类型 <span className="text-destructive">*</span>
              </Label>
              {renderTaskTypeSelector()}
            </div>

            {/* 配置表单 */}
            {taskType && renderConfigForm()}

            {/* 错误提示 */}
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                {error}
              </div>
            )}

            {/* 成功提示 */}
            {successMessage && (
              <div className="p-3 bg-green-500/10 text-green-600 dark:text-green-400 rounded-md text-sm">
                {successMessage}
              </div>
            )}

            {/* 提交按钮 */}
            {taskType && (
              <div className="flex gap-2">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? (
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
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
