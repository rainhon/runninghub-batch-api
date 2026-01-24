# API 任务管理系统 - 开发计划

## 项目概述

为 RunningHub 任务管理平台添加 **API 任务** 功能，支持四种类型的 AI 内容生成：

1. **文生图** (Text-to-Image) - 使用香蕉 API
2. **图生图** (Image-to-Image) - 使用香蕉 API
3. **文生视频** (Text-to-Video) - 使用 Sora2 API
4. **图生视频** (Image-to-Video) - 使用 Sora2 API

### 与现有 App 任务的对比

| 特性 | App 任务 | API 任务 |
|------|---------|----------|
| **触发方式** | 应用节点配置 | 直接调用 API |
| **并发限制** | 2 个并行任务 | 50 个并行任务 |
| **使用场景** | 复杂工作流 | 快速批量生成 |
| **任务类型** | 固定应用 | 4 种预设类型 |
| **模板系统** | 动态节点配置 | 固定参数模板 |

---

## 一、数据库设计

### 1.1 API 任务表 `api_missions`

```sql
CREATE TABLE api_missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(200) NOT NULL,                    -- 任务名称
    description TEXT,                               -- 任务描述
    task_type VARCHAR(50) NOT NULL,                -- 任务类型: text_to_image/image_to_image/text_to_video/image_to_video
    status VARCHAR(20) DEFAULT 'queued',           -- 状态: queued/running/completed/cancelled/failed
    total_count INTEGER NOT NULL,                   -- 总任务数
    completed_count INTEGER DEFAULT 0,              -- 已完成数
    failed_count INTEGER DEFAULT 0,                 -- 失败数
    config_json TEXT NOT NULL,                      -- 任务配置JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_missions_status ON api_missions(status);
CREATE INDEX idx_api_missions_type ON api_missions(task_type);
CREATE INDEX idx_api_missions_created ON api_missions(created_at);
```

### 1.2 API 任务子项表 `api_mission_items`

```sql
CREATE TABLE api_mission_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_mission_id INTEGER NOT NULL,               -- 关联API任务ID
    item_index INTEGER NOT NULL,                     -- 子任务序号（1,2,3...）
    input_params TEXT NOT NULL,                      -- 输入参数JSON
    status VARCHAR(20) DEFAULT 'pending',           -- 状态: pending/processing/completed/failed
    result_url TEXT,                                 -- 结果文件URL
    error_message TEXT,                              -- 错误信息
    runninghub_task_id TEXT,                         -- RunningHub返回的任务ID
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (api_mission_id) REFERENCES api_missions(id) ON DELETE CASCADE
);

CREATE INDEX idx_api_items_mission_id ON api_mission_items(api_mission_id);
CREATE INDEX idx_api_items_status ON api_mission_items(status);
```

### 1.3 API 任务模板表 `api_templates`

```sql
CREATE TABLE api_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(200) NOT NULL,                    -- 模板名称
    description TEXT,                               -- 模板描述
    task_type VARCHAR(50) NOT NULL,                -- 任务类型
    config_json TEXT NOT NULL,                      -- 固定配置JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_templates_type ON api_templates(task_type);
```

---

## 二、四种 API 任务类型详解

### 2.1 文生图 (Text-to-Image)

**API 端点**: `https://www.runninghub.cn/openapi/v2/rhart-image-v1/text-to-image`

**输入参数**:
```json
{
  "prompt": "图片生成提示词",
  "aspectRatio": "auto|3:4|1:1|16:9|4:3|3:2"
}
```

**批量场景**:
- 用户提供多个提示词列表
- 每个提示词独立生成一张图片
- aspectRatio 统一设置

**模板配置**:
```json
{
  "task_type": "text_to_image",
  "aspectRatio": "3:4",
  "batch_fields": ["prompt"]  // 批量变化的字段
}
```

---

### 2.2 图生图 (Image-to-Image)

**API 端点**: `https://www.runninghub.cn/openapi/v2/rhart-image-v1/edit`

**输入参数**:
```json
{
  "prompt": "图片编辑提示词",
  "aspectRatio": "auto",
  "imageUrls": ["图片URL1", "图片URL2", ...]
}
```

