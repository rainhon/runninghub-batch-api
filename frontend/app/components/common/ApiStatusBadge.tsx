/**
 * API 任务状态徽章组件
 * 显示任务状态的统一组件
 */

import { Badge } from '../../components/ui/badge';
import { Loader2, XCircle } from 'lucide-react';
import type { ApiMissionStatus } from '../../types';
import { API_STATUS_CONFIG } from '../../constants/statusConfig';

export interface ApiStatusBadgeProps {
  status: ApiMissionStatus;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function ApiStatusBadge({
  status,
  label,
  size = 'md',
  showIcon = true,
}: ApiStatusBadgeProps) {
  const config = API_STATUS_CONFIG[status];
  const displayLabel = label || config?.label || status;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const iconSize = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  return (
    <Badge className={`${config?.color || 'bg-gray-500'} ${sizeClasses[size]} text-white`}>
      <span className="flex items-center gap-1.5">
        {showIcon && config?.iconName && (
          config.iconName === 'loader' ? (
            <Loader2 className={`${iconSize[size]} ${status === 'running' ? 'animate-spin' : ''}`} />
          ) : config.iconName === 'x-circle' ? (
            <XCircle className={iconSize[size]} />
          ) : null
        )}
        {displayLabel}
      </span>
    </Badge>
  );
}
