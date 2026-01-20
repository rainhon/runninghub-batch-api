import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Loader2, RefreshCw, Eye, CheckCircle2, XCircle, Clock, AlertCircle, Save, RotateCcw, X } from 'lucide-react';
import { api } from '../lib/api';
import { TaskStatus, type Task, type TaskResult } from '../types';

const statusConfig = {
  queued: {
    label: '队列中',
    variant: 'secondary' as const,
    icon: Clock,
  },
  pending: {
    label: '排队中',
    variant: 'secondary' as const,
    icon: Clock,
  },
  running: {
    label: '运行中',
    variant: 'default' as const,
    icon: Loader2,
  },
  success: {
    label: '成功',
    variant: 'default' as const,
    icon: CheckCircle2,
  },
  failed: {
    label: '失败',
    variant: 'destructive' as const,
    icon: XCircle,
  },
  fail: {
    label: '失败',
    variant: 'destructive' as const,
    icon: XCircle,
  },
  cancelled: {
    label: '已取消',
    variant: 'secondary' as const,
    icon: XCircle,
  },
  submit: {
    label: '已提交',
    variant: 'default' as const,
    icon: Loader2,
  },
  submit_failed: {
    label: '提交失败',
    variant: 'destructive' as const,
    icon: AlertCircle,
  },
} as const;

// 状态码到状态类型的映射
const statusCodeToStatus = (statusCode: number): keyof typeof statusConfig => {
  if (statusCode === TaskStatus.SUCCESS) return 'success';
  if (statusCode === TaskStatus.FAILED) return 'failed';
  if (statusCode === TaskStatus.RUNNING) return 'running';
  return 'pending';
};