**批量场景**:
- 用户提供多张参考图片
- 使用同一提示词处理所有图片
- 或提供多组 (图片, 提示词) 组合

**模板配置**:
```json
{
  "task_type": "image_to_image",
  "aspectRatio": "auto",
  "prompt": "统一编辑指令",
  "batch_fields": ["imageUrls"]
}
```

---

### 2.3 文生视频 (Text-to-Video)

**API 端点**: `https://www.runninghub.cn/openapi/v2/rhart-video-s/text-to-video`

**输入参数**:
```json
{
  "prompt": "视频生成提示词",
  "duration": "10",
  "aspectRatio": "9:16|16:9|1:1"
}
```

**批量场景**:
- 用户提供多个视频提示词
- 每个 prompt 独立生成视频
- duration 和 aspectRatio 统一设置

**模板配置**:
```json
{
  "task_type": "text_to_video",
  "duration": "10",
  "aspectRatio": "9:16",
  "batch_fields": ["prompt"]
}
```

---

### 2.4 图生视频 (Image-to-Video)

**API 端点**: `https://www.runninghub.cn/openapi/v2/rhart-video-s/image-to-video`

**输入参数**:
```json
{
  "imageUrl": "参考图片URL",
  "prompt": "视频生成提示词",
  "duration": "10",
  "aspectRatio": "9:16|16:9|1:1"
}
```

**批量场景**:
- 用户提供多张参考图片
- 使用相同 prompt 和 duration 处理所有图片
- 或提供多组 (图片, prompt) 组合

**模板配置**:
```json
{
  "task_type": "image_to_video",
  "duration": "10",
  "aspectRatio": "9:16",
  "prompt": "统一视频指令",
  "batch_fields": ["imageUrl"]
}
```

---

## 三、后端 API 设计

### 3.1 API 任务管理接口

#### 3.1.1 创建 API 任务
```http
POST /api/api-missions
Content-Type: application/json

{
  "name": "批量文生图测试",
  "description": "生成100张图片",
  "task_type": "text_to_image",
  "config": {
    "aspectRatio": "3:4",
    "batch_input": ["提示词1", "提示词2", ...]  // 批量输入
  }
}

Response:
{
  "code": 0,
  "data": {
    "api_mission_id": 1001,
    "total_count": 100,
    "status": "queued"
  }
}
```

#### 3.1.2 获取 API 任务列表
```http
GET /api/api-missions?page=1&page_size=20&status=running

Response:
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": 1001,
        "name": "批量文生图测试",
        "task_type": "text_to_image",
        "status": "running",
        "total_count": 100,
        "completed_count": 45,
        "failed_count": 2,
        "progress": 45.0,
        "created_at": "2026-01-23 12:00:00"
      }
    ],
    "total": 150
  }
}
```

#### 3.1.3 获取 API 任务详情
```http
GET /api/api-missions/{api_mission_id}

Response:
{
  "code": 0,
  "data": {
    "id": 1001,
    "name": "批量文生图测试",
    "task_type": "text_to_image",
    "status": "running",
    "total_count": 100,
    "completed_count": 45,
    "failed_count": 2,
    "progress": 45.0,
    "config": {...},
    "items": [
      {
        "item_index": 1,
        "status": "completed",
        "result_url": "https://...",
        "input_params": {"prompt": "提示词1"}
      }
    ]
  }
}
```

#### 3.1.4 取消 API 任务
```http
POST /api/api-missions/{api_mission_id}/cancel

Response:
{
  "code": 0,
  "data": {
    "cancelled_count": 55
  }
}
```

#### 3.1.5 重试失败项
```http
POST /api/api-missions/{api_mission_id}/retry

Response:
{
  "code": 0,
  "data": {
    "retry_count": 2
  }
}
```

#### 3.1.6 批量下载结果
```http
GET /api/api-missions/{api_mission_id}/download

Response:
- 返回 ZIP 文件，包含所有已完成的结果
- 文件名: {任务名称}_results.zip
```

### 3.2 API 任务模板接口

