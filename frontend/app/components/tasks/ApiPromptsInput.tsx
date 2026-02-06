/**
 * API 提示词输入组件
 * 多行提示词输入和批量管理
 */

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Plus, X } from 'lucide-react';

export interface ApiPromptsInputProps {
  prompts: string[];
  onChange: (prompts: string[]) => void;
  placeholder?: string;
  maxCount?: number;
  className?: string;
}

const DEFAULT_PLACEHOLDER = '请输入提示词描述...';

export function ApiPromptsInput({
  prompts,
  onChange,
  placeholder = DEFAULT_PLACEHOLDER,
  maxCount = 50,
  className = '',
}: ApiPromptsInputProps) {
  const addPrompt = () => {
    if (prompts.length < maxCount) {
      onChange([...prompts, '']);
    }
  };

  const removePrompt = (index: number) => {
    if (prompts.length > 1) {
      onChange(prompts.filter((_, i) => i !== index));
    }
  };

  const updatePrompt = (index: number, value: string) => {
    const newPrompts = [...prompts];
    newPrompts[index] = value;
    onChange(newPrompts);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">提示词</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {prompts.map((prompt, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>提示词 {index + 1}</Label>
              {prompts.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removePrompt(index)}
                  className="h-6 text-destructive hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder={placeholder}
              value={prompt}
              onChange={(e) => updatePrompt(index, e.target.value)}
            />
          </div>
        ))}
        <div className="flex items-center justify-between pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            当前 {prompts.length} 个提示词，最多 {maxCount} 个
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addPrompt}
            disabled={prompts.length >= maxCount}
          >
            <Plus className="w-4 h-4 mr-1" />
            添加
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