export default function TasksPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [results, setResults] = useState<TaskResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // 保存模板相关状态
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // 重试状态
  const [retryingTaskId, setRetryingTaskId] = useState<number | null>(null);

  // 取消状态
  const [cancellingTaskId, setCancellingTaskId] = useState<number | null>(null);

  // 加载任务列表
  const loadTasks = useCallback(async (page: number = currentPage, showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const result = await api.getTaskList(page, pageSize);
      setTasks(result.data.items || []);
      setTotal(result.data.total || 0);
      setTotalPages(result.data.total_pages || 0);
      setCurrentPage(result.data.page || page);
    } catch (error: any) {
      console.error('加载任务列表失败:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentPage, pageSize]);

  // 切换页面
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    loadTasks(page);
  };

  // 查看任务结果
  const viewResults = async (task: Task) => {
    setSelectedTask(task);
    setResultsLoading(true);
    setResults([]);

    try {
      const result = await api.getTaskResults(task.id);
      setResults(result.data || []);
    } catch (error: any) {
      console.error('加载结果失败:', error.message);
    } finally {
      setResultsLoading(false);
    }
  };

  // 关闭对话框
  const closeDialog = () => {
    setSelectedTask(null);
    setResults([]);
  };

  // 保存为模板
  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      alert('请输入模板名称');
      return;
    }

    if (!selectedTask) {
      return;
    }

    setSavingTemplate(true);

    try {
      await api.saveTemplate({
        name: templateName,
        description: templateDescription,
        app_id: selectedTask.workflow,
        nodes: selectedTask.nodes_list || [],
        repeat_count: selectedTask.repeat_count,
      });

      // 保存成功后清空表单并关闭对话框
      setTemplateName('');
      setTemplateDescription('');
      setShowSaveTemplate(false);
      alert('模板保存成功！');
    } catch (error: any) {
      console.error('保存模板失败:', error.message);
      alert(`保存模板失败: ${error.message}`);
    } finally {
      setSavingTemplate(false);
    }
  };

  // 重试失败的任务
  const handleRetryTask = async (taskId: number) => {
    setRetryingTaskId(taskId);
    try {
      const result = await api.retryTask(taskId);
      alert(`已重试 ${result.data.retry_count} 次失败的执行`);
      // 刷新任务列表
      loadTasks(currentPage, true);
    } catch (error: any) {
      console.error('重试任务失败:', error.message);
      alert(`重试失败: ${error.message}`);
    } finally {
      setRetryingTaskId(null);
    }
  };

  // 取消进行中的任务
  const handleCancelTask = async (taskId: number) => {
    if (!confirm('确定要取消这个任务吗？将会移除所有排队中的执行')) {
      return;
    }

    setCancellingTaskId(taskId);
    try {
      const result = await api.cancelTask(taskId);
      alert(`已取消 ${result.data.cancelled_count} 个排队中的执行`);
      // 刷新任务列表
      loadTasks(currentPage, true);
    } catch (error: any) {
      console.error('取消任务失败:', error.message);
      alert(`取消失败: ${error.message}`);
    } finally {
      setCancellingTaskId(null);
    }
  };

  // 自动刷新函数 - 使用 useCallback 总是获取最新的 currentPage
  const autoRefresh = useCallback(() => {
    loadTasks(currentPage, true);
  }, [currentPage, loadTasks]);

  // 初始加载
  useEffect(() => {
    loadTasks();
  }, []); // 只在组件挂载时执行一次

  // 自动刷新定时器
  useEffect(() => {
    const interval = setInterval(() => {
      autoRefresh();
    }, 10000);

    return () => clearInterval(interval);
  }, [autoRefresh]); // autoRefresh 变化时重新创建定时器

  const StatusIcon = ({ status }: { status: keyof typeof statusConfig }) => {
    const { icon: Icon } = statusConfig[status];
    const props = status === 'running' ? { className: 'w-4 h-4 animate-spin' } : { className: 'w-4 h-4' };
    return <Icon {...props} />;
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">任务管理</h1>
          <p className="text-muted-foreground mt-1">查看和管理 AI 任务</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => loadTasks(currentPage, true)} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button onClick={() => navigate('/create')}>创建任务</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>任务列表</CardTitle>
          <CardDescription>当前共有 {total} 个任务，每 10 秒自动刷新</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">暂无任务</p>
              <Button onClick={() => navigate('/create')}>创建第一个任务</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">ID</TableHead>
                  <TableHead>工作流 ID</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="w-32">重复进度</TableHead>
                  <TableHead className="w-20">重试</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="w-24">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => {
                  const status = statusCodeToStatus(task.status_code);
                  const statusInfo = statusConfig[status];
                  return (
                    <TableRow key={task.id}>
                      <TableCell className="font-mono text-sm">{task.id}</TableCell>
                      <TableCell className="font-mono text-sm">{task.workflow}</TableCell>
                      <TableCell>
                        <Badge variant={statusInfo.variant} className="flex items-center gap-1 w-fit">
                          <StatusIcon status={status} />
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <span className="font-medium">{task.current_repeat}</span>
                          <span className="text-muted-foreground"> / {task.repeat_count}</span>
                          {task.repeat_count > 1 && (
                            <div className="w-full bg-secondary rounded-full h-1.5 mt-1">
                              <div
                                className="bg-primary h-1.5 rounded-full transition-all"
                                style={{ width: `${(task.current_repeat / task.repeat_count) * 100}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {task.retries > 0 && (
                          <span className="text-orange-600">
                            {task.retries} 次
                            {task.error_message && ` (${task.error_message.substring(0, 20)}...)`}
                          </span>
                        )}
                        {task.retries === 0 && '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(task.created_at).toLocaleString('zh-CN')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {(status === 'running' || status === 'success' || status === 'failed') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => viewResults(task)}
                              className="gap-1"
                            >
                              <Eye className="w-4 h-4" />
                              查看结果
                            </Button>
                          )}
                          {status === 'failed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRetryTask(task.id)}
                              disabled={retryingTaskId === task.id}
                              className="gap-1"
                            >
                              {retryingTaskId === task.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RotateCcw className="w-4 h-4" />
                              )}
                              重试
                            </Button>
                          )}
                          {(status === 'queued' || status === 'pending' || status === 'running') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelTask(task.id)}
                              disabled={cancellingTaskId === task.id}
                              className="gap-1 text-destructive hover:text-destructive"
                            >
                              {cancellingTaskId === task.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <X className="w-4 h-4" />
                              )}
                              取消
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                共 {total} 条记录，第 {currentPage} / {totalPages} 页
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  上一页
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        className="w-9"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 结果对话框 */}
      <Dialog open={!!selectedTask} onOpenChange={closeDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>任务结果 - #{selectedTask?.id}</DialogTitle>
                <DialogDescription>工作流 ID: {selectedTask?.workflow}</DialogDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSaveTemplate(true)}
                className="gap-1"
              >
                <Save className="w-4 h-4" />
                保存为模板
              </Button>
            </div>
          </DialogHeader>

          {resultsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* 显示执行统计 */}
              <div className="flex items-center gap-4 text-sm">
                <span className="font-medium">执行进度: {selectedTask?.current_repeat} / {selectedTask?.repeat_count}</span>
                <span className="text-green-600">
                  成功: {new Set(results.filter(r => r.status === 'success').map(r => r.repeat_index)).size} 次
                </span>
                <span className="text-red-600">
                  失败: {new Set(results.filter(r => r.status === 'failed').map(r => r.repeat_index)).size} 次
                </span>
              </div>

              {/* 按 repeat_index 分组显示结果 */}
              {results.length > 0 ? (
                Object.entries(
                  results.reduce((groups, result) => {
                        if (!groups[result.repeat_index]) {
                          groups[result.repeat_index] = [];
                        }
                        groups[result.repeat_index].push(result);
                        return groups;
                      }, {} as Record<number, typeof results>)
                )
                  .sort(([a], [b]) => parseInt(a) - parseInt(b)) // 按执行次数排序
                  .map(([repeatIndex, groupResults]) => {
                    const firstResult = groupResults[0];
                    const status = firstResult.status;

                    // 根据状态显示不同的图标和文本
                    let statusIcon;
                    let statusText;
                    let statusColor;
                    let showFiles = false;
                    let showError = false;

                    if (status === 'success') {
                      statusIcon = <CheckCircle2 className="w-5 h-5 text-green-600" />;
                      statusText = `第 ${repeatIndex} 次执行成功`;
                      statusColor = 'text-green-600';
                      showFiles = true;
                    } else if (status === 'fail' || status === 'failed' || status === 'submit_failed') {
                      statusIcon = <XCircle className="w-5 h-5 text-destructive" />;
                      if (status === 'submit_failed') {
                        statusText = `第 ${repeatIndex} 次提交失败`;
                      } else {
                        statusText = `第 ${repeatIndex} 次执行失败`;
                      }
                      statusColor = 'text-destructive';
                      showError = true;
                    } else if (status === 'submit') {
                      statusIcon = <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
                      statusText = `第 ${repeatIndex} 次执行中`;
                      statusColor = 'text-blue-600';
                    } else if (status === 'pending') {
                      statusIcon = <Clock className="w-5 h-5 text-orange-600" />;
                      statusText = `第 ${repeatIndex} 次排队中`;
                      statusColor = 'text-orange-600';
                    } else {
                      statusIcon = <AlertCircle className="w-5 h-5 text-muted-foreground" />;
                      statusText = `第 ${repeatIndex} 次 ${status}`;
                      statusColor = 'text-muted-foreground';
                    }

                    return (
                      <Card key={repeatIndex} className={showError ? 'border-destructive' : ''}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              {statusIcon}
                              <span className={statusColor}>{statusText}</span>
                              {showFiles && groupResults.length > 1 && (
                                <span className="text-sm font-normal text-muted-foreground">
                                  ({groupResults.length} 个文件)
                                </span>
                              )}
                            </CardTitle>
                            {firstResult.created_at && (
                              <CardDescription>
                                {new Date(firstResult.created_at).toLocaleString('zh-CN')}
                              </CardDescription>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          {showFiles ? (
                            <div className="space-y-4">
                              {groupResults.map((result) => (
                                <div key={result.id} className="space-y-2 p-3 bg-muted rounded-lg">
                                  <div>
                                    <span className="font-medium text-sm">文件 URL: </span>
                                    <a
                                      href={result.file_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-primary hover:underline break-all ml-2"
                                    >
                                      {result.file_url}
                                    </a>
                                  </div>

                                  {/* 图片预览 */}
                                  {result.file_url && result.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) && (
                                    <div className="mt-2">
                                      <img
                                        src={result.file_url}
                                        alt={`Result ${result.id}`}
                                        className="max-w-full h-auto rounded-md border max-h-48 object-contain"
                                      />
                                    </div>
                                  )}

                                  {/* 视频预览 */}
                                  {result.file_url && result.file_url.match(/\.(mp4|webm|ogg)$/i) && (
                                    <div className="mt-2">
                                      <video
                                        src={result.file_url}
                                        controls
                                        className="max-w-full h-auto rounded-md border max-h-48"
                                      />
                                    </div>
                                  )}

                                  {/* 音频预览 */}
                                  {result.file_url && result.file_url.match(/\.(mp3|wav|ogg)$/i) && (
                                    <div className="mt-2">
                                      <audio
                                        src={result.file_url}
                                        controls
                                        className="w-full"
                                      />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : showError ? (
                            <div className="text-sm">
                              <p className="font-medium text-destructive">失败原因:</p>
                              <p className="text-muted-foreground mt-1">{firstResult.error_message || '未知错误'}</p>
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">
                              {status === 'pending' && '等待执行...'}
                              {status === 'submit' && '任务执行中，请稍候...'}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })
              ) : (
                <div className="text-center py-12 text-muted-foreground">暂无执行结果</div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 保存模板对话框 */}
      <Dialog open={showSaveTemplate} onOpenChange={setShowSaveTemplate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>保存为模板</DialogTitle>
            <DialogDescription>
              将当前任务配置保存为模板，方便下次快速创建相同任务
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="templateName">
                模板名称 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="templateName"
                placeholder="例如：AI 绘画任务模板"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="templateDescription">模板描述</Label>
              <textarea
                id="templateDescription"
                className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="简要描述此模板的用途"
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p><strong>App ID:</strong> {selectedTask?.workflow}</p>
              <p><strong>节点数量:</strong> {selectedTask?.nodes_list?.length || 0}</p>
              <p><strong>重复次数:</strong> {selectedTask?.repeat_count || 1}</p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowSaveTemplate(false)}>
              取消
            </Button>
            <Button onClick={handleSaveTemplate} disabled={savingTemplate}>
              {savingTemplate ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                '保存模板'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
