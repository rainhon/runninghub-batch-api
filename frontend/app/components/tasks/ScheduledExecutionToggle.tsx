/**
 * 定时执行开关组件
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { Clock, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ScheduledExecutionToggleProps {
  scheduledTime: string | undefined;
  onChange: (time: string | undefined) => void;
  disabled?: boolean;
}

export function ScheduledExecutionToggle({
  scheduledTime,
  onChange,
  disabled = false,
}: ScheduledExecutionToggleProps) {
  const [isScheduled, setIsScheduled] = useState(!!scheduledTime);

  const handleToggleSchedule = () => {
    if (isScheduled) {
      // 关闭定时执行
      onChange(undefined);
      setIsScheduled(false);
    } else {
      // 开启定时执行，默认设置为当前时间+1小时
      const now = new Date();
      now.setHours(now.getHours() + 1);
      now.setSeconds(0);
      now.setMilliseconds(0);

      // 转换为中国时区 ISO 格式
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const isoString = `${year}-${month}-${day}T${hours}:${minutes}:00+08:00`;

      onChange(isoString);
      setIsScheduled(true);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-5 h-5" />
          定时执行
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 开关按钮 */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="schedule-toggle">启用定时执行</Label>
            <p className="text-sm text-muted-foreground">
              {isScheduled ? '任务将在指定时间自动执行' : '任务将立即执行'}
            </p>
          </div>
          <Button
            id="schedule-toggle"
            variant={isScheduled ? 'default' : 'outline'}
            onClick={handleToggleSchedule}
            disabled={disabled}
            type="button"
          >
            {isScheduled ? '已启用' : '启用'}
          </Button>
        </div>

        {/* 日期时间选择器 */}
        {isScheduled && (
          <div className="space-y-2">
            <Label>执行时间</Label>
            <DateTimePicker
              value={scheduledTime}
              onChange={(value) => {
                onChange(value);
                if (!value) {
                  setIsScheduled(false);
                }
              }}
              placeholder="选择执行时间"
              disabled={disabled}
              className="w-full"
            />

            {/* 提示信息 */}
            <div className="flex items-start gap-2 p-3 bg-muted rounded-md text-sm text-muted-foreground">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p>• 时间设置为中国时区（UTC+8）</p>
                <p>• 不能设置早于当前时间的时间</p>
                <p>• 定时任务可以在任务列表中取消</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
