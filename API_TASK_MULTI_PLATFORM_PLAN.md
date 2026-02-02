# API 任务多平台集成开发计划

## 项目概述

将现有的 API 任务系统从单一 RunningHub 平台扩展为支持多平台的统一接口，用户可以选择指定平台或由系统轮流尝试不同平台。

**核心目标**:
1. ✅ 按 AI 生成类型分 Tab 栏（图生视频/文生视频/图生图/文生图）
2. ✅ 集成多个平台 API（RunningHub + 其他平台）
3. ✅ 支持用户选择平台或系统自动轮询
4. ✅ 统一的任务管理和结果展示

---

## 一、架构设计

### 1.1 平台抽象层设计

```
┌─────────────────────────────────────────────────────────────┐
│                    前端 UI 层                                │
│  ┌──────────┬──────────┬──────────┬──────────┐              │
│  │ 文生图Tab │ 图生图Tab │ 文生视频Tab │图生视频Tab│            │
│  └──────────┴──────────┴──────────┴──────────┘              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  API 网关层                                  │
│  GET /api/v1/platforms              - 获取支持的平台列表      │
│  POST /api/v1/api_missions/submit   - 提交任务（支持平台选择） │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│               平台适配器层 (Platform Adapters)                │
│  ┌──────────────┬──────────────┬──────────────┐             │
│  │  RunningHub  │   Platform B │   Platform C │             │
│  │   Adapter    │    Adapter   │    Adapter   │             │
│  └──────────────┴──────────────┴──────────────┘             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│               平台路由层 (Platform Router)                    │
│  • 指定平台模式: 直接路由到选定平台                          │
│  • 轮询模式: 依次尝试每个平台直到成功                         │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 任务类型映射

| 任务类型 | RunningHub API | Platform B | Platform C |
|---------|----------------|------------|------------|
| **文生图** | ✅ text-to-image | ✅ txt2img | ✅ generate |
| **图生图** | ✅ image-to-image | ✅ img2img | ✅ transform |
| **文生视频** | ✅ text-to-video | ✅ txt2vid | ✅ video-gen |
| **图生视频** | ✅ image-to-video | ✅ img2vid | ✅ animate |

### 1.3 平台选择策略

```typescript
enum PlatformStrategy {
  SPECIFIED = "specified",    // 用户指定平台
  ROUND_ROBIN = "round_robin", // 系统轮询
  PRIORITY = "priority"        // 按优先级尝试
}

interface PlatformConfig {
  id: string;                  // 平台 ID (runninghub, midjourney, stability)
  name: string;                // 平台显示名称
  enabled: boolean;            // 是否启用
  priority: number;            // 优先级 (1-10)
  task_types: string[];        // 支持的任务类型
  api_key?: string;            // 平台 API Key
  rate_limit?: number;         // 速率限制 (请求/分钟)
  timeout?: number;            // 超时时间 (秒)
  cost_per_task?: number;      // 每次任务成本
}
```

---

## 二、数据库设计

### 2.1 新增表：platforms

```sql
-- 平台配置表
CREATE TABLE IF NOT EXISTS platforms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform_id TEXT NOT NULL UNIQUE,        -- 平台唯一标识
    name TEXT NOT NULL,                      -- 平台名称
    display_name TEXT NOT NULL,              -- 显示名称
    enabled INTEGER DEFAULT 1,               -- 是否启用 (0=禁用, 1=启用)
    priority INTEGER DEFAULT 5,              -- 优先级 (1-10)
    supported_task_types TEXT NOT NULL,      -- 支持的任务类型 JSON 数组
    api_key TEXT,                            -- API 密钥 (加密存储)
    api_endpoint TEXT,                       -- API 端点
    rate_limit INTEGER DEFAULT 60,           -- 速率限制 (请求/分钟)
    timeout INTEGER DEFAULT 300,             -- 超时时间 (秒)
    cost_per_task REAL DEFAULT 0.0,          -- 每次任务成本
    config_json TEXT,                        -- 其他配置 JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_platforms_enabled ON platforms(enabled);
CREATE INDEX idx_platforms_priority ON platforms(priority);
```

### 2.2 修改表：api_missions

```sql
-- 添加平台相关字段
ALTER TABLE api_missions ADD COLUMN platform_strategy TEXT DEFAULT 'specified';
ALTER TABLE api_missions ADD COLUMN platform_id TEXT;  -- 用户指定的平台
ALTER TABLE api_missions ADD COLUMN platform_attempt TEXT;  -- 实际尝试的平台列表 JSON
ALTER TABLE api_missions ADD COLUMN platform_success TEXT;  -- 最终成功的平台

