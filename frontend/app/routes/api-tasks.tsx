/**
 * API 任务列表页面（重构版）
 * 使用新组件和 hooks，代码从 380 行减少到约 150 行
 */

import { useNavigate, useSearchParams } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Loader2, RefreshCw, Download, Trash2, RotateCcw, XCircle, Plus, Eye } from 'lucide-react';
import { useApiTaskListState } from '../hooks/useApiTaskListState';
import { ApiStatusBadge, ApiPagination, ApiFilterButtons } from '../components/common';
import { getTaskTypeName } from '../constants/statusConfig';

export default function ApiTasksPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const pageParam = searchParams.get('page');
  const initialPage = pageParam ? parseInt(pageParam, 10) : 1;

  // 使用自定义 hook 管理列表状态
  const {
    missions,
    loading,
    refreshing,
    currentPage,
    totalPages,
    total,
    statusFilter,
    error,
    loadMissions,
    setCurrentPage,
    setStatusFilter,
    handleCancel,
    handleRetry,
    handleDownload,
  } = useApiTaskListState({ pageSize: 20, initialPage });

  // 删除任务（保留在页面中，因为涉及业务逻辑）
  const handleDelete = async (missionId: number) => {
    if (!confirm('确定要删除这个任务吗？此操作不可恢复。')) return;

    try {
      const { api } = await import('../lib/api');
      await api.deleteApiMission(missionId);
      // 使用 loadMissions 刷新，不重新加载整个页面
      await loadMissions(true);
    } catch (err: any) {
      alert(err.message || '删除失败');
    }
  };

  // 渲染任务卡片
  const renderMissionCard = (mission: ApiMission) => {
    const isRunning = mission.status === 'running' || mission.status === 'queued';

    // 获取模型显示名称
    const getModelDisplayName = (modelId?: string): string => {
      if (!modelId) return '-';
      const names: Record<string, string> = {
        sora: 'Sora',
        sorapro: 'Sora Pro',
        banana: 'Banana',
        veo: 'Veo',
        veopro: 'Veo Pro'
      };
      return names[modelId] || modelId;
    };

    return (
      <Card key={mission.id} className="hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">{mission.name}</CardTitle>
              {mission.description && (
                <CardDescription className="mt-1">{mission.description}</CardDescription>
              )}
            </div>
            <ApiStatusBadge status={mission.status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 任务信息 */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">模型:</span>{' '}
                <span className="font-medium">{getModelDisplayName(mission.model_id)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">任务类型:</span>{' '}
                <span className="font-medium">{getTaskTypeName(mission.task_type)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">创建时间:</span>{' '}
                <span className="font-medium">
                  {new Date(mission.created_at).toLocaleString('zh-CN')}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">总数:</span>{' '}
                <span className="font-medium">{mission.total_count}</span>
              </div>
              <div>
                <span className="text-muted-foreground">已完成:</span>{' '}
                <span className="font-medium text-green-600">{mission.completed_count}</span>
              </div>
              {mission.failed_count > 0 && (
                <div>
                  <span className="text-muted-foreground">失败:</span>{' '}
                  <span className="font-medium text-red-600">{mission.failed_count}</span>
                </div>
              )}
              {/* 定时任务：显示定时执行时间 */}
              {mission.scheduled_time && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">定时执行:</span>{' '}
                  <span className="font-medium text-purple-600">
                    {new Date(mission.scheduled_time).toLocaleString('zh-CN')}
                  </span>
                </div>
              )}
              {/* 运行中任务：显示开始执行时间 */}
              {mission.started_at && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">开始时间:</span>{' '}
                  <span className="font-medium">
                    {new Date(mission.started_at).toLocaleString('zh-CN')}
                  </span>
                </div>
              )}
            </div>

            {/* 进度条 */}
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>进度</span>
                <span>{mission.progress.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${mission.progress}%` }}
                />
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => navigate(`/api-tasks/${mission.id}`)}
              >
                <Eye className="w-3 h-3 mr-1" />
                查看详情
              </Button>

              {isRunning && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCancel(mission.id)}
                >
                  <XCircle className="w-3 h-3 mr-1" />
                  取消
                </Button>
              )}

              {mission.failed_count > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRetry(mission.id)}
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  重试
                </Button>
              )}

              {mission.status === 'completed' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownload(mission.id, mission.name)}
                >
                  <Download className="w-3 h-3 mr-1" />
                  下载
                </Button>
              )}

              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => handleDelete(mission.id)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">API 任务</h1>
          <p className="text-muted-foreground mt-1">
            管理和监控批量 API 任务
            <span className="ml-2 text-xs text-muted-foreground/70">
              (每 10 秒自动刷新)
            </span>
          </p>
        </div>
        <Button onClick={() => navigate('/api-create')}>
          <Plus className="w-4 h-4 mr-2" />
          创建任务
        </Button>
      </div>

      {/* 筛选和刷新 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 flex-wrap">
            <ApiFilterButtons
              activeFilter={statusFilter}
              onChange={(filter) => {
                setStatusFilter(filter);
              }}
            />
            <div className="ml-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={() => loadMissions(true)}
                disabled={refreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                刷新
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 错误提示 */}
      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-md mb-6">
          {error}
        </div>
      )}

      {/* 加载中 */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* 任务列表 */}
          {missions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                暂无任务，点击上方"创建任务"开始使用
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {missions.map(renderMissionCard)}
              </div>

              {/* 分页 */}
              <div className="mt-6">
                <ApiPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  total={total}
                  pageSize={20}
                  onPageChange={(page) => {
                    // 更新 URL 参数
                    if (page === 1) {
                      searchParams.delete('page');
                    } else {
                      searchParams.set('page', page.toString());
                    }
                    setSearchParams(searchParams);
                    // 更新当前页（会触发 hook 中的 loadMissions）
                    setCurrentPage(page);
                  }}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// 导入类型
import type { ApiMission } from '../types';
