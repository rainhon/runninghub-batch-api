/**
 * 基于模型能力的任务类型选择组件
 * 根据所选模型显示支持的任务类型
 */

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import type { ApiTaskType, ModelCapability } from '../../types';

interface ModelTaskTypeSelectorProps {
  modelCapabilities: { [key in ApiTaskType]?: ModelCapability };
  value: ApiTaskType | null;
  onChange: (taskType: ApiTaskType) => void;
  disabled?: boolean;
}

// 任务类型配置
const TASK_TYPE_CONFIG: Record<ApiTaskType, {
  label: string;
  icon: string;
  description: string;
  color: string;
}> = {
  text_to_image: {
    label: '文生图',
    icon: '📝',
    description: '输入文字生成图片',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
  },
  image_to_image: {
    label: '图生图',
    icon: '🖼️',
    description: '根据参考图生成新图片',
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
  },
  text_to_video: {
    label: '文生视频',
    icon: '🎬',
    description: '输入文字生成视频',
    color: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
  },
  image_to_video: {
    label: '图生视频',
    icon: '🎞️',
    description: '根据图片生成视频',
    color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
  },
  frame_to_video: {
    label: '首尾帧生视频',
    icon: '🎥',
    description: '根据首尾帧生成中间过渡视频',
    color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20'
  }
};

interface CapabilityConfig extends ModelCapability {
  task_type: ApiTaskType;
}

export function ModelTaskTypeSelector({
  modelCapabilities,
  value,
  onChange,
  disabled
}: ModelTaskTypeSelectorProps) {
  // 获取模型支持的任务类型配置
  const taskTypeConfigs: CapabilityConfig[] = Object.entries(modelCapabilities)
    .filter(([_, capability]) => capability.enabled)
    .map(([taskType, capability]) => ({
      task_type: taskType as ApiTaskType,
      ...capability
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">选择任务类型</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {taskTypeConfigs.map((config) => {
            const taskType = config.task_type;
            const typeConfig = TASK_TYPE_CONFIG[taskType];
            const isSelected = value === taskType;

            return (
              <button
                key={taskType}
                type="button"
                onClick={() => onChange(taskType)}
                disabled={disabled}
                className={`
                  p-4 rounded-lg border-2 transition-all text-left
                  ${isSelected
                    ? `${typeConfig.color} border-current`
                    : 'border-border hover:border-primary/50'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{typeConfig.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{typeConfig.label}</span>
                      {isSelected && (
                        <Badge variant="default" className="text-xs">已选择</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {typeConfig.description}
                    </p>

                    {/* 能力详情 */}
                    <div className="flex flex-wrap gap-1 text-xs">
                      {config.duration_options && config.duration_options.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {config.duration_options.length} 种时长
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {config.supported_aspect_ratios.length} 种宽高比
                      </Badge>
                      {config.description && (
                        <Badge variant="outline" className="text-xs">
                          {config.description}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
