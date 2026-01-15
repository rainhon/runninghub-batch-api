import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Loader2, RefreshCw, Plus, Trash2, FileText } from 'lucide-react';
import { api } from '../lib/api';
import type { TaskTemplate } from '../types';

export default function TemplatesPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // 加载模板列表
  const loadTemplates = async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const result = await api.getTemplates();
      setTemplates(result.data || []);
    } catch (error: any) {
      console.error('加载模板列表失败:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 从模板创建任务
  const loadFromTemplate = (template: TaskTemplate) => {
    navigate('/create', {
      state: {
        template: template,
      },
    });
  };

  // 删除模板
  const deleteTemplate = async (templateId: number) => {
    setDeletingId(templateId);
    try {
      await api.deleteTemplate(templateId);
      await loadTemplates();
    } catch (error: any) {
      console.error('删除模板失败:', error.message);
    } finally {
      setDeletingId(null);
    }
  };

  // 初始加载
  useEffect(() => {
    loadTemplates();
  }, []);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">任务模板</h1>
          <p className="text-muted-foreground mt-1">管理和使用任务模板</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => loadTemplates(true)} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button onClick={() => navigate('/create')}>
            <Plus className="w-4 h-4 mr-2" />
            创建任务
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>模板列表</CardTitle>
          <CardDescription>当前共有 {templates.length} 个模板</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">暂无模板</p>
              <Button onClick={() => navigate('/create')}>创建第一个模板</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">ID</TableHead>
                  <TableHead>模板名称</TableHead>
                  <TableHead>App ID</TableHead>
                  <TableHead>节点数</TableHead>
                  <TableHead>重复次数</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="w-32">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-mono text-sm">{template.id}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{template.name}</div>
                        {template.description && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {template.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{template.appId}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{template.nodes.length}</Badge>
                    </TableCell>
                    <TableCell>{template.repeatCount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(template.createdAt).toLocaleString('zh-CN')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => loadFromTemplate(template)}
                        >
                          使用
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTemplate(template.id)}
                          disabled={deletingId === template.id}
                        >
                          {deletingId === template.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
