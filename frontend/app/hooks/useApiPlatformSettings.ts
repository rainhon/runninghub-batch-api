/**
 * API 平台设置管理 Hook
 * 管理平台选择和策略配置状态，供 api-create.tsx 使用
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { Platform, ApiTaskType } from '../types';

export type PlatformStrategy = 'specified' | 'failover' | 'priority';

export interface UseApiPlatformSettingsProps {
  taskType: ApiTaskType | null;
  defaultStrategy?: PlatformStrategy;
}

export interface UseApiPlatformSettingsReturn {
  // 状态
  platforms: Platform[];
  platformStrategy: PlatformStrategy;
  selectedPlatform: string;
  loadingPlatforms: boolean;

  // 设置方法
  setPlatformStrategy: (strategy: PlatformStrategy) => void;
  setSelectedPlatform: (platformId: string) => void;

  // 工具方法
  loadPlatforms: () => Promise<void>;
  canSpecifyPlatform: () => boolean;
}

export function useApiPlatformSettings(
  props: UseApiPlatformSettingsProps
): UseApiPlatformSettingsReturn {
  const { taskType, defaultStrategy = 'failover' } = props;

  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [platformStrategy, setPlatformStrategy] = useState<PlatformStrategy>(defaultStrategy);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('runninghub');
  const [loadingPlatforms, setLoadingPlatforms] = useState(false);

  // 加载平台列表
  const loadPlatforms = useCallback(async () => {
    if (!taskType) return;

    try {
      setLoadingPlatforms(true);
      const result = await api.getPlatforms(taskType);
      setPlatforms(result.data || []);

      // 默认选择第一个平台
      if (result.data && result.data.length > 0) {
        setSelectedPlatform(result.data[0].platform_id);
      }
    } catch (err: any) {
      console.error('加载平台失败:', err);
      // 不设置 error，让调用方决定如何处理
    } finally {
      setLoadingPlatforms(false);
    }
  }, [taskType]);

  // 任务类型变化时重新加载平台
  useEffect(() => {
    if (taskType) {
      loadPlatforms();
    }
  }, [taskType, loadPlatforms]);

  // 检查是否可以指定平台
  const canSpecifyPlatform = useCallback(() => {
    return platformStrategy === 'specified' && platforms.length > 0;
  }, [platformStrategy, platforms.length]);

  return {
    // 状态
    platforms,
    platformStrategy,
    selectedPlatform,
    loadingPlatforms,

    // 设置方法
    setPlatformStrategy,
    setSelectedPlatform,

    // 工具方法
    loadPlatforms,
    canSpecifyPlatform,
  };
}