#### 3.2.1 保存 API 模板
```http
POST /api/api-templates

{
  "name": "文生图-3:4风景",
  "description": "批量生成风景图片",
  "task_type": "text_to_image",
  "config": {
    "aspectRatio": "3:4",
    "batch_fields": ["prompt"]
  }
}
```

#### 3.2.2 获取 API 模板列表
```http
GET /api/api-templates?task_type=text_to_image

Response:
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": 1,
        "name": "文生图-3:4风景",
        "description": "批量生成风景图片",
        "task_type": "text_to_image",
        "config": {...}
      }
    ]
  }
}
```

#### 3.2.3 删除 API 模板
```http
DELETE /api/api-templates/{template_id}
```

---

## 四、后端实现

### 4.1 文件结构

```
backend/
├── api_task_manager.py      # API任务管理器
├── api_task_routes.py        # API任务路由
├── api_template_routes.py    # API模板路由
└── database.py               # 扩展数据库操作
```

### 4.2 API 任务管理器 `api_task_manager.py`

```python
import time
import threading
from collections import deque
from typing import List, Dict, Optional
import requests
import logging
from logging_config import get_logger

logger = get_logger('api_task_manager')

# API 任务配置
API_TASK_TYPES = {
    "text_to_image": {
        "url": "https://www.runninghub.cn/openapi/v2/rhart-image-v1/text-to-image",
        "required_fields": ["prompt"],
        "optional_fields": ["aspectRatio"]
    },
    "image_to_image": {
        "url": "https://www.runninghub.cn/openapi/v2/rhart-image-v1/edit",
        "required_fields": ["imageUrls", "prompt"],
        "optional_fields": ["aspectRatio"]
    },
    "text_to_video": {
        "url": "https://www.runninghub.cn/openapi/v2/rhart-video-s/text-to-video",
        "required_fields": ["prompt"],
        "optional_fields": ["duration", "aspectRatio"]
    },
    "image_to_video": {
        "url": "https://www.runninghub.cn/openapi/v2/rhart-video-s/image-to-video",
        "required_fields": ["imageUrl", "prompt"],
        "optional_fields": ["duration", "aspectRatio"]
    }
}

MAX_CONCURRENT_API_TASKS = 50  # API任务并发上限
POLL_INTERVAL = 5  # 轮询间隔（秒）

class ApiTaskManager:
    """API任务管理器"""

    def __init__(self):
        self.queue = deque()  # 任务队列
        self.running_tasks = set()  # 正在运行的项ID
        self.lock = threading.Lock()
        self.processing_thread = None
        self.is_running = False

    def start(self):
        """启动处理线程"""
        if self.processing_thread is None or not self.processing_thread.is_alive():
            self.is_running = True
            self.processing_thread = threading.Thread(
                target=self._process_queue,
                daemon=True
            )
            self.processing_thread.start()
            logger.info("✅ API任务管理器已启动")

    def stop(self):
        """停止处理"""
        self.is_running = False
        logger.info("⏹️ API任务管理器已停止")

    def create_api_mission(self, name: str, description: str, task_type: str,
                           config: Dict) -> int:
        """创建API任务"""
        # 验证任务类型
        if task_type not in API_TASK_TYPES:
            raise ValueError(f"不支持的任务类型: {task_type}")

        # 解析批量输入
        batch_input = config.get("batch_input", [])
        total_count = len(batch_input)

        # 创建数据库记录
        import json
        import database

        mission_id = database.execute_sql(
            """INSERT INTO api_missions
               (name, description, task_type, status, total_count, config_json)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (name, description, task_type, "queued", total_count, json.dumps(config)),
            fetch_one=True
        )

        mission_id = mission_id["lastrowid"]

        # 创建子任务
        for idx, input_data in enumerate(batch_input, 1):
            database.execute_sql(
                """INSERT INTO api_mission_items
                   (api_mission_id, item_index, input_params, status)
                   VALUES (?, ?, ?, ?)""",
                (mission_id, idx, json.dumps(input_data), "pending")
            )

        logger.info(f"📋 API任务 #{mission_id} 已创建，共 {total_count} 个子任务")

        # 添加到队列
        self.add_to_queue(mission_id)

        return mission_id

    def add_to_queue(self, mission_id: int):
        """添加任务到队列"""
        with self.lock:
            self.queue.append(mission_id)
            logger.info(f"📥 API任务 #{mission_id} 已加入队列")

    def _process_queue(self):
        """处理队列（内部方法）"""
        while self.is_running:
            try:
                with self.lock:
                    if len(self.queue) > 0 and len(self.running_tasks) < MAX_CONCURRENT_API_TASKS:
                        mission_id = self.queue.popleft()
                        logger.info(f"🚀 从队列取出 API任务 #{mission_id}")

                        # 在新线程中处理
                        thread = threading.Thread(
                            target=self._execute_mission,
                            args=(mission_id,),
                            daemon=True
                        )
                        thread.start()

                time.sleep(0.5)
            except Exception as e:
                logger.error(f"❌ 队列处理错误: {str(e)}")
                time.sleep(1)

    def _execute_mission(self, mission_id: int):
        """执行单个API任务（内部方法）"""
        try:
            # 获取任务信息
            import database
            import json

            mission = database.execute_sql(
                "SELECT * FROM api_missions WHERE id = ?",
                (mission_id,),
                fetch_one=True
            )

            if not mission:
                logger.warning(f"⚠️ API任务 #{mission_id} 不存在")
                return

            # 更新状态为运行中
            database.execute_sql(
                "UPDATE api_missions SET status = 'running' WHERE id = ?",
                (mission_id,)
            )

            task_type = mission['task_type']
            config = json.loads(mission['config_json'])

            # 获取待处理的子任务
            items = database.execute_sql(
                "SELECT * FROM api_mission_items WHERE api_mission_id = ? AND status = 'pending' ORDER BY item_index",
                (mission_id,),
                fetch_all=True
            )

            logger.info(f"▶️ 开始处理 API任务 #{mission_id}，共 {len(items)} 个子任务")

            # 处理每个子任务
            for item in items:
                # 提交到 RunningHub API
                self._submit_item(mission_id, task_type, config, item)

                # 等待完成或失败
                self._poll_item(mission_id, item)

                # 更新进度
                self._update_progress(mission_id)

            # 所有任务完成
            database.execute_sql(
                "UPDATE api_missions SET status = 'completed' WHERE id = ?",
                (mission_id,)
            )
            logger.info(f"✅ API任务 #{mission_id} 全部完成")

        except Exception as e:
            logger.error(f"❌ 执行 API任务 #{mission_id} 出错: {str(e)}")
            import traceback
            traceback.print_exc()

    def _submit_item(self, mission_id: int, task_type: str, config: Dict, item: Dict):
        """提交单个子任务到 RunningHub API"""
        import database
        import json

        try:
            # 构建 API 请求参数
            api_config = API_TASK_TYPES[task_type]
            input_params = json.loads(item['input_params'])

            payload = {}

            # 添加固定参数
            for key, value in config.items():
                if key != "batch_input":
                    payload[key] = value

            # 添加本次输入参数
            payload.update(input_params)

            # 提交到 RunningHub
            import os
            import requests

            url = api_config["url"]
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {os.getenv('RUNNINGHUB_API_KEY')}"
            }

            response = requests.post(url, headers=headers, json=payload)

            if response.status_code == 200:
                result = response.json()
                runninghub_task_id = result.get("taskId")

                # 更新子任务状态
                database.execute_sql(
                    """UPDATE api_mission_items
                       SET status = 'processing', runninghub_task_id = ?
                       WHERE id = ?""",
                    (runninghub_task_id, item['id'])
                )

                logger.info(f"✅ 子任务 #{item['item_index']} 已提交 (task_id: {runninghub_task_id})")
            else:
                raise Exception(f"提交失败: {response.status_code}, {response.text}")

        except Exception as e:
            logger.error(f"❌ 提交子任务 #{item['item_index']} 失败: {str(e)}")
            database.execute_sql(
                """UPDATE api_mission_items
                   SET status = 'failed', error_message = ?
                   WHERE id = ?""",
                (str(e), item['id'])
            )

    def _poll_item(self, mission_id: int, item: Dict):
        """轮询单个子任务状态"""
        import database
        import json
        import os
        import requests

        try:
            runninghub_task_id = item['runninghub_task_id']

            query_url = "https://www.runninghub.cn/openapi/v2/query"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {os.getenv('RUNNINGHUB_API_KEY')}"
            }

            while True:
                response = requests.post(
                    query_url,
                    headers=headers,
                    json={"taskId": runninghub_task_id}
                )

                if response.status_code == 200:
                    result = response.json()
                    status = result.get("status")

                    if status == "SUCCESS":
                        # 成功
                        if result.get("results") and len(result["results"]) > 0:
                            result_url = result["results"][0]["url"]

                            database.execute_sql(
                                """UPDATE api_mission_items
                                   SET status = 'completed', result_url = ?
                                   WHERE id = ?""",
                                (result_url, item['id'])
                            )

                            logger.info(f"✅ 子任务 #{item['item_index']} 成功: {result_url}")
                        else:
                            raise Exception("任务完成但无结果")

                        break

                    elif status == "RUNNING" or status == "QUEUED":
                        # 继续轮询
                        time.sleep(POLL_INTERVAL)

                    else:
                        # 失败
                        error_message = result.get("errorMessage", "未知错误")
                        raise Exception(f"任务失败: {error_message}")
                else:
                    raise Exception(f"查询失败: {response.status_code}")

        except Exception as e:
            logger.error(f"❌ 轮询子任务 #{item['item_index']} 出错: {str(e)}")
            database.execute_sql(
                """UPDATE api_mission_items
                   SET status = 'failed', error_message = ?
                   WHERE id = ?""",
                (str(e), item['id'])
            )

    def _update_progress(self, mission_id: int):
        """更新任务进度"""
        import database

        completed = database.execute_sql(
            "SELECT COUNT(*) as count FROM api_mission_items WHERE api_mission_id = ? AND status = 'completed'",
            (mission_id,),
            fetch_one=True
        )['count']

        failed = database.execute_sql(
            "SELECT COUNT(*) as count FROM api_mission_items WHERE api_mission_id = ? AND status = 'failed'",
            (mission_id,),
            fetch_one=True
        )['count']

        database.execute_sql(
            """UPDATE api_missions
               SET completed_count = ?, failed_count = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (completed, failed, mission_id)
        )


# 全局实例
api_task_manager = ApiTaskManager()
```

