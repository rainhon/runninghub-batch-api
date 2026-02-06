/**
 * 日期时间选择器组件
 * 基于 shadcn/ui，支持中国时区
 */
import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface DateTimePickerProps {
  value?: string;  // ISO 格式字符串
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = '选择日期和时间',
  disabled = false,
  className,
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // 解析 ISO 字符串为 Date 对象
  const parseDate = (isoString?: string): Date | undefined => {
    if (!isoString) return undefined;
    return new Date(isoString);
  };

  // 格式化 Date 为显示字符串
  const formatDate = (date: Date): string => {
    return format(date, 'yyyy-MM-dd HH:mm');
  };

  // 格式化 Date 为 ISO 字符串（中国时区）
  const toISOString = (date: Date): string => {
    // 创建中国时区的 ISO 字符串
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:00+08:00`;
  };

  const selectedDate = parseDate(value);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      // 保留当前时间或设置为默认时间
      const newDate = selectedDate
        ? new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            selectedDate.getHours(),
            selectedDate.getMinutes()
          )
        : new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            9,  // 默认 9:00
            0   // 默认 00 分
          );

      onChange(toISOString(newDate));
    } else {
      onChange(undefined);
    }
    setIsOpen(false);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const timeValue = e.target.value;  // HH:MM 格式
    const [hours, minutes] = timeValue.split(':').map(Number);

    if (selectedDate && !isNaN(hours) && !isNaN(minutes)) {
      const newDate = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        hours,
        minutes
      );
      onChange(toISOString(newDate));
    }
  };

  const handleClear = () => {
    onChange(undefined);
    setIsOpen(false);
  };

  return (
    <div className={cn('flex gap-2', className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'flex-1 justify-start text-left font-normal',
              !selectedDate && 'text-muted-foreground'
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selectedDate ? formatDate(selectedDate) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            initialFocus
          />
          <div className="p-3 border-t">
            <div className="flex gap-2">
              <Input
                type="time"
                value={selectedDate
                  ? `${String(selectedDate.getHours()).padStart(2, '0')}:${String(selectedDate.getMinutes()).padStart(2, '0')}`
                  : ''
                }
                onChange={handleTimeChange}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
              >
                清除
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
