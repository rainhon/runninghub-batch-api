/**
 * API 任务表单状态管理 Hook
 * 统一管理任务创建表单的状态，供 api-create.tsx 和类似页面使用
 */

import { useState, useCallback } from 'react';

export interface UseApiTaskFormStateReturn {
  // 状态
  taskName: string;
  taskDescription: string;
  repeatCount: number;
  submitting: boolean;
  error: string | null;
  successMessage: string | null;

  // 设置方法
  setTaskName: (name: string) => void;
  setTaskDescription: (description: string) => void;
  setRepeatCount: (count: number) => void;
  setSubmitting: (submitting: boolean) => void;
  setError: (error: string | null) => void;
  setSuccessMessage: (message: string | null) => void;

  // 工具方法
  clearMessages: () => void;
  resetForm: () => void;
  hasError: () => boolean;
}

export function useApiTaskFormState(initialRepeatCount = 1): UseApiTaskFormStateReturn {
  const [taskName, setTaskName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [repeatCount, setRepeatCount] = useState(initialRepeatCount);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 清除所有消息
  const clearMessages = useCallback(() => {
    setError(null);
    setSuccessMessage(null);
  }, []);

  // 重置表单
  const resetForm = useCallback(() => {
    setTaskName('');
    setTaskDescription('');
    setRepeatCount(initialRepeatCount);
    clearMessages();
  }, [initialRepeatCount, clearMessages]);

  // 检查是否有错误
  const hasError = useCallback(() => {
    return error !== null;
  }, [error]);

  return {
    // 状态
    taskName,
    taskDescription,
    repeatCount,
    submitting,
    error,
    successMessage,

    // 设置方法
    setTaskName,
    setTaskDescription,
    setRepeatCount,
    setSubmitting,
    setError,
    setSuccessMessage,

    // 工具方法
    clearMessages,
    resetForm,
    hasError,
  };
}
