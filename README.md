# RunningHub 任务管理系统

一个基于 FastAPI 和 React Router v7 的 AI 任务管理平台，支持批量任务执行、任务模板管理和实时状态监控。

## 功能特性

- **任务管理**
  - 提交 AI 任务到 RunningHub 平台
  - 支持任务重复执行（批量处理）
  - 实时任务状态监控（每 10 秒自动刷新）
  - 任务重试和取消功能
  - 分页查询任务列表

- **文件管理**
  - 本地文件上传
  - 文件去重（基于 SHA256 哈希）
  - 媒体文件预览（图片、视频、音频）
  - 文件使用计数

- **任务模板**
  - 保存常用任务配置为模板
  - 从模板快速创建任务
  - 模板管理（查看、删除）

- **结果查看**
  - 按执行次数分组显示结果
  - 支持多文件结果展示
  - 执行统计（成功/失败次数）
  - 媒体文件在线预览

## 应用截图

![任务列表](./images/1.png)
![创建任务](./images/2.png)
![任务结果](./images/3.png)

## 技术栈

### 后端
- FastAPI 0.125.0
- SQLite
- requests
- python-dotenv

### 前端
- React Router v7
- TypeScript
- Vite 7
- Tailwind CSS 4 + shadcn/ui

## 快速开始

### 环境要求

- Python 3.13+
- Node.js 18+

### 1. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的 RunningHub API Key：

```env
RUNNINGHUB_API_KEY=your_api_key_here
```

> 获取 API Key：登录 [RunningHub 控制台](https://www.runninghub.cn)

### 2. 安装依赖

```bash
# 安装后端依赖
pip install -r requirements.txt

# 安装前端依赖
cd frontend
npm install
```

### 3. 构建前端

```bash
npm run build
```

### 4. 启动服务

```bash
cd ..
python app.py
```

服务将在 `http://localhost:7777` 启动。

## 开发模式

```bash
# 终端 1：启动后端
python app.py

# 终端 2：启动前端开发服务器
cd frontend
npm run dev
```

前端开发服务器：`http://localhost:5173`

## API 接口

### 任务管理
- `POST /api/task/submit` - 提交任务
- `GET /api/tasks` - 获取任务列表（分页）
- `GET /api/task/{task_id}` - 获取任务详情
- `GET /api/task/{task_id}/results` - 获取任务结果
- `POST /api/task/{task_id}/retry` - 重试失败任务
- `POST /api/task/{task_id}/cancel` - 取消进行中任务

### 应用配置
- `GET /api/app/read/{app_id}` - 获取应用节点配置

### 文件管理
- `POST /api/upload` - 上传文件
- `GET /api/media/files` - 获取媒体文件列表

### 任务模板
- `POST /api/templates` - 保存模板
- `GET /api/templates` - 获取模板列表
- `DELETE /api/templates/{template_id}` - 删除模板

## 配置说明

### 任务并发控制

在 `task_manager.py` 中修改最大并发任务数：

```python
MAX_CONCURRENT_TASKS = 2
```

## 常见问题

### 任务执行失败
- 检查 RunningHub API Key 是否正确
- 查看后端日志获取详细错误信息
- 使用"重试"功能重新执行失败的任务

### 文件上传失败
- 检查 `uploads/` 目录是否有写入权限
- 确认文件大小未超过限制
- 查看后端日志

## 许可证

MIT License
