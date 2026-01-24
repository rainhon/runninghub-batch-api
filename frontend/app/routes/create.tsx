import { useState, type FormEvent, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Loader2, CheckCircle2, Plus, Save } from 'lucide-react';
import { api } from '../lib/api';
import type { NodeInfo, TaskTemplate, MediaFile } from '../types';

export default function CreateTaskPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [appId, setAppId] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [nodeValues, setNodeValues] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [repeatCount, setRepeatCount] = useState(1);  // 重复次数

  // 媒体文件信息缓存
  const [mediaFilesCache, setMediaFilesCache] = useState<Record<string, MediaFile>>({});

  // 模板相关状态
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // 从模板加载
  useEffect(() => {
    const template = location.state?.template as TaskTemplate;
    if (template) {
      setAppId(template.appId);
      setNodes(template.nodes);
      setRepeatCount(template.repeatCount);

      // 初始化节点值
      const initialValues: Record<string, any> = {};
      template.nodes.forEach((node) => {
        if (node.fieldValue !== undefined) {
          const key = `${node.nodeId}_${node.fieldName}`;
          initialValues[key] = node.fieldValue;
        }
      });
      setNodeValues(initialValues);

      // 加载媒体文件信息
      loadMediaFilesForNodes(template.nodes);

      setSuccessMessage(`已加载模板: ${template.name}`);
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    }
  }, [location.state]);

  // 加载节点中的媒体文件信息（通用函数）
  const loadMediaFilesForNodes = async (nodes: NodeInfo[]) => {
    const filenames: string[] = [];

    // 提取所有媒体类型的文件名
    nodes.forEach((node) => {
      if (node.fieldValue && ['IMAGE', 'AUDIO', 'VIDEO'].includes(node.fieldType)) {
        filenames.push(node.fieldValue);
      }
    });

    if (filenames.length === 0) {
      return;
    }

    try {
      const result = await api.getMediaFilesByNames(filenames);
      const cache: Record<string, MediaFile> = {};

      // 建立文件名到媒体文件信息的映射
      (result.data || []).forEach((file) => {
        cache[file.runninghubFilename] = file;
      });

      setMediaFilesCache(cache);
    } catch (error: any) {
      console.error('加载媒体文件信息失败:', error.message);
    }
  };

  // 加载应用节点配置
  const loadAppNodes = async () => {
    if (!appId.trim()) {
      setError('请输入 App ID');
      return;
    }

    setLoading(true);
    setError(null);
    setNodes([]);
    setNodeValues({});

    try {
      const result = await api.getAppNodes(appId);

      // 转换 API 返回的节点为前端格式
      const transformedNodes: NodeInfo[] = (result.data || []).map((node: any) => ({
        nodeId: node.nodeId,
        fieldName: node.fieldName,
        fieldType: node.fieldType,
        fieldValue: node.fieldValue,
        nodeName: node.nodeName || node.fieldName,
        required: false, // 后端未提供，默认为非必填
      }));

      setNodes(transformedNodes);

      // 初始化节点值
      const initialValues: Record<string, any> = {};
      transformedNodes.forEach((node) => {
        if (node.fieldValue !== undefined) {
          initialValues[node.nodeId] = node.fieldValue;
        }
      });
      setNodeValues(initialValues);

      // 加载媒体文件信息
      loadMediaFilesForNodes(transformedNodes);
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取节点唯一标识
  const getNodeKey = (node: NodeInfo) => `${node.nodeId}_${node.fieldName}`;

  // 更新节点值
  const updateNodeValue = (nodeKey: string, value: any) => {
    setNodeValues((prev) => ({ ...prev, [nodeKey]: value }));
  };

  // 上传文件
  const uploadFile = async (nodeKey: string, file: File) => {
    try {
      setUploadProgress((prev) => ({ ...prev, [nodeKey]: 0 }));

      const result = await api.uploadFile(file, (progress) => {
        setUploadProgress((prev) => ({ ...prev, [nodeKey]: progress }));
      });

      updateNodeValue(nodeKey, result.data.fileName);

      // 更新媒体文件缓存
      if (result.data.fileId) {
        setMediaFilesCache((prev) => ({
          ...prev,
          [result.data.fileName]: {
            id: result.data.fileId,
            originalName: file.name,
            fileHash: result.data.fileHash,
            fileSize: file.size,
            runninghubFilename: result.data.fileName,
            mimeType: file.type,
            uploadCount: 1,
            createdAt: new Date().toISOString(),
          },
        }));
      }

      setUploadProgress((prev) => ({ ...prev, [nodeKey]: -1 })); // 完成
    } catch (err: any) {
      setError(err.message || '上传失败');
      setUploadProgress((prev) => ({ ...prev, [nodeKey]: -2 })); // 失败
    }
  };

  // 提交表单
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setSubmitting(true);

    try {
      // 构建提交的节点列表
      const submitNodes: any[] = nodes.map((node) => {
        const key = getNodeKey(node);
        return {
          nodeId: node.nodeId,
          fieldName: node.fieldName,
          fieldType: node.fieldType,
          fieldValue: nodeValues[key] || node.fieldValue,
        };
      });

      const data = { app_id: appId, nodes: submitNodes, repeat_count: repeatCount };
      await api.submitTask(data);

      setSuccessMessage('任务提交成功！正在跳转到任务列表...');
      setTimeout(() => {
        navigate('/tasks');
      }, 1500);
    } catch (err: any) {
      setError(err.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 保存模板
  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      setError('请输入模板名称');
      return;
    }

    if (!appId.trim() || nodes.length === 0) {
      setError('请先加载应用配置');
      return;
    }

    setSavingTemplate(true);
    setError(null);

    try {
      const templateNodes = nodes.map((node) => {
        const key = getNodeKey(node);
        return {
          ...node,
          fieldValue: nodeValues[key] || node.fieldValue,
        };
      });

      await api.saveTemplate({
        name: templateName,
        description: templateDescription,
        app_id: appId,
        nodes: templateNodes,
        repeat_count: repeatCount,
      });

      setSuccessMessage('模板保存成功！');
      setShowSaveTemplate(false);
      setTemplateName('');
      setTemplateDescription('');

      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err: any) {
      setError(err.message || '保存模板失败');
    } finally {
      setSavingTemplate(false);
    }
  };

  // 渲染节点输入
  const renderNodeInput = (node: NodeInfo) => {
    const key = getNodeKey(node);
    const value = nodeValues[key];
    const uploading = uploadProgress[key] >= 0;

    if (node.fieldType === 'IMAGE' || node.fieldType === 'AUDIO' || node.fieldType === 'VIDEO') {
      const mediaFile = value ? mediaFilesCache[value] : null;

      return (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              type="file"
              accept={
                node.fieldType === 'IMAGE'
                  ? 'image/*'
                  : node.fieldType === 'AUDIO'
                  ? 'audio/*'
                  : 'video/*'
              }
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadFile(key, file);
              }}
              disabled={uploading}
            />
            {value && !uploading && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {mediaFile ? '已加载' : '已上传'}
              </Badge>
            )}
          </div>
          {uploading && uploadProgress[key] !== -1 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              上传中 {uploadProgress[key]}%
            </div>
          )}
          {/* 媒体文件预览 */}
          {mediaFile && (
            <div className="mt-3 p-3 bg-muted rounded-lg space-y-2">
              <div className="text-sm">
                <div className="font-medium">文件信息:</div>
                <div className="text-muted-foreground">原文件名: {mediaFile.originalName}</div>
                <div className="text-muted-foreground">文件大小: {(mediaFile.fileSize / 1024).toFixed(2)} KB</div>
              </div>
              {node.fieldType === 'IMAGE' && (
                <img
                  src={api.getMediaFile(mediaFile.id)}
                  alt={mediaFile.originalName}
                  className="max-w-full h-auto rounded-md border max-h-48 object-contain"
                />
              )}
              {node.fieldType === 'VIDEO' && (
                <video
                  src={api.getMediaFile(mediaFile.id)}
                  controls
                  className="max-w-full h-auto rounded-md border max-h-48"
                />
              )}
              {node.fieldType === 'AUDIO' && (
                <audio
                  src={api.getMediaFile(mediaFile.id)}
                  controls
                  className="w-full"
                />
              )}
            </div>
          )}
        </div>
      );
    }

    if (node.fieldType === 'TEXTAREA') {
      return (
        <textarea
          className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder={`请输入${node.nodeName}`}
          value={value || ''}
          onChange={(e) => updateNodeValue(key, e.target.value)}
        />
      );
    }

    if (node.fieldType === 'NUMBER') {
      return (
        <Input
          type="number"
          placeholder={`请输入${node.nodeName}`}
          value={value || ''}
          onChange={(e) => updateNodeValue(key, e.target.value)}
        />
      );
    }

    // 默认文本输入
    return (
      <Input
        type="text"
        placeholder={`请输入${node.nodeName}`}
        value={value || ''}
        onChange={(e) => updateNodeValue(key, e.target.value)}
      />
    );
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>创建 App 任务</CardTitle>
          <CardDescription>输入 App ID，配置节点参数后提交任务</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* App ID 输入 */}
            <div className="space-y-2">
              <Label htmlFor="appId">
                App ID <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="appId"
                  placeholder="请输入 RunningHub AI 应用的 App ID"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                />
                <Button type="button" onClick={loadAppNodes} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  加载配置
                </Button>
              </div>
            </div>

            {/* 重复次数输入 */}
            <div className="space-y-2">
              <Label htmlFor="repeatCount">
                重复执行次数
              </Label>
              <Input
                id="repeatCount"
                type="number"
                min="1"
                max="100"
                placeholder="任务重复执行次数（默认1次）"
                value={repeatCount}
                onChange={(e) => setRepeatCount(Math.max(1, parseInt(e.target.value) || 1))}
              />
              <p className="text-xs text-muted-foreground">
                任务将依次执行指定次数，最多支持2个任务并行运行
              </p>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                {error}
              </div>
            )}

            {/* 成功提示 */}
            {successMessage && (
              <div className="p-3 bg-green-500/10 text-green-600 dark:text-green-400 rounded-md text-sm">
                {successMessage}
              </div>
            )}

            {/* 节点配置 */}
            {nodes.length > 0 && (
              <div className="space-y-4">
                <div className="text-sm font-medium">节点参数配置</div>
                {nodes.map((node) => {
                  const key = getNodeKey(node);
                  return (
                    <div key={key} className="space-y-2">
                      <Label className="flex items-center gap-2">
                        {node.nodeName}
                        <Badge variant="outline" className="text-xs">
                          {node.fieldType}
                        </Badge>
                      </Label>
                      {renderNodeInput(node)}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 提交按钮 */}
            {nodes.length > 0 && (
              <div className="flex gap-2">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      提交中...
                    </>
                  ) : (
                    '提交任务'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSaveTemplate(true)}
                  className="gap-1"
                >
                  <Save className="w-4 h-4" />
                  保存模板
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate('/templates')}>
                  模板列表
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* 保存模板对话框 */}
      <Dialog open={showSaveTemplate} onOpenChange={setShowSaveTemplate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>保存为模板</DialogTitle>
            <DialogDescription>
              保存当前配置为模板，方便下次快速创建任务
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
