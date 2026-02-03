/**
 * API 重复次数输入组件
 * 统一的重复次数输入框
 */

import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

export interface ApiRepeatCountInputProps {
  value: number;
  onChange: (count: number) => void;
  min?: number;
  max?: number;
  id?: string;
  className?: string;
  disabled?: boolean;
}

export function ApiRepeatCountInput({
  value,
  onChange,
  min = 1,
  max = 100,
  id = 'repeatCount',
  className = '',
  disabled = false,
}: ApiRepeatCountInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value) || min;
    const clampedValue = Math.max(min, Math.min(max, newValue));
    onChange(clampedValue);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={id}>重复次数</Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={handleChange}
        disabled={disabled}
      />
      <p className="text-xs text-muted-foreground">
        每个提示词将重复执行 {value} 次
      </p>
    </div>
  );
}
