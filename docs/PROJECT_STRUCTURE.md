# RunningHub 项目结构说明

## 目录结构

```
runninghub/
├── api/                    # API 路由层
│   ├── __init__.py
│   └── v1/                # API v1 版本
│       ├── __init__.py
│       ├── missions.py    # App 任务路由
│       ├── api_missions.py # API 任务路由
│       ├── templates.py   # 模板路由
│       └── media.py       # 媒体文件路由
│
├── core/                   # 核心模块
│   ├── __init__.py
│   ├── config.py          # 配置管理
│   └── constants.py       # 常量定义
│
├── models/                 # 数据模型
│   ├── __init__.py
│   ├── schemas.py         # Pydantic 模型
│   └── enums.py           # 枚举类型
│
├── services/               # 业务逻辑层
│   ├── __init__.py
│   ├── app_task_service.py       # App 任务服务
│   ├── api_task_service.py       # API 任务服务
│   ├── template_service.py       # 模板服务
│   └── media_service.py          # 媒体文件服务
│
├── repositories/           # 数据访问层
│   ├── __init__.py
│   ├── database.py        # 数据库连接
│   ├── mission_repository.py      # 任务仓储
│   ├── api_mission_repository.py  # API 任务仓储
│   └── template_repository.py     # 模板仓储
│
├── integrations/           # 外部集成
│   ├── __init__.py
│   ├── runninghub.py      # RunningHub API 集成
│   └── mock_runninghub.py # Mock 服务
│
├── utils/                  # 工具函数
│   ├── __init__.py
│   ├── logger.py          # 日志工具
│   └── helpers.py         # 辅助函数
│
├── static/                 # 前端静态文件
│   └── ...
│
├── uploads/                # 上传文件存储
│   └── ...
│
├── logs/                   # 日志文件
│   └── ...
│
├── migrations/             # 数据库迁移
│   ├── init.sql
│   └── init_api_tables.sql
│
├── tests/                  # 测试文件
│   ├── test_api_backend.py
│   └── ...
│
├── .env                    # 环境变量
├── .env.example           # 环境变量示例
├── main.py                # 应用入口
├── requirements.txt       # 依赖列表
└── README.md              # 项目说明
```

## 分层架构说明

### 1. API 层 (`api/`)
- 处理 HTTP 请求和响应
- 参数验证
- 调用服务层处理业务逻辑
- 不包含业务逻辑

### 2. 服务层 (`services/`)
- 核心业务逻辑
- 任务管理、队列处理
- 调用仓储层访问数据
- 调用外部集成

### 3. 仓储层 (`repositories/`)
- 数据访问逻辑
- SQL 查询和执行
- 数据库操作抽象

### 4. 集成层 (`integrations/`)
- 外部 API 调用
- RunningHub 集成
- Mock 服务

### 5. 核心层 (`core/`)
- 配置管理
- 常量定义
- 全局状态

### 6. 模型层 (`models/`)
- Pydantic 模型
- 枚举类型
- 数据结构定义

## 依赖关系

```
API 层
  ↓
服务层 (Services)
  ↓
仓储层 (Repositories) ← 集成层 (Integrations)
  ↓
数据库 (Database)
```

## 模块职责

### API 层
- 接收 HTTP 请求
- 验证请求参数
- 返回响应
- 处理 HTTP 异常

### 服务层
- 业务逻辑实现
- 任务队列管理
- 并发控制
- 错误处理

### 仓储层
- 数据库操作
- SQL 执行
- 事务管理
- 数据映射

### 集成层
- 调用外部 API
- 数据格式转换
- 错误处理
- 重试机制
