/**
 * API 任务类型选择 Tab 组件
 * 顶部任务类型选择栏
 */

import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { ImageIcon, Edit, Video, Film } from 'lucide-react';
import type { ApiTaskType } from '../../types';
import { TASK_TYPE_CONFIG } from '../../constants/taskTypes';

// 图标映射
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  image: ImageIcon,
  edit: Edit,
  video: Video,
  film: Film,
};

export interface ApiTaskTypeTabsProps {
  value: ApiTaskType | null | string;
  onChange: (value: ApiTaskType) => void;
  className?: string;
}

export function ApiTaskTypeTabs({
  value,
  onChange,
  className = '',
}: ApiTaskTypeTabsProps) {
  return (
    <Tabs value={value || ''} onValueChange={(v) => onChange(v as ApiTaskType)} className={className}>
      <TabsList className="grid w-full grid-cols-4">
        {Object.values(TASK_TYPE_CONFIG).map((type) => {
          const IconComponent = ICON_MAP[type.iconName];
          return (
            <TabsTrigger key={type.id} value={type.id} className="gap-2">
              {IconComponent && <IconComponent className="w-4 h-4" />}
              <span className="hidden sm:inline">{type.name}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
