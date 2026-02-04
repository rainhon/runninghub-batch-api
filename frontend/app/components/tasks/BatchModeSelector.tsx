/**
 * 批量任务模式选择器
 * 支持精确模式和组合模式切换
 */
interface BatchModeSelectorProps {
  value: 'precise' | 'combinatorial';
  onChange: (mode: 'precise' | 'combinatorial') => void;
}

export function BatchModeSelector({ value, onChange }: BatchModeSelectorProps) {
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium mb-3">创建模式</label>

      <div className="flex gap-2 border-b pb-2">
        <button
          type="button"
          className={`px-4 py-2 border-b-2 transition-colors ${
            value === 'precise'
              ? 'border-primary text-primary font-medium'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => onChange('precise')}
        >
          精确模式
        </button>

        <button
          type="button"
          className={`px-4 py-2 border-b-2 transition-colors ${
            value === 'combinatorial'
              ? 'border-primary text-primary font-medium'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => onChange('combinatorial')}
        >
          组合模式
        </button>
      </div>

      {/* 模式说明 */}
      {value === 'precise' && (
        <div className="mt-3 text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
          <strong>精确模式：</strong>手动配置每个子任务的参数，适合精确控制生成内容
        </div>
      )}

      {value === 'combinatorial' && (
        <div className="mt-3 text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
          <strong>组合模式：</strong>通过提示词、图片等参数的笛卡尔积自动生成大量子任务
        </div>
      )}
    </div>
  );
}