-- 创建索引
CREATE INDEX idx_api_missions_platform ON api_missions(platform_id);
CREATE INDEX idx_api_missions_strategy ON api_missions(platform_strategy);
```

### 2.3 新增表：platform_stats

```sql
-- 平台统计表
CREATE TABLE IF NOT EXISTS platform_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform_id TEXT NOT NULL,
    task_type TEXT NOT NULL,
    total_tasks INTEGER DEFAULT 0,           -- 总任务数
    success_tasks INTEGER DEFAULT 0,         -- 成功任务数
    failed_tasks INTEGER DEFAULT 0,          -- 失败任务数
    avg_duration REAL,                       -- 平均耗时 (秒)
    total_cost REAL DEFAULT 0.0,             -- 总成本
    last_used TIMESTAMP,                     -- 最后使用时间
    date DATE NOT NULL,                      -- 统计日期
    UNIQUE(platform_id, task_type, date)
);

-- 创建索引
CREATE INDEX idx_platform_stats_date ON platform_stats(date);
CREATE INDEX idx_platform_stats_platform ON platform_stats(platform_id);
```

### 2.4 初始化数据

```sql
-- 初始化 RunningHub 平台
INSERT INTO platforms (
    platform_id, name, display_name, enabled, priority,
    supported_task_types, api_endpoint, rate_limit, timeout
) VALUES (
    'runninghub',
    'RunningHub',
    'RunningHub',
    1,
    10,
    '["text_to_image", "image_to_image", "text_to_video", "image_to_video"]',
    'https://www.runninghub.cn/openapi/v2',
    60,
    300
);

-- 初始化其他平台 (示例)
INSERT INTO platforms (
    platform_id, name, display_name, enabled, priority,
    supported_task_types, rate_limit, timeout
) VALUES
('midjourney', 'Midjourney', 'Midjourney', 0, 8, '["text_to_image", "image_to_image"]', 30, 600),
('stability', 'Stability AI', 'Stability AI', 0, 7, '["text_to_image", "image_to_image"]', 50, 300),
('replicate', 'Replicate', 'Replicate', 0, 6, '["text_to_image", "image_to_video"]', 100, 600);
```

---

## 三、后端实现

### 3.1 平台适配器接口

```python
# integrations/platform_adapters/base.py

from abc import ABC, abstractmethod
from typing import Dict, Any, List

class BasePlatformAdapter(ABC):
    """平台适配器基类"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.platform_id = config.get('platform_id')
        self.api_key = config.get('api_key')
        self.api_endpoint = config.get('api_endpoint')
        self.timeout = config.get('timeout', 300)
        self.rate_limit = config.get('rate_limit', 60)

    @abstractmethod
    def get_supported_task_types(self) -> List[str]:
        """获取支持的任务类型"""
        pass

    @abstractmethod
    def submit_task(self, task_type: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        提交任务

        Returns:
            {
                "success": True/False,
                "task_id": "平台任务ID",
                "status": "submitted/running/failed",
                "message": "提示信息",
                "raw_response": {...}  # 原始响应
            }
        """
        pass

    @abstractmethod
    def query_task(self, task_id: str) -> Dict[str, Any]:
        """
        查询任务状态

        Returns:
            {
                "success": True/False,
                "status": "pending/running/success/failed",
                "result": {...},  # 任务结果
                "error": "错误信息"
            }
        """
        pass

    @abstractmethod
    def normalize_params(self, task_type: str, raw_params: Dict[str, Any]) -> Dict[str, Any]:
        """
        将标准化参数转换为平台特定格式
        """
        pass

    @abstractmethod
    def normalize_result(self, raw_result: Dict[str, Any]) -> Dict[str, Any]:
        """
        将平台结果转换为标准格式
        """
        pass

    def check_health(self) -> bool:
        """健康检查"""
        try:
            # 简单的健康检查接口
            return True
        except:
            return False
```

### 3.2 RunningHub 适配器实现

```python
# integrations/platform_adapters/runninghub.py

from typing import Dict, Any, List
from .base import BasePlatformAdapter
from utils import get_logger

