import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import type { ApiResponse } from '../types';

// 从环境变量获取 baseURL，默认为本地地址
const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:7777';

// 创建 axios 实例
const instance: AxiosInstance = axios.create({
  baseURL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
instance.interceptors.request.use(
  (config) => {
    // 可以在这里添加 token 等
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
instance.interceptors.response.use(
  (response) => {
    const { code, data, msg } = response.data;

    // 假设 code: 200 表示成功
    if (code === 200) {
      return response.data;
    } else {
      // 业务错误
      return Promise.reject(new Error(msg || '请求失败'));
    }
  },
  (error: AxiosError<ApiResponse>) => {
    // HTTP 错误
    if (error.response) {
      const { status, data } = error.response;
      const message = data?.msg || `HTTP ${status} 错误`;
      return Promise.reject(new Error(message));
    } else if (error.request) {
      // 网络错误
      return Promise.reject(new Error('网络连接失败，请检查后端服务是否启动'));
    } else {
      // 其他错误
      return Promise.reject(error);
    }
  }
);

// 封装请求方法
export const request = {
  get: <T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    return instance.get(url, config);
  },

  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    return instance.post(url, data, config);
  },

  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    return instance.put(url, data, config);
  },

  delete: <T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    return instance.delete(url, config);
  },
};

export default instance;
