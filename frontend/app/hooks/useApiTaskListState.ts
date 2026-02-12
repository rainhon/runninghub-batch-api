/**
 * API 任务列表状态管理 Hook
 * 统一管理任务列表页面的状态，供 api-tasks.tsx 和类似页面使用
 */

import { useState, useCallback, useEffect } from 'react';
import { api } from '../lib/api';
import type { ApiMission, ApiMissionStatus } from '../types';

export interface UseApiTaskListStateProps {
  pageSize?: number;
  defaultStatusFilter?: ApiMissionStatus | 'all';
  initialPage?: number;  // 初始页码（从 URL 参数读取）
}

export interface UseApiTaskListStateReturn {
  // 状态
  missions: ApiMission[];
  loading: boolean;
  refreshing: boolean;
  currentPage: number;
  totalPages: number;
  total: number;
  statusFilter: ApiMissionStatus | 'all';
  error: string | null;

  // 操作方法
  loadMissions: (showRefreshing?: boolean) => Promise<void>;
  setCurrentPage: (page: number) => void;
  setStatusFilter: (filter: ApiMissionStatus | 'all') => void;
  handleCancel: (missionId: number) => Promise<void>;
  handleRetry: (missionId: number) => Promise<void>;
  handleDownload: (missionId: number, missionName: string) => Promise<void>;
}

export function useApiTaskListState(
  props: UseApiTaskListStateProps = {}
): UseApiTaskListStateReturn {
  const {
    pageSize = 20,
    defaultStatusFilter = 'all',
    initialPage = 1,
  } = props;

  const [missions, setMissions] = useState<ApiMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<ApiMissionStatus | 'all'>(defaultStatusFilter);
  const [error, setError] = useState<string | null>(null);

  // 加载任务列表
  const loadMissions = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const result = await api.getApiMissions(
        currentPage,
        pageSize,
        statusFilter === 'all' ? undefined : statusFilter
      );

      setMissions(result.data.items);
      setTotal(result.data.total);
      setTotalPages(Math.ceil(result.data.total / result.data.page_size));
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentPage, pageSize, statusFilter]);

  // 页码或筛选变化时重新加载
  useEffect(() => {
    loadMissions();
  }, [loadMissions]);

  // 定时刷新：每10秒自动刷新当前页任务状态
  useEffect(() => {
    const interval = setInterval(() => {
      loadMissions(true); // 使用 refreshing 模式，避免全屏 loading
    }, 10000); // 10 秒

    return () => clearInterval(interval); // 清理定时器
  }, [loadMissions]);

  // 取消任务
  const handleCancel = useCallback(async (missionId: number) => {
    if (!confirm('确定要取消这个任务吗？')) return;

    try {
      await api.cancelApiMission(missionId);
      await loadMissions(true);
    } catch (err: any) {
      alert(err.message || '取消失败');
    }
  }, [loadMissions]);

  // 重试失败项
  const handleRetry = useCallback(async (missionId: number) => {
    try {
      const result = await api.retryApiMission(missionId);
      alert(`已重试 ${result.data.retry_count} 个失败项`);
      await loadMissions(true);
    } catch (err: any) {
      alert(err.message || '重试失败');
    }
  }, [loadMissions]);

  // 下载结果
  const handleDownload = useCallback(async (missionId: number, missionName: string) => {
    try {
      const url = api.downloadApiMissionResults(missionId);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${missionName}_results.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(err.message || '下载失败');
    }
  }, []);

  return {
    // 状态
    missions,
    loading,
    refreshing,
    currentPage,
    totalPages,
    total,
    statusFilter,
    error,

    // 操作方法
    loadMissions,
    setCurrentPage,
    setStatusFilter,
    handleCancel,
    handleRetry,
    handleDownload,
  };
}
