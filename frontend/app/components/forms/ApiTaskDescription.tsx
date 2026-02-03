/**
 * API 任务描述组件
 * 统一的任务描述文本域
 */

import { Label } from '../../components/ui/label';

export interface ApiTaskDescriptionProps {
  value: string;
  onChange: (description: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
  rows?: number;
}

const DEFAULT_PLACEHOLDER = '简要描述此任务的用途';

export function ApiTaskDescription({
  value,
  onChange,
  placeholder = DEFAULT_PLACEHOLDER,
  id = 'taskDescription',
  className = '',
  disabled = false,
  rows = 3,
}: ApiTaskDescriptionProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={id}>任务描述（可选）</Label>
      <textarea
        id={id}
        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={rows}
      />
    </div>
  );
}