---

## 五、前端实现

### 5.1 文件结构

```
frontend/app/
├── routes/
│   ├── api-task.tsx           # API任务创建页面
│   ├── api-tasks.tsx          # API任务列表页面
│   └── api-templates.tsx      # API模板管理页面
├── components/
│   └── api/
│       ├── TaskTypeSelector.tsx    # 任务类型选择器
│       ├── TextToImageForm.tsx     # 文生图表单
│       ├── ImageToImageForm.tsx     # 图生图表单
│       ├── TextToVideoForm.tsx     # 文生视频表单
│       ├── ImageToVideoForm.tsx    # 图生视频表单
│       └── BatchInputText.tsx       # 批量文本输入组件
└── lib/
    └── api/
        └── api.ts              # 扩展API调用
```

### 5.2 API 任务创建页面 `api-task.tsx`

**页面结构**:
```
┌─────────────────────────────────────────────────────────┐
│  创建 API 任务                                            │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  任务名称: [_________________]                           │
│  任务描述: [_________________]                           │
│                                                           │
│  ┌─ 选择任务类型 ─────────────────────────────────┐  │
│  │                                                       │  │
│  │  ◉ 文生图 -  ⚡ 根据文本生成图片                         │  │
│  │                                                       │  │
│  │  ○ 图生图 - 🖼️ 基于参考图片编辑生成                       │  │
│  │                                                       │  │
│  │  ○ 文生视频 - 🎬️ 根据描述生成视频                       │  │
│  │                                                       │  │
│  │  ○ 图生视频 - 🎥 基于参考图片生成视频                     │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌─ 加载模板 ──────────────────────────────────────┐  │
│  │ [▼ 选择模板...]                                    │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌─ 任务参数 ────────────────────────────────────────┐  │
│  │  [根据选择的任务类型动态显示]                       │  │
│  │                                                       │  │
│  │  文生图示例：                                         │  │
│  │  - 宽高比: [3:4 ▼]                                   │  │
│  │  - 批量提示词:                                        │  │
│  │    ┌───────────────────────────────────────────┐   │  │
│  │    │ 一只可爱的猫咪                               │   │  │
│  │    │ 一只飞翔的鸟                                 │   │  │
│  │    │ 美丽的风景画                               │   │  │
│  │    │                                           │   │  │
│  │    └───────────────────────────────────────────┘   │  │
│  │    [导入文件]  [清空]  当前: 3 条                   │  │
│  │                                                       │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌─ 预览 ──────────────────────────────────────────┐  │
│  │  预计生成: 3 个任务                                   │  │
│  │  [展开查看详情]                                      │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  [保存为模板]  [提交任务]                                │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### 5.3 任务类型选择器组件

```tsx
interface TaskTypeConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const TASK_TYPES: TaskTypeConfig[] = [
  {
    id: 'text_to_image',
    name: '文生图',
    description: '根据文本生成图片',
    icon: <ImageIcon />
  },
  {
    id: 'image_to_image',
    name: '图生图',
    description: '基于参考图片编辑生成',
    icon: <EditIcon />
  },
  {
    id: 'text_to_video',
    name: '文生视频',
    description: '根据描述生成视频',
    icon: <VideoIcon />
  },
  {
    id: 'image_to_video',
    name: '图生视频',
    description: '基于参考图片生成视频',
    icon: <FilmIcon />
  }
];
```

---

## 六、文件上传处理

### 6.1 图片上传流程

```python
# app.py