logger = get_logger(__name__)

class RunningHubAdapter(BasePlatformAdapter):
    """RunningHub 平台适配器"""

    def get_supported_task_types(self) -> List[str]:
        return ["text_to_image", "image_to_image", "text_to_video", "image_to_video"]

    def normalize_params(self, task_type: str, raw_params: Dict[str, Any]) -> Dict[str, Any]:
        """将标准化参数转换为 RunningHub 格式"""
        # RunningHub 已经使用标准化格式，直接返回
        return raw_params

    def normalize_result(self, raw_result: Dict[str, Any]) -> Dict[str, Any]:
        """将 RunningHub 结果转换为标准格式"""
        return {
            "task_id": raw_result.get("taskId"),
            "status": raw_result.get("status"),
            "result_url": raw_result.get("result", {}).get("fileUrl"),
            "preview_url": raw_result.get("result", {}).get("previewUrl"),
            "metadata": raw_result.get("result", {}).get("metadata", {}),
            "error": raw_result.get("error"),
            "raw_response": raw_result
        }

    def submit_task(self, task_type: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """提交任务到 RunningHub"""
        from integrations.api_client_wrapper import submit_api_task
        from core import API_TASK_TYPES

        if task_type not in API_TASK_TYPES:
            return {
                "success": False,
                "message": f"不支持的任务类型: {task_type}"
            }

        # 获取 API URL
        api_url = API_TASK_TYPES[task_type]["url"]

        # 调用现有的 RunningHub API
        response = submit_api_task(task_type, params, api_url)

        if response.get("code") == 200:
            return {
                "success": True,
                "task_id": response.get("taskId"),
                "status": "submitted",
                "message": "任务提交成功",
                "raw_response": response
            }
        else:
            return {
                "success": False,
                "status": "failed",
                "message": response.get("message", "提交失败"),
                "raw_response": response
            }

    def query_task(self, task_id: str) -> Dict[str, Any]:
        """查询 RunningHub 任务状态"""
        from integrations.api_client_wrapper import query_api_task

        response = query_api_task(task_id)

        if response.get("code") == 200:
            return {
                "success": True,
                "status": response.get("status"),
                "result": response.get("data"),
                "raw_response": response
            }
        else:
            return {
                "success": False,
                "error": response.get("message", "查询失败"),
                "raw_response": response
            }
```

### 3.3 平台管理器

```python
# services/platform_manager.py

from typing import Dict, Any, List, Optional
import repositories as database
from utils import get_logger

logger = get_logger(__name__)

class PlatformManager:
    """平台管理器 - 负责平台选择和路由"""

    def __init__(self):
        self.adapters: Dict[str, Any] = {}  # platform_id -> adapter instance
        self._load_adapters()

    def _load_adapters(self):
        """加载所有平台适配器"""
        # 加载 RunningHub 适配器
        from integrations.platform_adapters.runninghub import RunningHubAdapter

        # 从数据库获取启用的平台
        platforms = database.execute_sql(
            "SELECT * FROM platforms WHERE enabled = 1 ORDER BY priority DESC",
            fetch_all=True
        )

        for platform in platforms:
            platform_id = platform['platform_id']
            config = {
                'platform_id': platform_id,
                'api_key': platform.get('api_key'),
                'api_endpoint': platform.get('api_endpoint'),
                'timeout': platform.get('timeout', 300),
                'rate_limit': platform.get('rate_limit', 60),
                'priority': platform.get('priority', 5)
            }

            # 根据平台 ID 创建对应的适配器
            if platform_id == 'runninghub':
                self.adapters[platform_id] = RunningHubAdapter(config)
            # 其他平台的适配器可以在这里添加
            # elif platform_id == 'midjourney':
            #     self.adapters[platform_id] = MidjourneyAdapter(config)

            logger.info(f"✅ 已加载平台适配器: {platform['display_name']}")

    def get_available_platforms(self, task_type: str = None) -> List[Dict[str, Any]]:
        """获取可用的平台列表"""
        platforms = database.execute_sql(
            """SELECT * FROM platforms WHERE enabled = 1
               ORDER BY priority DESC""",
            fetch_all=True
        )

        if task_type:
            # 过滤支持指定任务类型的平台
            result = []
            for p in platforms:
                supported_types = eval(p['supported_task_types'])
                if task_type in supported_types:
                    result.append(p)
            return result

        return platforms

    def get_platform_adapter(self, platform_id: str):
        """获取平台适配器实例"""
        return self.adapters.get(platform_id)

    def select_platform(self, task_type: str, strategy: str = 'specified',
                       preferred_platform: str = None) -> Optional[str]:
        """
        选择平台

        Args:
            task_type: 任务类型
            strategy: 选择策略 (specified/round_robin/priority)
            preferred_platform: 用户指定的平台

        Returns:
            平台 ID
        """
        available = self.get_available_platforms(task_type)

        if not available:
            logger.error(f"没有支持 {task_type} 的平台")
            return None

        if strategy == 'specified' and preferred_platform:
            # 用户指定平台
            if preferred_platform in [p['platform_id'] for p in available]:
                return preferred_platform
            else:
                logger.warning(f"指定的平台 {preferred_platform} 不可用或不支持 {task_type}")
                # 回退到第一个可用平台
                return available[0]['platform_id']

        elif strategy == 'round_robin':
            # 轮询模式 - 根据使用统计选择
            platform_stats = database.execute_sql(
                """SELECT platform_id, COUNT(*) as task_count
                   FROM platform_stats
                   WHERE task_type = ?
                   GROUP BY platform_id""",
                (task_type,),
                fetch_all=True
            )

            # 选择使用次数最少的平台
            min_count = float('inf')
            selected_platform = None

            for p in available:
                p_id = p['platform_id']
                stats = next((s for s in platform_stats if s['platform_id'] == p_id), None)
                count = stats['task_count'] if stats else 0

                if count < min_count:
                    min_count = count
                    selected_platform = p_id

            return selected_platform or available[0]['platform_id']

        else:  # priority
            # 优先级模式 - 返回优先级最高的平台
            return available[0]['platform_id']

    def submit_task_with_platform(self, task_type: str, params: Dict[str, Any],
                                   mission_id: int, item_id: int,
                                   platform_id: str = None,
                                   strategy: str = 'specified') -> Dict[str, Any]:
        """
        使用平台策略提交任务

        Args:
            task_type: 任务类型
            params: 任务参数
            mission_id: 任务 ID
            item_id: 子任务 ID
            platform_id: 指定的平台 ID
            strategy: 平台选择策略

        Returns:
            提交结果
        """
        # 选择平台
        selected_platform = platform_id or self.select_platform(task_type, strategy)

        if not selected_platform:
            return {
                "success": False,
                "message": "没有可用的平台"
            }

        # 获取适配器
        adapter = self.get_platform_adapter(selected_platform)

        if not adapter:
            return {
                "success": False,
                "message": f"平台 {selected_platform} 的适配器未加载"
            }

        logger.info(f"📤 使用平台 {selected_platform} 提交 {task_type} 任务")

        # 标准化参数
        normalized_params = adapter.normalize_params(task_type, params)

        # 提交任务
        try:
            result = adapter.submit_task(task_type, normalized_params)

            # 记录尝试的平台
            database.execute_sql(
                """UPDATE api_mission_items
                   SET platform_id = ?, platform_attempt = ?
                   WHERE id = ?""",
                (selected_platform, json.dumps([selected_platform]), item_id)
            )

            if result['success']:
                logger.info(f"✅ 任务提交成功: task_id={result.get('task_id')}")
                return result
            else:
                logger.error(f"❌ 任务提交失败: {result.get('message')}")
                return result

        except Exception as e:
            logger.error(f"❌ 提交任务异常: {str(e)}")
            return {
                "success": False,
                "message": f"提交异常: {str(e)}"
            }

    def update_platform_stats(self, platform_id: str, task_type: str,
                              success: bool, duration: float = 0, cost: float = 0):
        """更新平台统计"""
        from datetime import date
        today = date.today()

        # 检查是否存在今天的统计记录
        existing = database.execute_sql(
            """SELECT * FROM platform_stats
               WHERE platform_id = ? AND task_type = ? AND date = ?""",
            (platform_id, task_type, today),
            fetch_one=True
        )

        if existing:
            # 更新现有记录
            if success:
                database.execute_sql(
                    """UPDATE platform_stats
                       SET total_tasks = total_tasks + 1,
                           success_tasks = success_tasks + 1,
                           avg_duration = ?,
                           total_cost = total_cost + ?,
                           last_used = CURRENT_TIMESTAMP
                       WHERE id = ?""",
                    (duration, cost, existing['id'])
                )
            else:
                database.execute_sql(
                    """UPDATE platform_stats
                       SET total_tasks = total_tasks + 1,
                           failed_tasks = failed_tasks + 1,
                           last_used = CURRENT_TIMESTAMP
                       WHERE id = ?""",
                    (existing['id'],)
                )
        else:
            # 创建新记录
            database.execute_sql(
                """INSERT INTO platform_stats
                   (platform_id, task_type, total_tasks, success_tasks,
                    failed_tasks, avg_duration, total_cost, date)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (platform_id, task_type, 1, 1 if success else 0, 0 if success else 1,
                 duration, cost, today)
            )


# 全局平台管理器实例
platform_manager = PlatformManager()
```

### 3.4 更新 API 路由

```python
# api/v1/platforms.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from services.platform_manager import platform_manager

router = APIRouter(prefix="/platforms", tags=["平台管理"])

class PlatformInfo(BaseModel):
    platform_id: str
    name: str
    display_name: str
    enabled: bool
    priority: int
    supported_task_types: List[str]
    rate_limit: int
    timeout: int
    cost_per_task: Optional[float] = None

@router.get("", response_model=List[PlatformInfo])
async def get_platforms(task_type: Optional[str] = None):
    """获取平台列表"""
    platforms = platform_manager.get_available_platforms(task_type)

    return [
        {
            "platform_id": p['platform_id'],
            "name": p['name'],
            "display_name": p['display_name'],
            "enabled": bool(p['enabled']),
            "priority": p['priority'],
            "supported_task_types": eval(p['supported_task_types']),
            "rate_limit": p['rate_limit'],
            "timeout": p['timeout'],
            "cost_per_task": p.get('cost_per_task')
        }
        for p in platforms
    ]

@router.get("/{platform_id}/stats")
async def get_platform_stats(platform_id: str, days: int = 7):
    """获取平台统计"""
    # 实现统计查询
    pass
```

### 3.5 更新任务创建接口

```python
# api/v1/api_missions.py (更新)

class CreateApiMissionRequest(BaseModel):
    """创建 API 任务请求（支持平台选择）"""
    name: str
    description: Optional[str] = None
    task_type: str  # text_to_image, image_to_image, etc.
    config: Dict = {}
    platform_strategy: str = "specified"  # specified, round_robin, priority
    platform_id: Optional[str] = None  # 指定的平台 ID

@router.post("/submit")
async def create_api_mission(request: CreateApiMissionRequest):
    """创建 API 任务（支持多平台）"""
    try:
        # 验证平台选择
        if request.platform_strategy == "specified" and not request.platform_id:
            raise ValueError("指定平台模式下必须提供 platform_id")

        # 验证平台是否支持该任务类型
        available = platform_manager.get_available_platforms(request.task_type)
        if not available:
            raise ValueError(f"没有支持 {request.task_type} 的平台")

        if request.platform_strategy == "specified":
            platform_ids = [p['platform_id'] for p in available]
            if request.platform_id not in platform_ids:
                raise ValueError(f"平台 {request.platform_id} 不支持 {request.task_type}")

        # 创建任务（记录平台策略）
        mission_id = api_task_manager.create_api_mission(
            name=request.name,
            description=request.description,
            task_type=request.task_type,
            config=request.config,
            platform_strategy=request.platform_strategy,
            platform_id=request.platform_id
        )

        return {
            "code": 0,
            "data": {
                "mission_id": mission_id,
                "platform_strategy": request.platform_strategy,
                "platform_id": request.platform_id
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

## 四、前端实现

### 4.1 新建 API 任务创建页面（多 Tab）

```typescript
// frontend/app/routes/api-create-multi.tsx

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { api } from '../lib/api';

// 任务类型配置
const TASK_TYPES = {
  text_to_image: {
    label: '文生图',
    icon: '📝',
    description: '输入文字生成图片',
    color: 'bg-blue-500'
  },
  image_to_image: {
    label: '图生图',
    icon: '🖼️',
    description: '根据参考图生成新图片',
    color: 'bg-purple-500'
  },
  text_to_video: {
    label: '文生视频',
    icon: '🎬',
    description: '输入文字生成视频',
    color: 'bg-green-500'
  },
  image_to_video: {
    label: '图生视频',
    icon: '🎞️',
    description: '根据图片生成视频',
    color: 'bg-orange-500'
  }
};

// 平台选择策略
const PLATFORM_STRATEGIES = {
  specified: {
    label: '指定平台',
    description: '手动选择使用的平台'
  },
  round_robin: {
    label: '自动轮询',
    description: '系统自动选择负载最低的平台'
  },
  priority: {
    label: '优先级模式',
    description: '使用优先级最高的平台'
  }
};

export default function ApiCreateMultiPage() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('text_to_image');
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [loadingPlatforms, setLoadingPlatforms] = useState(true);

  const [taskName, setTaskName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [platformStrategy, setPlatformStrategy] = useState('specified');
  const [selectedPlatform, setSelectedPlatform] = useState('runninghub');

  const [batchInput, setBatchInput] = useState<any[]>([{}]);
  const [submitting, setSubmitting] = useState(false);

  // 加载平台列表
  useEffect(() => {
    loadPlatforms();
  }, [activeTab]);

  const loadPlatforms = async () => {
    try {
      const result = await api.getPlatforms(activeTab);
      setPlatforms(result.data || []);

      // 默认选择第一个平台
      if (result.data && result.data.length > 0) {
        setSelectedPlatform(result.data[0].platform_id);
      }
    } catch (err) {
      console.error('加载平台失败:', err);
    } finally {
      setLoadingPlatforms(false);
    }
  };

  // 添加批量输入项
  const addBatchItem = () => {
    setBatchInput([...batchInput, {}]);
  };

  // 更新批量输入项
  const updateBatchItem = (index: number, key: string, value: any) => {
    const newBatch = [...batchInput];
    newBatch[index] = { ...newBatch[index], [key]: value };
    setBatchInput(newBatch);
  };

  // 提交任务
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await api.createApiMission({
        name: taskName,
        description: taskDescription,
        task_type: activeTab,
        config: {
          batch_input: batchInput
        },
        platform_strategy: platformStrategy,
        platform_id: platformStrategy === 'specified' ? selectedPlatform : undefined
      });

      navigate('/api-tasks');
    } catch (err: any) {
      alert(`提交失败: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 渲染任务类型表单
  const renderTaskForm = (taskType: string) => {
    const config = TASK_TYPES[taskType];

    return (
      <div className="space-y-6">
        {/* 平台选择 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">选择平台</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 策略选择 */}
            <div>
              <label className="text-sm font-medium">平台选择策略</label>
              <div className="grid grid-cols-3 gap-4 mt-2">
                {Object.entries(PLATFORM_STRATEGIES).map(([key, strategy]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPlatformStrategy(key)}
                    className={`p-4 rounded-lg border-2 text-left transition
                      ${platformStrategy === key
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                      }`}
                  >
                    <div className="font-medium">{strategy.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {strategy.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 指定平台 */}
            {platformStrategy === 'specified' && (
              <div>
                <label className="text-sm font-medium">选择平台</label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  {platforms.map((platform) => (
                    <button
                      key={platform.platform_id}
                      type="button"
                      onClick={() => setSelectedPlatform(platform.platform_id)}
                      className={`p-4 rounded-lg border-2 text-left transition
                        ${selectedPlatform === platform.platform_id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{platform.display_name}</span>
                        <Badge variant="outline">优先级 {platform.priority}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        速率限制: {platform.rate_limit} 请求/分钟
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 批量输入 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">批量输入</CardTitle>
              <Button type="button" onClick={addBatchItem} size="sm">
                + 添加
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {batchInput.map((item, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">任务 #{index + 1}</h4>
                  {batchInput.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setBatchInput(batchInput.filter((_, i) => i !== index))}
                    >
                      删除
                    </Button>
                  )}
                </div>

                {/* 根据任务类型渲染不同的输入字段 */}
                {taskType === 'text_to_image' && (
                  <>
                    <div>
                      <label className="text-sm">提示词</label>
                      <textarea
                        className="w-full mt-1 p-2 border rounded"
                        rows={3}
                        placeholder="描述你想要生成的图片..."
                        value={item.prompt || ''}
                        onChange={(e) => updateBatchItem(index, 'prompt', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm">宽高比</label>
                      <select
                        className="w-full mt-1 p-2 border rounded"
                        value={item.aspectRatio || '16:9'}
                        onChange={(e) => updateBatchItem(index, 'aspectRatio', e.target.value)}
                      >
                        <option value="16:9">16:9 (横屏)</option>
                        <option value="9:16">9:16 (竖屏)</option>
                        <option value="1:1">1:1 (正方形)</option>
                        <option value="4:3">4:3 (标准)</option>
                        <option value="3:4">3:4 (竖版标准)</option>
                      </select>
                    </div>
                  </>
                )}

                {taskType === 'image_to_image' && (
                  <>
                    <div>
                      <label className="text-sm">参考图片</label>
                      <input
                        type="file"
                        className="w-full mt-1"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) updateBatchItem(index, 'image', file);
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-sm">提示词</label>
                      <textarea
                        className="w-full mt-1 p-2 border rounded"
                        rows={3}
                        placeholder="描述你想要生成的变化..."
                        value={item.prompt || ''}
                        onChange={(e) => updateBatchItem(index, 'prompt', e.target.value)}
                      />
                    </div>
                  </>
                )}

                {/* 其他任务类型的输入... */}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 提交按钮 */}
        <div className="flex gap-4">
          <Button onClick={handleSubmit} disabled={submitting} className="flex-1">
            {submitting ? '提交中...' : '提交任务'}
          </Button>
          <Button variant="outline" onClick={() => navigate('/api-tasks')}>
            取消
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>创建 API 任务</CardTitle>
        </CardHeader>
        <CardContent>
          {/* 基本信息 */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">任务名称</label>
              <input
                type="text"
                className="w-full mt-1 p-2 border rounded"
                placeholder="给你的任务起个名字..."
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">任务描述（可选）</label>
              <textarea
                className="w-full mt-1 p-2 border rounded"
                rows={2}
                placeholder="描述一下你的任务..."
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 任务类型 Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          {Object.entries(TASK_TYPES).map(([key, config]) => (
            <TabsTrigger key={key} value={key} className="flex items-center gap-2">
              <span>{config.icon}</span>
              <span>{config.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(TASK_TYPES).map(([key, config]) => (
          <TabsContent key={key} value={key}>
            <Card>
              <CardHeader>
                <CardTitle>{config.icon} {config.label}</CardTitle>
                <p className="text-sm text-muted-foreground">{config.description}</p>
              </CardHeader>
              <CardContent>
                {renderTaskForm(key)}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
```

### 4.2 更新 API 客户端

```typescript
// frontend/app/lib/api.ts (添加)

// 获取平台列表
getPlatforms: (taskType?: string) => {
  const params = taskType ? `?task_type=${taskType}` : '';
  return request.get<any[]>(`/api/v1/platforms${params}`);
},

// 获取平台统计
getPlatformStats: (platformId: string, days: number = 7) => {
  return request.get(`/api/v1/platforms/${platformId}/stats?days=${days}`);
},

// 更新创建任务接口
createApiMission: (data: {
  name: string;
  description?: string;
  task_type: string;
  config: any;
  platform_strategy?: string;
  platform_id?: string;
}) => {
  return request.post('/api/v1/api_missions/submit', data);
},
```

---

## 五、实施步骤

### Phase 1: 数据库和基础架构（1-2天）

- [ ] **1.1 数据库迁移**
  - [ ] 创建 `platforms` 表
  - [ ] 创建 `platform_stats` 表
  - [ ] 修改 `api_missions` 表添加平台字段
  - [ ] 修改 `api_mission_items` 表添加平台字段
  - [ ] 初始化平台数据（RunningHub + 占位符）
  - [ ] 创建索引

- [ ] **1.2 平台适配器框架**
  - [ ] 创建 `BasePlatformAdapter` 抽象类
  - [ ] 实现 `RunningHubAdapter`
  - [ ] 编写单元测试

- [ ] **1.3 平台管理器**
  - [ ] 实现 `PlatformManager` 类
  - [ ] 实现平台加载逻辑
  - [ ] 实现平台选择策略
  - [ ] 实现统计更新

### Phase 2: 后端 API（2-3天）

- [ ] **2.1 平台管理接口**
  - [ ] `GET /api/v1/platforms` - 获取平台列表
  - [ ] `GET /api/v1/platforms/{id}/stats` - 获取平台统计
  - [ ] `POST /api/v1/platforms` - 添加平台（管理员）
  - [ ] `PUT /api/v1/platforms/{id}` - 更新平台配置（管理员）

- [ ] **2.2 更新任务接口**
  - [ ] 修改 `POST /api/v1/api_missions/submit` 支持平台参数
  - [ ] 修改 `GET /api/v1/api_missions/{id}` 返回平台信息
  - [ ] 修改 `GET /api/v1/api_mission_items` 返回平台信息

- [ ] **2.3 集成平台路由**
  - [ ] 修改 `ApiTaskManager` 使用 `PlatformManager`
  - [ ] 实现平台选择和任务提交
  - [ ] 实现平台统计收集

### Phase 3: 前端多 Tab 页面（2-3天）

- [ ] **3.1 创建页面组件**
  - [ ] 创建 `api-create-multi.tsx`
  - [ ] 实现 4 个任务类型 Tab
  - [ ] 实现平台选择 UI
  - [ ] 实现批量输入表单

- [ ] **3.2 平台展示组件**
  - [ ] 平台卡片组件
  - [ ] 平台策略选择器
  - [ ] 平台统计展示

- [ ] **3.3 任务类型表单**
  - [ ] 文生图表单
  - [ ] 图生图表单
  - [ ] 文生视频表单
  - [ ] 图生视频表单

### Phase 4: 列表和详情更新（1-2天）

- [ ] **4.1 更新列表页面**
  - [ ] 添加平台列
  - [ ] 添加平台徽章
  - [ ] 添加平台筛选

- [ ] **4.2 更新详情页面**
  - [ ] 显示使用的平台
  - [ ] 显示平台统计
  - [ ] 添加平台对比功能

### Phase 5: 测试和优化（1-2天）

- [ ] **5.1 功能测试**
  - [ ] 测试指定平台模式
  - [ ] 测试轮询模式
  - [ ] 测试优先级模式
  - [ ] 测试平台失败回退

- [ ] **5.2 性能优化**
  - [ ] 平台适配器缓存
  - [ ] 统计数据聚合
  - [ ] 前端性能优化

- [ ] **5.3 文档和部署**
  - [ ] 更新 API 文档
  - [ ] 编写用户指南
  - [ ] 准备部署配置

---

## 六、预期效果

### 6.1 用户体验

- ✅ **更清晰的分类**: 4 个 Tab 分别对应不同的 AI 生成类型
- ✅ **更灵活的选择**: 可以指定平台或让系统自动选择
- ✅ **更透明的信息**: 显示使用的平台、成本、成功率等

### 6.2 系统优势

- ✅ **可扩展性**: 轻松添加新平台
- ✅ **可维护性**: 统一的适配器接口
- ✅ **可靠性**: 平台失败自动切换
- ✅ **可观测性**: 完整的平台统计

### 6.3 成本优化

- ✅ **负载均衡**: 轮询模式分散负载
- ✅ **成本控制**: 可以选择低成本平台
- ✅ **性能优化**: 根据统计选择最优平台

---

## 七、后续扩展

### 7.1 智能路由

```python
# 基于机器学习的智能平台选择
def select_platform_smart(self, task_type: str, params: Dict) -> str:
    """根据历史数据智能选择平台"""
    # 考虑因素：
    # - 历史成功率
    # - 平均完成时间
    # - 当前成本
    # - 任务特征相似度
    # - 平台当前负载
    pass
```

### 7.2 更多平台

- Midjourney
- Stability AI
- Replicate
- Hugging Face
- 自建服务

### 7.3 高级功能

- 平台 A/B 测试
- 成本预算管理
- 任务优先级队列
- 平台健康监控

---

## 八、风险和挑战

### 8.1 技术挑战

| 挑战 | 解决方案 |
|------|---------|
| 平台 API 差异大 | 使用适配器模式统一接口 |
| 参数格式不统一 | 标准化参数映射 |
| 速率限制不同 | 分布式限流和队列 |
| 错误处理不一致 | 统一错误处理层 |

### 8.2 运营挑战

| 挑战 | 解决方案 |
|------|---------|
| API Key 管理 | 加密存储 + 访问控制 |
| 成本控制 | 预算限制 + 告警 |
| 服务稳定性 | 健康检查 + 自动降级 |

---

**文档版本**: 1.0
**创建日期**: 2026-02-02
**预计总工作量**: 8-12 天
**优先级**: 高
**状态**: 待审批
