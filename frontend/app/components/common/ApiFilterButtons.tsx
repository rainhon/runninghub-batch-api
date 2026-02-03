/**
 * API 筛选按钮组件
 * 任务状态筛选按钮组
 */

import { Button } from '../../components/ui/button';
import type { ApiMissionStatus } from '../../types';

export type ApiFilterValue = ApiMissionStatus | 'all';

export interface ApiFilterOption {
  value: ApiFilterValue;
  label: string;
}

export interface ApiFilterButtonsProps {
  filters?: ApiFilterOption[];
  activeFilter: ApiFilterValue;
  onChange: (filter: ApiFilterValue) => void;
  className?: string;
}

const DEFAULT_FILTERS: ApiFilterOption[] = [
  { value: 'all', label: '全部' },
  { value: 'queued', label: '排队中' },
  { value: 'running', label: '运行中' },
  { value: 'completed', label: '已完成' },
  { value: 'failed', label: '失败' },
  { value: 'cancelled', label: '已取消' },
];

export function ApiFilterButtons({
  filters = DEFAULT_FILTERS,
  activeFilter,
  onChange,
  className = '',
}: ApiFilterButtonsProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {filters.map((filter) => (
        <Button
          key={filter.value}
          variant={activeFilter === filter.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => onChange(filter.value)}
        >
          {filter.label}
        </Button>
      ))}
    </div>
  );
}