from fastapi import UploadFile, File
from fastapi.responses import FileResponse
import os
from pathlib import Path
import uuid

UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

@app.post("/api/upload-image")
async def upload_image(file: UploadFile = File(...)):
    """上传图片到本地，返回可访问的URL"""
    # 生成唯一文件名
    file_ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = UPLOAD_DIR / unique_filename

    # 保存文件
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)

    # 返回访问URL
    file_url = f"http://localhost:7777/api/images/{unique_filename}"

    return {
        "code": 0,
        "data": {
            "filename": unique_filename,
            "url": file_url
        }
    }

@app.get("/api/images/{filename}")
async def get_image(filename: str):
    """获取上传的图片"""
    file_path = UPLOAD_DIR / filename
    if file_path.exists():
        return FileResponse(file_path)
    return {"error": "文件不存在"}
```

### 6.2 前端图片上传组件

```tsx
interface ImageUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  maxCount?: number;
}

export function ImageUpload({ value, onChange, maxCount = 10 }: ImageUploadProps) {
  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload-image', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    if (result.code === 0) {
      onChange([...value, result.data.url]);
    }
  };

  // ... 上传UI组件
}
```

---

## 七、开发任务清单

### Phase 1: 数据库和基础架构 (Week 1)

- [ ] **数据库迁移**
  - [ ] 创建 `api_missions` 表
  - [ ] 创建 `api_mission_items` 表
  - [ ] 创建 `api_templates` 表
  - [ ] 创建索引

- [ ] **后端核心模块**
  - [ ] 实现 `api_task_manager.py`
  - [ ] 扩展 `database.py` 添加 API 任务相关方法
  - [ ] 单元测试

- [ ] **API 认证配置**
  - [ ] 配置 RUNNINGHUB_API_KEY 环境变量
  - [ ] 测试 API 连通性

### Phase 2: 后端 API 实现 (Week 2-3)

- [ ] **API 任务管理 API**
  - [ ] POST /api/api-missions（创建）
  - [ ] GET /api/api-missions（列表）
  - [ ] GET /api/api-missions/{id}（详情）
  - [ ] POST /api/api-missions/{id}/cancel（取消）
  - [ ] POST /api/api-missions/{id}/retry（重试）
  - [ ] GET /api/api-missions/{id}/download（下载）
  - [ ] DELETE /api/api-missions/{id}（删除）

- [ ] **图片上传 API**
  - [ ] POST /api/upload-image
  - [ ] GET /api/images/{filename}
  - [ ] 文件大小限制
  - [ ] 文件类型验证

- [ ] **API 模板管理**
  - [ ] POST /api/api-templates
  - [ ] GET /api/api-templates
  - [ ] DELETE /api/api-templates/{id}

- [ ] **集成测试**
  - [ ] 测试四种任务类型
  - [ ] 测试并发控制（50个任务）
  - [ ] 测试轮询逻辑
  - [ ] 测试错误处理

### Phase 3: 前端页面开发 (Week 4-5)

- [ ] **API 任务创建页面**
  - [ ] 任务类型选择器
  - [ ] 四种任务类型表单
  - [ ] 批量输入组件（文本/图片）
  - [ ] 模板选择功能
  - [ ] 参数预览

- [ ] **API 任务列表页面**
  - [ ] 任务卡片组件
  - [ ] 进度条展示
  - [ ] 状态筛选
  - [ ] 分页功能
  - [ ] 自动刷新

- [ ] **API 任务详情页面**
  - [ ] 子任务列表
  - [ ] 结果预览
  - [ ] 批量操作

- [ ] **API 模板管理页面**
  - [ ] 模板列表
  - [ ] 保存模板
  - [ ] 使用模板
  - [ ] 删除模板

### Phase 4: 优化和测试 (Week 6)

- [ ] **性能优化**
  - [ ] 数据库查询优化
  - [ ] 前端渲染优化
  - [ ] 图片懒加载
  - [ ] 并发压测（50个任务）

- [ ] **用户体验优化**
  - [ ] 加载状态优化
  - [ ] 错误提示优化
  - [ ] 操作反馈优化
  - [ ] 响应式设计

- [ ] **完整测试**
  - [ ] 文生图批量测试
  - [ ] 图生图批量测试
  - [ ] 文生视频批量测试
  - [ ] 图生视频批量测试
  - [ ] 混合任务类型测试

### Phase 5: 文档和部署 (Week 7)

- [ ] **文档编写**
  - [ ] API 文档
  - [ ] 用户手册
  - [ ] 开发文档
  - [ ] 部署文档

- [ ] **部署配置**
  - [ ] 环境变量配置
  - [ ] 静态文件服务配置
  - [ ] 日志配置
  - [ ] 监控配置

---

## 八、技术要点

### 8.1 并发控制

```python
# 50个并发API任务
MAX_CONCURRENT_API_TASKS = 50

