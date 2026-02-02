import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Loader2, RefreshCw, Download, Trash2, RotateCcw, XCircle, Plus, Eye } from 'lucide-react';
import { api } from '../lib/api';
import type { AppMission, AppMissionStatus } from '../types';

// 状态配置
const STATUS_CONFIG: Record<AppMissionStatus, { label: string; color: string; icon: React.ReactNode }> = {
  queued: { label: '排队中', color: 'bg-gray-500', icon: <Loader2 className="w-3 h-3" /> },
  running: { label: '运行中', color: 'bg-blue-500', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  completed: { label: '已完成', color: 'bg-green-500', icon: null },
  cancelled: { label: '已取消', color: 'bg-yellow-500', icon: <XCircle className="w-3 h-3" /> },
  failed: { label: '失败', color: 'bg-red-500', icon: <XCircle className="w-3 h-3" /> },
};

export default function AppTasksPage() {
  const navigate = useNavigate();
  const [missions, setMissions] = useState<AppMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<AppMissionStatus | 'all'>('all');
  const [error, setError] = useState<string | null>(null);

  // 加载任务列表
  const loadMissions = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const result = await api.getAppMissions(
        currentPage,
        20,
        statusFilter === 'all' ? undefined : statusFilter
      );

      setMissions(result.data.missions);
      setTotal(result.data.total);
      setTotalPages(Math.ceil(result.data.total / result.data.page_size));
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 初始加载
  useEffect(() => {
    loadMissions();
  }, [currentPage, statusFilter]);

  // 取消任务
  const handleCancel = async (missionId: number) => {
    if (!confirm('确定要取消这个任务吗？')) return;

    try {
      await api.cancelAppMission(missionId);
      await loadMissions(true);
    } catch (err: any) {
      alert(err.message || '取消失败');
    }
  };

  // 重试失败项
  const handleRetry = async (missionId: number) => {
    try {
      const result = await api.retryAppMission(missionId);
      alert(`已重试 ${result.data.retry_count} 个失败项`);
      await loadMissions(true);
    } catch (err: any) {
      alert(err.message || '重试失败');
    }
  };

  // 下载结果
  const handleDownload = async (missionId: number, missionName: string) => {
    try {
      const url = api.downloadAppMissionResults(missionId);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${missionName}_results.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(err.message || '下载失败');
    }
  };

  // 删除任务
  const handleDelete = async (missionId: number) => {
    if (!confirm('确定要删除这个任务吗？此操作不可恢复。')) return;

    try {
      await api.deleteAppMission(missionId);
      await loadMissions(true);
    } catch (err: any) {
      alert(err.message || '删除失败');
    }
  };

  // 渲染任务卡片
  const renderMissionCard = (mission: AppMission) => {
    const statusConfig = STATUS_CONFIG[mission.status];
    const isRunning = mission.status === 'running' || mission.status === 'queued';
    const progress = mission.total_count > 0
      ? (mission.completed_count / mission.total_count) * 100
      : 0;

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
            <Badge className={`${statusConfig.color} text-white`}>
              <span className="flex items-center gap-1">
                {statusConfig.icon}
                {statusConfig.label}
              </span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 任务信息 */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">App ID:</span>{' '}
                <span className="font-medium">{mission.app_id}</span>
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
            </div>

            {/* 进度条 */}
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>进度</span>
                <span>{progress.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => navigate(`/app-tasks/${mission.id}`)}
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">App 任务</h1>
          <p className="text-muted-foreground mt-1">管理和监控批量 App 任务</p>
        </div>
        <Button onClick={() => navigate('/app-create')}>
          <Plus className="w-4 h-4 mr-2" />
          创建任务
        </Button>
      </div>

      {/* 筛选和刷新 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">状态筛选:</span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={statusFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => {
                    setStatusFilter('all');
                    setCurrentPage(1);
                  }}
                >
                  全部 ({total})
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === 'running' ? 'default' : 'outline'}
                  onClick={() => {
                    setStatusFilter('running');
                    setCurrentPage(1);
                  }}
                >
                  运行中
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === 'completed' ? 'default' : 'outline'}
                  onClick={() => {
                    setStatusFilter('completed');
                    setCurrentPage(1);
                  }}
                >
                  已完成
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === 'failed' ? 'default' : 'outline'}
                  onClick={() => {
                    setStatusFilter('failed');
                    setCurrentPage(1);
                  }}
                >
                  失败
                </Button>
              </div>
            </div>

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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {missions.map(renderMissionCard)}
            </div>
          )}

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
              >
                上一页
              </Button>
              <span className="text-sm text-muted-foreground">
                第 {currentPage} / {totalPages} 页
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
              >
                下一页
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
