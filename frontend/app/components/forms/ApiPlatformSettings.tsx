/**
 * API 平台设置组件
 * 平台选择和策略配置
 */

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Loader2 } from 'lucide-react';
import type { Platform, ApiTaskType } from '../../types';
import type { PlatformStrategy } from '../../hooks/useApiPlatformSettings';

export interface ApiPlatformSettingsProps {
  taskType: ApiTaskType;
  strategy: PlatformStrategy;
  onStrategyChange: (strategy: PlatformStrategy) => void;
  selectedPlatform: string;
  onPlatformChange: (platformId: string) => void;
  platforms: Platform[];
  loadingPlatforms?: boolean;
  className?: string;
}

const STRATEGY_OPTIONS = [
  { value: 'specified' as PlatformStrategy, label: '指定平台', description: '手动选择使用的平台' },
  { value: 'failover' as PlatformStrategy, label: '故障转移', description: '任务失败时系统自动切换到其他平台重试' },
  { value: 'priority' as PlatformStrategy, label: '优先级模式', description: '自动使用优先级最高的平台' },
];

export function ApiPlatformSettings({
  taskType,
  strategy,
  onStrategyChange,
  selectedPlatform,
  onPlatformChange,
  platforms,
  loadingPlatforms = false,
  className = '',
}: ApiPlatformSettingsProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">平台设置</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 平台策略选择 */}
        <div>
          <Label>平台策略</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={strategy}
            onChange={(e) => onStrategyChange(e.target.value as PlatformStrategy)}
            disabled={loadingPlatforms}
          >
            {STRATEGY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            {STRATEGY_OPTIONS.find(opt => opt.value === strategy)?.description}
          </p>
        </div>

        {/* 指定平台时显示平台列表 */}
        {strategy === 'specified' && (
          <div>
            <Label>选择平台</Label>
            {loadingPlatforms ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                加载平台列表...
              </div>
            ) : platforms.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 mt-2">
                {platforms.map((platform) => (
                  <button
                    key={platform.platform_id}
                    type="button"
                    onClick={() => onPlatformChange(platform.platform_id)}
                    className={`p-4 rounded-lg border-2 text-left transition ${
                      selectedPlatform === platform.platform_id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{platform.display_name}</span>
                      <Badge variant="outline">优先级 {platform.priority}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      速率限制: {platform.rate_limit} 请求/分钟
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-2">
                暂无可用平台
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
