import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Loader2, RefreshCw, Download, RotateCcw, XCircle, ArrowLeft, Image as ImageIcon, ExternalLink, Clock, AlertCircle, Copy, Check } from 'lucide-react';
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
  scheduled: { label: '已定时', color: 'bg-purple-500', icon: <Loader2 className="w-3 h-3" /> },
};

// 任务类型名称映射
const TASK_TYPE_NAMES: Record<string, string> = {
  text_to_image: '文生图',
  image_to_image: '图生图',
  text_to_video: '文生视频',
  image_to_video: '图生视频',
  frame_to_video: '首尾帧生视频',
};

// 模型名称映射
const MODEL_NAMES: Record<string, string> = {
  sora: 'Sora',
  sorapro: 'Sora Pro',
  banana: 'Banana',
  veo: 'Veo',
  veopro: 'Veo Pro',
};

// 图片预览组件
function ImagePreview({ url }: { url: string }) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <>
      <div
        className="inline-block cursor-pointer group"
        onClick={() => setShowPreview(true)}
      >
        <div className="relative w-20 h-20">
          <img
            src={url}
            alt="预览"
            className="w-full h-full object-cover rounded border border-border"
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
            <ExternalLink className="h-4 w-4 text-white" />
          </div>
        </div>
      </div>

      {/* 图片预览对话框 */}
      {showPreview && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowPreview(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={url}
              alt="预览图片"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
              onClick={() => setShowPreview(false)}
            >
              ✕
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

// 格式化重试剩余时间
function formatRetryTime(nextRetryAt: string): { text: string; isUrgent: boolean } {
  try {
    const now = new Date();
    const retryTime = new Date(nextRetryAt);
    const diffMs = retryTime.getTime() - now.getTime();

    if (diffMs <= 0) {
      return { text: '即将重试', isUrgent: true };
    }

    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);

    if (diffSecs < 60) {
      return { text: `${diffSecs}秒后重试`, isUrgent: false };
    } else if (diffMins < 60) {
      return { text: `${diffMins}分钟后重试`, isUrgent: false };
    } else {
      return { text: `${diffHours}小时${diffMins % 60}分钟后重试`, isUrgent: false };
    }
  } catch (e) {
    return { text: '计算中...', isUrgent: false };
  }
}

// 输入参数渲染组件
function RenderInputParams({ inputParams }: { inputParams: string }) {
  try {
    const params = JSON.parse(inputParams || '{}');

    return (
      <div className="space-y-1">
        {Object.entries(params).map(([key, value]) => {
          // 特殊处理不同的参数类型
          if (key === 'imageUrls' && Array.isArray(value)) {
            return (
              <div key={key} className="flex flex-col gap-1">
                <span className="font-medium text-foreground">{key}:</span>
                {value.length === 0 ? (
                  <span className="text-muted-foreground">(空数组)</span>
                ) : (
                  <div className="space-y-1">
                    {value.map((url, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">[{index}]:</span>
                        {url ? <ImagePreview url={url} /> : <span className="text-muted-foreground">(空)</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          } else if (key === 'imageUrl' && typeof value === 'string') {
            return (
              <div key={key} className="flex flex-col gap-1">
                <span className="font-medium text-foreground">{key}:</span>
                {value ? <ImagePreview url={value} /> : <span className="text-muted-foreground">(空)</span>}
              </div>
            );
          } else if (key === 'prompt' && typeof value === 'string') {
            return <CopyableText key={key} label={key} value={value} maxLength={100} />;
          } else {
            return (
              <div key={key} className="flex flex-col gap-1">
                <span className="font-medium text-foreground">{key}:</span>
                <span className="text-muted-foreground">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            );
          }
        })}
      </div>
    );
  } catch (e) {
    return (
      <pre className="text-xs overflow-x-auto">
        {inputParams || '(空)'}
      </pre>
    );
  }
}

// 可复制文本组件
function CopyableText({ label, value, maxLength }: { label: string; value: string; maxLength: number }) {
  const [copied, setCopied] = useState(false);
  const isTruncated = value.length > maxLength;
  const displayText = isTruncated ? value.substring(0, maxLength) + '...' : value;

  const handleCopy = async () => {
    // 成功后设置状态
    const onSuccess = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    // 优先使用 Clipboard API（现代浏览器，需要 HTTPS 或 localhost）
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(value);
        onSuccess();
        return;
      } catch (err) {
        console.warn('Clipboard API 失败，尝试备用方法:', err);
      }
    }

    // 备用方法：使用 textarea + document.execCommand
    try {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.left = '-999999px';
      textarea.style.top = '-999999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);

      if (successful) {
        onSuccess();
      } else {
        console.error('execCommand 复制失败');
      }
    } catch (err) {
      console.error('复制功能失败:', err);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="font-medium text-foreground">{label}:</span>
      <div
        className={`text-muted-foreground cursor-pointer hover:text-foreground transition-colors relative group ${isTruncated ? 'flex items-center gap-1' : ''}`}
        onClick={handleCopy}
        title={value} // 鼠标悬停显示完整内容
      >
        <span className={isTruncated ? 'flex-1' : ''}>{displayText}</span>
        {copied ? (
          <Check className="w-3 h-3 text-green-500 shrink-0" />
        ) : (
          <Copy className="w-3 h-3 opacity-0 group-hover:opacity-50 shrink-0" />
        )}
      </div>
    </div>
  );
}

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

    const taskType = mission?.task_type;
    let extension = 'png'; // 默认图片格式

    // 根据任务类型确定文件扩展名
    if (taskType === 'text_to_video' || taskType === 'image_to_video' || taskType === 'frame_to_video') {
      extension = 'mp4';
    }

    // 也可以从 URL 中提取扩展名
    const urlMatch = item.result_url.match(/\.([a-z0-9]+)(?:\?|$)/i);
    if (urlMatch) {
      extension = urlMatch[1];
    }

    const link = document.createElement('a');
    link.href = item.result_url;
    link.download = `result_${item.item_index}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 渲染子任务卡片
  const renderItemCard = (item: ApiMissionItem) => {
    const statusConfig = STATUS_CONFIG[item.status];
    const taskType = mission?.task_type;

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
            {/* 重试状态信息 */}
            {(item.status === 'pending' || item.status === 'failed') && (item.retry_count ?? 0) > 0 && (
              <div className="text-sm p-2 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-md">
                <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="font-medium">重试状态: {item.retry_count}/7</span>
                </div>
                {item.next_retry_at && (
                  <div className="flex items-center gap-2 mt-1 text-orange-600 dark:text-orange-500 text-xs">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span>
                      下次重试: {new Date(item.next_retry_at).toLocaleString('zh-CN')}
                      {(() => {
                        const { text } = formatRetryTime(item.next_retry_at);
                        return ` (${text})`;
                      })()}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 输入参数 */}
            <div className="text-sm">
              <span className="text-muted-foreground">输入参数:</span>
              <div className="mt-1 p-2 bg-muted rounded text-xs">
                <RenderInputParams inputParams={item.input_params} />
              </div>
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
                  {taskType && (taskType === 'text_to_video' || taskType === 'image_to_video' || taskType === 'frame_to_video') ? (
                    // 视频任务使用 video 标签
                    <video
                      src={item.result_url}
                      controls
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : (
                    // 图片任务使用 img 标签
                    <img
                      src={item.result_url}
                      alt={`结果 #${item.item_index}`}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  )}
                  {/* 加载失败提示 */}
                  <div className="absolute inset-0 items-center justify-center bg-muted text-muted-foreground text-xs hidden" style={{ display: 'none' }}>
                    加载失败
                  </div>
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
                <span className="text-muted-foreground">模型:</span>{' '}
                <span className="font-medium">{MODEL_NAMES[mission.model_id || ''] || '-'}</span>
              </div>
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
