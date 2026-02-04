/**
 * 精确模式任务列表组件
 * 管理任务卡片的增删改查操作
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { TaskCard, type PreciseTaskConfig } from './TaskCard';
import { TaskEditDialog } from './TaskEditDialog';
import type { ApiTaskType } from '@/types';

interface PreciseTaskListProps {
  tasks: PreciseTaskConfig[];
  onChange: (tasks: PreciseTaskConfig[]) => void;
  taskType: ApiTaskType;
}

export function PreciseTaskList({ tasks, onChange, taskType }: PreciseTaskListProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);

  const handleAddTask = (task: PreciseTaskConfig) => {
    onChange([...tasks, task]);
    setShowAddDialog(false);
  };

  const handleEditTask = (index: number, updatedTask: PreciseTaskConfig) => {
    const newTasks = [...tasks];
    newTasks[index] = updatedTask;
    onChange(newTasks);
  };

  const handleDeleteTask = (index: number) => {
    onChange(tasks.filter((_, i) => i !== index));
  };

  const handleDuplicateTask = (index: number) => {
    const taskToDuplicate = tasks[index];
    const newTask = {
      ...taskToDuplicate,
      id: crypto.randomUUID()
    };
    onChange([...tasks, newTask]);
  };

  return (
    <div className="space-y-4">
      {/* 任务列表 */}
      {tasks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
          <p className="text-lg mb-2">暂无任务</p>
          <p className="text-sm">点击下方按钮添加第一个任务</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {tasks.map((task, index) => (
            <TaskCard
              key={task.id}
              task={task}
              index={index}
              taskType={taskType}
              onEdit={(updates) => handleEditTask(index, updates)}
              onDelete={() => handleDeleteTask(index)}
              onDuplicate={() => handleDuplicateTask(index)}
            />
          ))}
        </div>
      )}

      {/* 添加任务按钮 */}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => setShowAddDialog(true)}
      >
        <Plus className="mr-2 h-4 w-4" />
        添加任务
      </Button>

      {/* 任务统计 */}
      {tasks.length > 0 && (
        <div className="text-sm text-muted-foreground text-center">
          共 {tasks.length} 个任务
        </div>
      )}

      {/* 添加任务对话框 */}
      <TaskEditDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSave={handleAddTask}
        taskType={taskType}
      />
    </div>
  );
}
