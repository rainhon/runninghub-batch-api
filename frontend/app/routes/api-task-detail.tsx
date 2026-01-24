import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Loader2, RefreshCw, Download, RotateCcw, XCircle, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { api } from '../lib/api';
import type { ApiMissionDetail, ApiMissionItem } from '../types';

// 状态配置
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: '待处理', color: 'bg-gray-400', icon: null },
  processing: { label: '处理中', color: 'bg-blue-500', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  completed: { label: '已完成', color: 'bg-green-500', icon: null },
  failed: { label: '失败', color: 'bg-red-500', icon: <XCircle className="w-3 h-3" /> },
  queued: { label: '排队中', color: 'bg-gray-500', icon: <Loader2 className="w-3 h-3" /> },
  running: { label: '运行中', color: 'bg-blue-500', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  cancelled: { label: '已取消', color: 'bg-yellow-500', icon: <XCircle className="w-3 h-3" /> },
};

// 任务类型名称映射
const TASK_TYPE_NAMES: Record<string, string> = {
  text_to_image: '文生图',
  image_to_image: '图生图',
  text_to_video: '文生视频',
  image_to_video: '图生视频',
};

export default function ApiTaskDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const missionId = parseInt(id || '0');

  const [mission, setMission] = useState<ApiMissionDetail | null>(null);
  const [items, setItems] = useState<ApiMissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 加载任务详情和子任务列表
  const loadDetail = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const [missionResult, itemsResult] = await Promise.all([
        api.getApiMissionDetail(missionId),
        api.getApiMissionItems(missionId),
      ]);

      setMission(missionResult.data);
      setItems(itemsResult.data);
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 初始加载
  useEffect(() => {
    if (missionId) {
      loadDetail();
    }
  }, [missionId]);

  // 重试失败项
  const handleRetry = async () => {
    try {
      const result = await api.retryApiMission(missionId);
      alert(`已重试 ${result.data.retry_count} 个失败项`);
      await loadDetail(true);
    } catch (err: any) {
      alert(err.message || '重试失败');
    }
  };

  // 下载单个结果
  const handleDownloadItem = (item: ApiMissionItem) => {
    if (!item.result_url) return;

    const link = document.createElement('a');
    link.href = item.result_url;
    link.download = `result_${item.item_index}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 渲染子任务卡片
  const renderItemCard = (item: ApiMissionItem) => {
    const statusConfig = STATUS_CONFIG[item.status];

    return (
      <Card key={item.id} className="hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle className="text-base">子任务 #{item.item_index}</CardTitle>
            <Badge className={`${statusConfig.color} text-white`}>
              <span className="flex items-center gap-1">
                {statusConfig.icon}
                {statusConfig.label}
              </span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* 输入参数 */}
            <div className="text-sm">
              <span className="text-muted-foreground">输入参数:</span>
              <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                {JSON.stringify(JSON.parse(item.input_json || '{}'), null, 2)}
              </pre>
            </div>

            {/* 错误信息 */}
            {item.status === 'failed' && item.error_message && (
              <div className="text-sm">
                <span className="text-muted-foreground">错误信息:</span>
                <p className="mt-1 text-destructive text-xs">{item.error_message}</p>
              </div>
            )}

            {/* 结果 */}
            {item.status === 'completed' && item.result_url && (
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">结果预览:</span>
                </div>
                <div className="relative aspect-video bg-muted rounded overflow-hidden">
                  <img
                    src={item.result_url}
                    alt={`结果 #${item.item_index}`}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ccc" width="100" height="100"/%3E%3Ctext fill="%23666" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle"%3E加载失败%3C/text%3E%3C/svg%3E';
                    }}
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => handleDownloadItem(item)}
                >
                  <Download className="w-3 h-3 mr-1" />
                  下载结果
                </Button>
              </div>
            )}

            {/* 重试单个失败项 */}
            {item.status === 'failed' && (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={handleRetry}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                重试
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !mission) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="p-4 bg-destructive/10 text-destructive rounded-md">
          {error || '任务不存在'}
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[mission.status];
  const hasFailedItems = items.some(item => item.status === 'failed');

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* 返回按钮 */}
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => navigate('/api-tasks')}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        返回列表
      </Button>

      {/* 任务详情 */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-2xl">{mission.name}</CardTitle>
              {mission.description && (
                <CardDescription className="mt-1">{mission.description}</CardDescription>
              )}
            </div>
            <Badge className={`${statusConfig.color} text-white text-base px-3 py-1`}>
              <span className="flex items-center gap-2">
                {statusConfig.icon}
                {statusConfig.label}
              </span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 任务信息 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">任务类型:</span>{' '}
                <span className="font-medium">{TASK_TYPE_NAMES[mission.task_type]}</span>
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
              <div>
                <span className="text-muted-foreground">失败:</span>{' '}
                <span className="font-medium text-red-600">{mission.failed_count}</span>
              </div>
            </div>

            {/* 进度条 */}
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>总进度</span>
                <span>{mission.completed_count}/{mission.total_count}</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${mission.total_count > 0 ? (mission.completed_count / mission.total_count) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => loadDetail(true)}
                disabled={refreshing}
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                刷新
              </Button>

              {hasFailedItems && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRetry}
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  重试失败项
                </Button>
              )}

              {mission.status === 'completed' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const url = api.downloadApiMissionResults(missionId);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `${mission.name}_results.zip`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                >
                  <Download className="w-3 h-3 mr-1" />
                  下载全部结果
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 子任务列表 */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">子任务列表</h2>
        <span className="text-sm text-muted-foreground">
          共 {items.length} 个子任务
        </span>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            暂无子任务
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(renderItemCard)}
        </div>
      )}
    </div>
  );
}