# 与 App 任务独立运行
# api_task_manager 和 task_manager 并行运行
```

### 8.2 图片存储策略

```python
# 本地存储 + FastAPI 静态文件服务
UPLOAD_DIR = "/path/to/uploads"
# 通过 /api/images/{filename} 访问
```

### 8.3 批量处理策略

```python
# 方案1: 串行处理（推荐）
# 每次处理 MAX_CONCURRENT_API_TASKS 个任务
# 完成一批再处理下一批

# 方案2: 并行处理
# 所有任务同时提交，依赖队列控制并发
```

### 8.4 错误处理

```python
# 单个子任务失败不影响其他任务
# 记录失败原因，支持单独重试
# 失败超过阈值后自动标记为失败
```

---

## 九、参考资源

### 9.1 RunningHub API 文档
- 官方文档: https://www.runninghub.cn/docs
- API Key: 环境变量配置

### 9.2 技术栈文档
- FastAPI: https://fastapi.tiangolo.com/
- React Router v7: https://reactrouter.com/
- SQLite: https://www.sqlite.org/docs.html

### 9.3 相关文件
- `api.md` - API 调用示例
- `task_manager.py` - App 任务管理器（参考实现）
- `runninghub.py` - RunningHub 服务封装

---

## 十、后续扩展

### 10.1 可能的扩展功能

- [ ] 支持更多 RunningHub API 类型
- [ ] 任务优先级设置
- [ ] 定时批量任务
- [ ] 结果分享功能
- [ ] 任务结果分析和统计

### 10.2 性能优化方向

- [ ] 使用 Redis 做任务队列
- [ ] 异步任务处理（Celery）
- [ ] 结果文件 CDN 加速
- [ ] 数据库读写分离

---

**文档版本**: 1.0
**创建日期**: 2026-01-23
**最后更新**: 2026-01-23
