# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

RunningHub 是一个基于 FastAPI + React Router v7 的 AI 任务管理平台，采用前后端分离架构。系统支持批量任务执行、任务模板管理和实时状态监控。

## 常用命令

### 后端开发
```bash
# 启动后端服务 (端口 7777)
python app.py

# 运行测试
python tests/test_mock_api.py

# 查看数据库
# SQLite 数据库文件: runninghub.db
```

### 前端开发
```bash
cd frontend

# 安装依赖
npm install

# 开发模式 (端口 5173)
npm run dev

# 构建生产版本
npm run build

# 类型检查
npm run typecheck
```

### 测试
```bash
# 启用 Mock 模式测试
export USE_MOCK_SERVICE=true
python tests/test_mock_api.py
```

## 架构说明

### 分层架构
```
API 层 (api/v1/)    → 处理 HTTP 请求/响应
    ↓
Service 层 (services/)  → 业务逻辑处理
    ↓
Repository 层 (repositories/)  → 数据访问封装
    ↓
Database (SQLite)    → 数据存储
```

### 双任务系统
系统支持两种任务类型，**关键区别在于 API Key 隔离**：

1. **App 任务** (`api/v1/missions.py`)
   - 通过 AI 应用的 webappId 调用
   - 使用 `RUNNINGHUB_API_KEY` (webapp Key)
   - 支持批量重复执行
   - 状态: pending/running/completed/cancelled

2. **API 任务** (`api/v1/api_missions.py`)
   - 直接调用 RunningHub API（文生图、图生图等）
   - 使用 `RUNNINGHUB_API_KEY` (通用 API Key)
   - 支持批量输入处理，包含子任务管理
   - 状态: queued/running/completed/failed/cancelled

**重要**: 修改任务相关代码时，明确是处理哪种任务类型，确保使用正确的 API Key。

### 核心目录结构
- `api/v1/` - API 路由层
- `core/` - 核心配置（数据库连接、定时器调度器）
- `models/` - Pydantic 数据模型
- `repositories/` - 数据访问层（统一数据库操作）
- `services/` - 业务逻辑层
- `integrations/` - 外部集成（RunningHub API、Mock 服务）
- `frontend/app/routes/` - React 路由组件（文件路由系统）
- `frontend/app/lib/` - 前端工具库

### 任务调度机制
- 并发控制: 默认最大并发 2 个任务（可在 `services/task_manager.py` 修改）
- 自动重试: 失败任务最多重试 7 次
- 状态刷新: 每 10 秒自动刷新任务状态
- 定时器: 独立的调度器管理任务生命周期（在 `core/timer.py`）

### 文件管理
- 上传存储: `uploads/` 目录
- 文件去重: 基于 SHA256 哈希值
- 媒体预览: 支持图片、视频、音频在线预览
- 使用计数: 跟踪文件引用次数

### API 响应格式
统一响应格式：
```json
{
  "code": 0,        // 0 表示成功
  "data": {},      // 响应数据
  "msg": "success" // 响应消息
}
```

### 时区处理
系统统一使用中国时区（UTC+8），所有时间字段在数据库存储时自动转换。

## 重要约定

### 环境变量
- `RUNNINGHUB_API_KEY` - RunningHub API 密钥（必需）
- `USE_MOCK_SERVICE` - 启用 Mock 模式（测试用，设置为 "true"）

### 数据库操作
- 所有数据库操作通过 `repositories/database.py` 统一管理
- 使用 Pydantic 模型进行数据验证
- JSON 格式配置数据存储在 TEXT 字段

### Mock 模式
设置 `USE_MOCK_SERVICE=true` 后，系统会调用 `integrations/mock_api_client.py` 而非真实 API，用于测试和开发。

### 前端路由
基于 React Router v7 的文件路由系统，路由文件位于 `frontend/app/routes/`，支持 SSR/SSG 混合渲染。

## 配置说明

### 修改任务并发数
编辑 `services/task_manager.py`:
```python
MAX_CONCURRENT_TASKS = 2  # 修改为所需值
```

### 数据库迁移
数据库迁移文件位于 `migrations/` 目录，SQLite 数据库文件为 `runninghub.db`。

## 类型检查

前端使用 TypeScript，后端使用 Python 类型注解。修改文件后建议运行类型检查：
```bash
cd frontend && npm run typecheck
```

## 部署注意
- 前端构建后输出到 `static/` 目录
- 生产环境只需运行 `python app.py`
- 确保 `uploads/` 和 `logs/` 目录有写入权限
