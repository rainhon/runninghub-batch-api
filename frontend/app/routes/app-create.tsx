import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Loader2, RefreshCw, ArrowLeft, Plus, X } from 'lucide-react';
import { api } from '../lib/api';
import type { NodeInfo } from '../types';

// 字段值输入项
interface FieldValueInput {
  id: string;
  value: string;
  fileInfo?: {
    fileId: string;
    id: number;
    url: string;
    fileName: string;
    fileSize: number;
    fileType: string;
  };
  uploading?: boolean;
}

export default function AppCreatePage() {
  const navigate = useNavigate();

  // 基本信息
  const [taskName, setTaskName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [appId, setAppId] = useState('');

  // 节点配置
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [repeatCount, setRepeatCount] = useState(1);

  // 每个字段的多个值输入：{ fieldName: [{ id, value }] }
  const [fieldValues, setFieldValues] = useState<Record<string, FieldValueInput[]>>({});

  // UI 状态
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 加载 App 配置
  const loadAppNodes = async () => {
    if (!appId.trim()) {
      setError('请输入 App ID');
      return;
    }

    setLoading(true);
    setError(null);
    setNodes([]);
    setFieldValues({});

    try {
      const result = await api.getAppNodes(appId);
      const transformedNodes: NodeInfo[] = (result.data || []).map((node: any) => ({
        nodeId: node.nodeId,
        fieldName: node.fieldName,
        fieldType: node.fieldType,
        fieldValue: node.fieldValue,
        nodeName: node.nodeName || node.fieldName,
        required: false,
      }));

      setNodes(transformedNodes);

      // 初始化每个字段的值输入（默认每个字段一个空输入）
      const initialValues: Record<string, FieldValueInput[]> = {};
      transformedNodes.forEach(node => {
        // 为每个字段生成唯一的 ID
        initialValues[node.fieldName] = [{
          id: `${node.fieldName}_init`,
          value: node.fieldValue || ''
        }];
      });
      setFieldValues(initialValues);

      setSuccessMessage(`成功加载 ${transformedNodes.length} 个节点配置`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 为字段添加新的值输入
  const addFieldValue = (fieldName: string) => {
    const newId = `${fieldName}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    setFieldValues({
      ...fieldValues,
      [fieldName]: [
        ...(fieldValues[fieldName] || []),
        { id: newId, value: '' }
      ]
    });
  };

  // 删除字段的某个值输入
  const removeFieldValue = (fieldName: string, id: string) => {
    const values = fieldValues[fieldName];
    if (values && values.length > 1) {
      setFieldValues({
        ...fieldValues,
        [fieldName]: values.filter(v => v.id !== id)
      });
    } else {
      setError('每个字段至少保留一个值');
    }
  };

  // 更新字段的某个值
  const updateFieldValue = (fieldName: string, id: string, value: string) => {
    setFieldValues({
      ...fieldValues,
      [fieldName]: (fieldValues[fieldName] || []).map(v =>
        v.id === id ? { ...v, value } : v
      )
    });
  };

  // 处理文件上传
  const handleFileUpload = async (fieldName: string, id: string, file: File) => {
    const values = fieldValues[fieldName] || [];
    const valueIndex = values.findIndex(v => v.id === id);

    if (valueIndex === -1) return;

    // 标记为上传中
    setFieldValues({
      ...fieldValues,
      [fieldName]: values.map((v, idx) =>
        idx === valueIndex ? { ...v, uploading: true } : v
      )
    });

    try {
      const result = await api.uploadAppTaskFile(file, (progress) => {
        // 可以在这里添加进度显示
        console.log(`上传进度: ${progress}%`);
      });

      // 更新值和文件信息
      setFieldValues({
        ...fieldValues,
        [fieldName]: values.map((v, idx) =>
          idx === valueIndex
            ? {
                ...v,
                value: result.data.url, // 使用 RunningHub 返回的 URL
                fileInfo: result.data,
                uploading: false
              }
            : v
        )
      });
    } catch (err: any) {
      setError(`文件上传失败: ${err.message || '未知错误'}`);
      setFieldValues({
        ...fieldValues,
        [fieldName]: values.map((v, idx) =>
          idx === valueIndex ? { ...v, uploading: false } : v
        )
      });
    }
  };

  // 计算笛卡尔积生成批量子任务
  const generateBatchInputs = (): any[] => {
    const combinations: any[] = [];

    // 获取所有有多个值的字段
    const multiValueFields = Object.keys(fieldValues).filter(
      key => fieldValues[key] && fieldValues[key].length > 0
    );

    if (multiValueFields.length === 0) {
      return [];
    }

    // 递归生成笛卡尔积
    const cartesian = (current: any[], remainingFields: string[]): any[] => {
      if (remainingFields.length === 0) {
        return current;
      }

      const [firstField, ...rest] = remainingFields;
      const values = fieldValues[firstField]
        .filter(v => v.value.trim().length > 0) // 过滤空值
        .map(v => v.value);

      // 如果该字段没有有效值，使用当前的所有组合
      if (values.length === 0) {
        return cartesian(current, rest);
      }

      const newCombinations: any[] = [];
      for (const combo of current) {
        for (const value of values) {
          newCombinations.push({
            ...combo,
            [firstField]: value
          });
        }
      }

      return cartesian(newCombinations, rest);
    };

    const allCombinations = cartesian([{}], multiValueFields);

    // 根据重复次数复制
    for (const combo of allCombinations) {
      for (let i = 0; i < repeatCount; i++) {
        combinations.push({ ...combo });
      }
    }

    return combinations;
  };

  // 获取预览的子任务数量
  const getPreviewCount = () => {
    const combinations = generateBatchInputs();
    return combinations.length;
  };

  // 提交任务
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // 验证
    if (!appId.trim()) {
      setError('请输入 App ID');
      return;
    }

    if (!taskName.trim()) {
      setError('请输入任务名称');
      return;
    }

    if (nodes.length === 0) {
      setError('请先加载应用配置');
      return;
    }

    // 生成批量输入
    const batchInput = generateBatchInputs();
    if (batchInput.length === 0) {
      setError('请至少配置一个参数值');
      return;
    }

    setSubmitting(true);

    try {
      // 固定配置为空，所有参数都在批量输入中
      await api.createAppMission({
        name: taskName,
        description: taskDescription,
        app_id: appId,
        config: {},  // 固定配置为空
        batch_input: batchInput  // 所有参数组合
      });

      setSuccessMessage(`任务提交成功！共生成 ${batchInput.length} 个子任务。正在跳转到任务列表...`);
      setTimeout(() => {
        navigate('/app-tasks');
      }, 1500);
    } catch (err: any) {
      setError(err.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 渲染节点输入
  const renderNodeInput = (node: NodeInfo) => {
    const values = fieldValues[node.fieldName] || [];

    if (node.fieldType === 'IMAGE' || node.fieldType === 'AUDIO' || node.fieldType === 'VIDEO') {
      return (
        <div className="space-y-2">
          {values.map((v) => (
            <div key={v.id} className="flex flex-col gap-2 p-3 border rounded-lg bg-muted/30">
              {/* 文件上传和预览区 */}
              {v.fileInfo ? (
                // 已上传文件，显示预览
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate flex-1">
                      {v.fileInfo.fileName}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        // 清除文件信息
                        updateFieldValue(node.fieldName, v.id, '');
                      }}
                      disabled={submitting}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* 媒体预览 */}
                  {node.fieldType === 'IMAGE' && v.fileInfo.url && (
                    <a
                      href={v.fileInfo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <img
                        src={api.getAppTaskFile(v.fileInfo.id)}
                        alt={v.fileInfo.fileName}
                        className="max-w-full h-auto max-h-48 rounded cursor-pointer hover:opacity-80 transition"
                      />
                    </a>
                  )}

                  {node.fieldType === 'VIDEO' && v.fileInfo.url && (
                    <video
                      src={api.getAppTaskFile(v.fileInfo.id)}
                      controls
                      className="max-w-full h-auto max-h-48 rounded"
                    />
                  )}

                  {node.fieldType === 'AUDIO' && v.fileInfo.url && (
                    <audio
                      src={api.getAppTaskFile(v.fileInfo.id)}
                      controls
                      className="w-full"
                    />
                  )}

                  <Input
                    type="text"
                    placeholder={`URL（已上传文件）`}
                    value={v.value}
                    onChange={(e) => updateFieldValue(node.fieldName, v.id, e.target.value)}
                    disabled={submitting}
                    className="text-xs"
                  />
                </div>
              ) : (
                // 未上传文件，显示上传按钮
                <div className="space-y-2">
                  {v.uploading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      上传中...
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="file"
                        accept={
                          node.fieldType === 'IMAGE'
                            ? 'image/*'
                            : node.fieldType === 'VIDEO'
                            ? 'video/*'
                            : 'audio/*'
                        }
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleFileUpload(node.fieldName, v.id, file);
                          }
                        }}
                        disabled={submitting}
                        className="flex-1 text-sm file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary file:text-primary-foreground file:cursor-pointer hover:file:bg-primary/90"
                      />
                      {values.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFieldValue(node.fieldName, v.id)}
                          disabled={submitting}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground">
                    或直接输入 URL
                  </div>
                  <Input
                    type="text"
                    placeholder={`直接输入 ${node.nodeName} URL`}
                    value={v.value}
                    onChange={(e) => updateFieldValue(node.fieldName, v.id, e.target.value)}
                    disabled={submitting}
                  />
                </div>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addFieldValue(node.fieldName)}
            disabled={submitting}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-1" />
            添加 {node.nodeName}
          </Button>
        </div>
      );
    }

    if (node.fieldType === 'TEXTAREA') {
      return (
        <div className="space-y-2">
          {values.map((v, index) => (
            <div key={v.id} className="flex gap-2 items-start">
              <textarea
                className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder={`${node.nodeName} ${index + 1}`}
                value={v.value}
                onChange={(e) => updateFieldValue(node.fieldName, v.id, e.target.value)}
                disabled={submitting}
              />
              {values.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFieldValue(node.fieldName, v.id)}
                  disabled={submitting}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addFieldValue(node.fieldName)}
            disabled={submitting}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-1" />
            添加 {node.nodeName}
          </Button>
        </div>
      );
    }

    if (node.fieldType === 'NUMBER') {
      return (
        <div className="space-y-2">
          {values.map((v, index) => (
            <div key={v.id} className="flex gap-2 items-start">
              <Input
                type="number"
                placeholder={`${node.nodeName} ${index + 1}`}
                value={v.value}
                onChange={(e) => updateFieldValue(node.fieldName, v.id, e.target.value)}
                disabled={submitting}
              />
              {values.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFieldValue(node.fieldName, v.id)}
                  disabled={submitting}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addFieldValue(node.fieldName)}
            disabled={submitting}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-1" />
            添加 {node.nodeName}
          </Button>
        </div>
      );
    }

    // 默认文本输入
    return (
      <div className="space-y-2">
        {values.map((v, index) => (
          <div key={v.id} className="flex gap-2 items-start">
            <Input
              type="text"
              placeholder={`${node.nodeName} ${index + 1}`}
              value={v.value}
              onChange={(e) => updateFieldValue(node.fieldName, v.id, e.target.value)}
              disabled={submitting}
            />
            {values.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeFieldValue(node.fieldName, v.id)}
                disabled={submitting}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addFieldValue(node.fieldName)}
          disabled={submitting}
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-1" />
          添加 {node.nodeName}
        </Button>
      </div>
    );
  };

  // 渲染批量预览
  const renderBatchPreview = () => {
    const combinations = generateBatchInputs();
    const previewLimit = 10;

    return (
      <div className="space-y-2">
        {combinations.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            请填写参数值以生成预览
          </div>
        ) : (
          <>
            <div className="text-sm text-muted-foreground">
              {combinations.length > previewLimit
                ? `显示前 ${previewLimit} 个（共 ${combinations.length} 个）`
                : `共 ${combinations.length} 个子任务`}
            </div>
            {combinations.slice(0, previewLimit).map((combo, index) => (
              <div key={index} className="text-xs p-2 bg-muted rounded">
                <div className="font-medium mb-1">子任务 #{index + 1}</div>
                <pre className="overflow-x-auto">
                  {JSON.stringify(combo, null, 2)}
                </pre>
              </div>
            ))}
            {combinations.length > previewLimit && (
              <div className="text-center text-sm text-muted-foreground py-2">
                ... 还有 {combinations.length - previewLimit} 个子任务
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <Button variant="ghost" className="mb-4" onClick={() => navigate('/app-tasks')}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        返回
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>App 任务创建（批量输入模式）</CardTitle>
          <CardDescription>为每个参数添加多个值，自动生成所有组合的子任务</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 基本信息 */}
            <div className="space-y-4">
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
                    disabled={submitting}
                  />
                  <Button type="button" onClick={loadAppNodes} disabled={loading || submitting}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    加载配置
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="taskName">
                  任务名称 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="taskName"
                  placeholder="给任务起个名字"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="taskDescription">任务描述</Label>
                <Input
                  id="taskDescription"
                  placeholder="描述一下这个任务（可选）"
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="repeatCount">
                  每个组合重复次数
                </Label>
                <Input
                  id="repeatCount"
                  type="number"
                  min="1"
                  max="100"
                  value={repeatCount}
                  onChange={(e) => setRepeatCount(Math.max(1, parseInt(e.target.value) || 1))}
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground">
                  每个参数组合将重复执行 {repeatCount} 次
                </p>
              </div>
            </div>

            {/* 参数配置 */}
            {nodes.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">参数配置</h3>
                  <Badge variant="secondary">支持多值输入</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  为每个参数添加多个值，系统会自动生成所有可能的组合（笛卡尔积）
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {nodes.map((node) => (
                    <div key={node.nodeId + '_' + node.fieldName} className="space-y-2 p-4 border rounded-lg">
                      <Label className="text-base font-medium">{node.nodeName}</Label>
                      <p className="text-xs text-muted-foreground">
                        {node.fieldType} 类型 · 点击"添加"可输入多个值
                      </p>
                      {renderNodeInput(node)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 批量预览 */}
            {nodes.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">批量预览</h3>
                  <Badge variant="outline">
                    预计生成 {getPreviewCount()} 个子任务
                  </Badge>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  {renderBatchPreview()}
                </div>
              </div>
            )}

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

            {/* 提交按钮 */}
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={submitting || nodes.length === 0 || getPreviewCount() === 0}
              >
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {submitting ? '提交中...' : `提交任务 (${getPreviewCount()} 个子任务)`}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/app-tasks')}
                disabled={submitting}
              >
                取消
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
