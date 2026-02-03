/**
 * API 任务名称输入组件
 * 统一的任务名称输入框
 */

import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

export interface ApiTaskNameInputProps {
  value: string;
  onChange: (name: string) => void;
  required?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

const DEFAULT_PLACEHOLDER = '例如：批量文生图测试';

export function ApiTaskNameInput({
  value,
  onChange,
  required = true,
  placeholder = DEFAULT_PLACEHOLDER,
  id = 'taskName',
  className = '',
  disabled = false,
}: ApiTaskNameInputProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={id}>
        任务名称 {required && <span className="text-destructive">*</span>}
      </Label>
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
      />
    </div>
  );
}
