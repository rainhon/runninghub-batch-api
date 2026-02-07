/**
 * 模型选择组件
 * 用户先选择模型，然后根据模型能力显示任务类型
 */

import { useState, useEffect } from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { api } from '../../lib/api';
import type { Model, ModelId, ApiTaskType } from '../../types';

interface ModelSelectorProps {
  value: ModelId | null;
  onChange: (model: Model, supportedTaskTypes: ApiTaskType[]) => void;
  disabled?: boolean;
}

// 模型图标映射
const MODEL_ICONS: Record<ModelId, string> = {
  sora: '🎬',
  sorapro: '🎬✨',
  banana: '🍌',
  veo: '🎥',
  veopro: '🎥✨'
};

// 模型颜色映射
const MODEL_COLORS: Record<ModelId, string> = {
  sora: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  sorapro: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  banana: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  veo: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  veopro: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
};

export function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载模型列表
  useEffect(() => {
    const loadModels = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.getModels();
        setModels(response.data.items);
      } catch (err: any) {
        setError(err.message || '加载模型列表失败');
        console.error('加载模型列表失败:', err);
      } finally {
        setLoading(false);
      }
    };

    loadModels();
  }, []);

  // 选择模型
  const handleSelectModel = (model: Model) => {
    // 获取模型支持的任务类型
    const supportedTaskTypes = Object.keys(model.capabilities)
      .filter(key => model.capabilities[key as ApiTaskType]?.enabled) as ApiTaskType[];

    onChange(model, supportedTaskTypes);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">加载模型中...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-destructive">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">选择模型</h3>
          <p className="text-sm text-muted-foreground">
            根据您的需求选择合适的 AI 模型
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map((model) => {
            const modelId = model.model_id as ModelId;
            const isSelected = value === modelId;
            const colorClass = MODEL_COLORS[modelId];

            // 获取支持的任务类型数量
            const taskTypeCount = Object.values(model.capabilities)
              .filter(cap => cap.enabled).length;

            return (
              <button
                key={model.model_id}
                type="button"
                onClick={() => handleSelectModel(model)}
                disabled={disabled}
                className={`
                  relative p-4 rounded-lg border-2 transition-all text-left
                  ${isSelected
                    ? `${colorClass} border-current`
                    : 'border-border hover:border-primary/50'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {/* 图标和名称 */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{MODEL_ICONS[modelId]}</span>
                    <div>
                      <div className="font-semibold">{model.display_name}</div>
                      <div className="text-xs text-muted-foreground">{model.name}</div>
                    </div>
                  </div>
                  {isSelected && (
                    <Badge variant="default" className="text-xs">已选择</Badge>
                  )}
                </div>

                {/* 描述 */}
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {model.description}
                </p>

                {/* 能力标签 */}
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-xs">
                    {taskTypeCount} 种能力
                  </Badge>
                  {Object.entries(model.capabilities)
                    .filter(([_, cap]) => cap.enabled)
                    .slice(0, 3)
                    .map(([taskType, _]) => (
                      <Badge key={taskType} variant="secondary" className="text-xs">
                        {getTaskTypeLabel(taskType as ApiTaskType)}
                      </Badge>
                    ))
                  }
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// 任务类型标签映射
function getTaskTypeLabel(taskType: ApiTaskType): string {
  const labels: Record<ApiTaskType, string> = {
    text_to_image: '文生图',
    image_to_image: '图生图',
    text_to_video: '文生视频',
    image_to_video: '图生视频',
    frame_to_video: '首尾帧'
  };
  return labels[taskType] || taskType;
}
