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
│  • 故障转移模式: 任务失败时自动切换到下一个平台重试            │
│  • 优先级模式: 使用优先级最高的平台                          │
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
  FAILOVER = "failover",      // 故障转移（失败时自动切换平台）
  PRIORITY = "priority"       // 按优先级尝试
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

## 二、配置文件设计

### 2.1 平台配置文件 (core/platforms.py)

将平台配置放在配置文件中，便于管理和版本控制。

```python
# core/platforms.py

from typing import Dict, List, Any

# 平台配置列表
PLATFORMS_CONFIG: List[Dict[str, Any]] = [
    {
        "platform_id": "runninghub",
        "name": "RunningHub",
        "display_name": "RunningHub",
        "enabled": True,
        "priority": 10,
        "supported_task_types": ["text_to_image", "image_to_image", "text_to_video", "image_to_video"],
        "api_key_env": "RUNNINGHUB_DIRECT_API_KEY",  # 环境变量名
        "api_endpoint": "https://www.runninghub.cn/openapi/v2",
        "rate_limit": 60,  # 请求/分钟
        "timeout": 300,   # 秒
        "cost_per_task": 0.0,
        "endpoints": {
            "text_to_image": "/rhart-image-v1/text-to-image",
            "image_to_image": "/rhart-image-v1/image-to-image",
            "text_to_video": "/rhart-video-v1/text-to-video",
            "image_to_video": "/rhart-video-v1/image-to-video"
        }
    },
    {
        "platform_id": "midjourney",
        "name": "Midjourney",
        "display_name": "Midjourney",
        "enabled": False,  # 默认禁用，需要配置后启用
        "priority": 8,
        "supported_task_types": ["text_to_image", "image_to_image"],
        "api_key_env": "MIDJOURNEY_API_KEY",
        "api_endpoint": "https://api.midjourney.com/v1",
        "rate_limit": 30,
        "timeout": 600,
        "cost_per_task": 0.0,
        "endpoints": {
            "text_to_image": "/txt2img",
            "image_to_image": "/img2img"
        }
    },
    {
        "platform_id": "stability",
        "name": "Stability AI",
        "display_name": "Stability AI",
        "enabled": False,
        "priority": 7,
        "supported_task_types": ["text_to_image", "image_to_image"],
        "api_key_env": "STABILITY_API_KEY",
        "api_endpoint": "https://api.stability.ai/v1",
        "rate_limit": 50,
        "timeout": 300,
        "cost_per_task": 0.0,
        "endpoints": {
            "text_to_image": "/text-to-image",
            "image_to_image": "/image-to-image"
        }
    },
    {
        "platform_id": "replicate",
        "name": "Replicate",
        "display_name": "Replicate",
        "enabled": False,
        "priority": 6,
        "supported_task_types": ["text_to_image", "image_to_video"],
        "api_key_env": "REPLICATE_API_KEY",
        "api_endpoint": "https://api.replicate.com/v1",
        "rate_limit": 100,
        "timeout": 600,
        "cost_per_task": 0.0,
        "endpoints": {
            "text_to_image": "/predictions",
            "image_to_video": "/predictions"
        }
    }
]


def get_platform_config(platform_id: str) -> Dict[str, Any]:
    """获取指定平台的配置"""
    for platform in PLATFORMS_CONFIG:
        if platform["platform_id"] == platform_id:
            return platform
    raise ValueError(f"未找到平台配置: {platform_id}")


def get_enabled_platforms() -> List[Dict[str, Any]]:
    """获取所有启用的平台"""
    return [p for p in PLATFORMS_CONFIG if p.get("enabled", False)]


def get_platforms_for_task_type(task_type: str) -> List[Dict[str, Any]]:
    """获取支持指定任务类型的平台（按优先级排序）"""
    platforms = get_enabled_platforms()
    filtered = [p for p in platforms if task_type in p.get("supported_task_types", [])]
    # 按优先级降序排序
    return sorted(filtered, key=lambda x: x.get("priority", 0), reverse=True)


def get_platform_api_key(platform_id: str) -> str:
    """获取平台的 API Key"""
    import os
    from core import _get_use_mock_service

    # Mock 模式返回测试 Key
    if _get_use_mock_service():
        return f"mock_{platform_id}_api_key"

    config = get_platform_config(platform_id)
    env_key = config.get("api_key_env")

    if not env_key:
        raise ValueError(f"平台 {platform_id} 未配置 api_key_env")

    api_key = os.getenv(env_key, "")
    if not api_key:
        raise ValueError(f"环境变量 {env_key} 未设置")

    return api_key
```

### 2.2 更新 core/config.py

```python
# core/config.py 添加

from core import platforms

# 导出平台配置
from .platforms import (
    PLATFORMS_CONFIG,
    get_platform_config,
    get_enabled_platforms,
    get_platforms_for_task_type,
    get_platform_api_key
)

__all__ = [
    # ... 现有的导出
    'PLATFORMS_CONFIG',
    'get_platform_config',
    'get_enabled_platforms',
    'get_platforms_for_task_type',
    'get_platform_api_key'
]
```

### 2.3 数据库修改（最小化）

只需要在现有表中添加平台记录字段，不需要创建新表。

```sql
-- 修改 api_missions 表
ALTER TABLE api_missions ADD COLUMN platform_strategy TEXT DEFAULT 'specified';
ALTER TABLE api_missions ADD COLUMN platform_id TEXT;

-- 修改 api_mission_items 表
ALTER TABLE api_mission_items ADD COLUMN platform_id TEXT;
ALTER TABLE api_mission_items ADD COLUMN platform_attempt TEXT;  -- 尝试的平台列表 JSON

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_api_missions_platform ON api_missions(platform_id);
CREATE INDEX IF NOT EXISTS idx_api_mission_items_platform ON api_mission_items(platform_id);
```

---

## 二、配置文件设计

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
import json
from core import get_platforms_for_task_type, get_platform_api_key, get_platform_config
from utils import get_logger

logger = get_logger(__name__)

class PlatformManager:
    """平台管理器 - 负责平台选择和路由"""

    def __init__(self):
        self.adapters: Dict[str, Any] = {}  # platform_id -> adapter instance
        self._load_adapters()

    def _load_adapters(self):
        """加载所有平台适配器"""
        from integrations.platform_adapters.runninghub import RunningHubAdapter
        from core import get_enabled_platforms

        # 从配置获取启用的平台
        platforms = get_enabled_platforms()

        for platform_config in platforms:
            platform_id = platform_config['platform_id']

            # 构建适配器配置
            config = {
                'platform_id': platform_id,
                'api_key': get_platform_api_key(platform_id),
                'api_endpoint': platform_config.get('api_endpoint'),
                'timeout': platform_config.get('timeout', 300),
                'rate_limit': platform_config.get('rate_limit', 60),
                'priority': platform_config.get('priority', 5)
            }

            # 根据平台 ID 创建对应的适配器
            if platform_id == 'runninghub':
                self.adapters[platform_id] = RunningHubAdapter(config)
            # 其他平台的适配器可以在这里添加
            # elif platform_id == 'midjourney':
            #     from integrations.platform_adapters.midjourney import MidjourneyAdapter
            #     self.adapters[platform_id] = MidjourneyAdapter(config)

            logger.info(f"✅ 已加载平台适配器: {platform_config['display_name']}")

    def get_available_platforms(self, task_type: str = None) -> List[Dict[str, Any]]:
        """获取可用的平台列表"""
        if task_type:
            return get_platforms_for_task_type(task_type)
        else:
            from core import get_enabled_platforms
            return get_enabled_platforms()

    def get_platform_adapter(self, platform_id: str):
        """获取平台适配器实例"""
        return self.adapters.get(platform_id)

    def select_platform(self, task_type: str, strategy: str = 'specified',
                       preferred_platform: str = None,
                       attempted_platforms: List[str] = None) -> Optional[str]:
        """
        选择平台

        Args:
            task_type: 任务类型
            strategy: 选择策略 (specified/failover/priority)
            preferred_platform: 用户指定的平台
            attempted_platforms: 已经尝试过的平台列表（用于 failover 策略）

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

        elif strategy == 'failover':
            # 故障转移模式 - 轮询尝试不同平台
            # 如果指定了首选平台，先尝试它
            if preferred_platform and preferred_platform in [p['platform_id'] for p in available]:
                if not attempted_platforms or preferred_platform not in attempted_platforms:
                    return preferred_platform

            # 获取未尝试过的平台（按优先级排序）
            attempted = attempted_platforms or []
            remaining = [p for p in available if p['platform_id'] not in attempted]

            if remaining:
                return remaining[0]['platform_id']
            else:
                logger.error(f"所有平台都已尝试失败: {attempted}")
                return None

        else:  # priority
            # 优先级模式 - 返回优先级最高的平台（已按优先级排序）
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
        import repositories as database

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

            # 记录使用的平台
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


# 全局平台管理器实例
platform_manager = PlatformManager()
```

### 3.4 更新 API 路由

```python
# api/v1/platforms.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from core import get_platforms_for_task_type, get_enabled_platforms

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
    if task_type:
        platforms = get_platforms_for_task_type(task_type)
    else:
        platforms = get_enabled_platforms()

    return [
        {
            "platform_id": p['platform_id'],
            "name": p['name'],
            "display_name": p['display_name'],
            "enabled": p.get('enabled', False),
            "priority": p.get('priority', 0),
            "supported_task_types": p.get('supported_task_types', []),
            "rate_limit": p.get('rate_limit', 60),
            "timeout": p.get('timeout', 300),
            "cost_per_task": p.get('cost_per_task')
        }
        for p in platforms
    ]
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
    platform_strategy: str = "specified"  # specified, failover, priority
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

### 4.1 更新现有 API 任务创建页面

**不再创建新页面**，直接修改现有的 `frontend/app/routes/api-create.tsx`，添加以下功能：

#### 添加平台选择组件

```typescript
// 在现有页面中添加平台选择区域

// 1. 添加状态管理
const [platforms, setPlatforms] = useState<any[]>([]);
const [platformStrategy, setPlatformStrategy] = useState('specified');
const [selectedPlatform, setSelectedPlatform] = useState('runninghub');

// 2. 加载平台列表
useEffect(() => {
  loadPlatforms();
}, [taskType]);

const loadPlatforms = async () => {
  try {
    const result = await api.getPlatforms(taskType);
    setPlatforms(result.data || []);
    if (result.data && result.data.length > 0) {
      setSelectedPlatform(result.data[0].platform_id);
    }
  } catch (err) {
    console.error('加载平台失败:', err);
  }
};

// 3. 在表单中添加平台选择 UI
<Card>
  <CardHeader>
    <CardTitle>平台设置</CardTitle>
  </CardHeader>
  <CardContent>
    {/* 平台策略选择 */}
    <div className="mb-4">
      <label className="text-sm font-medium">平台策略</label>
      <select
        className="w-full mt-1 p-2 border rounded"
        value={platformStrategy}
        onChange={(e) => setPlatformStrategy(e.target.value)}
      >
        <option value="specified">指定平台</option>
        <option value="failover">故障转移</option>
        <option value="priority">优先级模式</option>
      </select>
    </div>

    {/* 指定平台时显示平台列表 */}
    {platformStrategy === 'specified' && (
      <div>
        <label className="text-sm font-medium">选择平台</label>
        <div className="grid grid-cols-2 gap-3 mt-2">
          {platforms.map((platform) => (
            <button
              key={platform.platform_id}
              type="button"
              onClick={() => setSelectedPlatform(platform.platform_id)}
              className={`p-3 rounded-lg border-2 text-left transition ${
                selectedPlatform === platform.platform_id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="font-medium">{platform.display_name}</div>
              <div className="text-xs text-muted-foreground">
                优先级 {platform.priority}
              </div>
            </button>
          ))}
        </div>
      </div>
    )}
  </CardContent>
</Card>
```

#### 修改表单提交逻辑

```typescript
// 在提交时添加平台参数
const handleSubmit = async () => {
  try {
    await api.createApiMission({
      name: taskName,
      description: taskDescription,
      task_type: taskType,
      config: config,
      // 新增平台参数
      platform_strategy: platformStrategy,
      platform_id: platformStrategy === 'specified' ? selectedPlatform : undefined
    });

    navigate('/api-tasks');
  } catch (err) {
    // 错误处理
  }
};
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

### Phase 1: 配置文件和基础架构（1天）✅ 已完成

- [x] **1.1 平台配置文件**
  - [x] 创建 `core/platforms.py`
  - [x] 定义平台配置列表（RunningHub + 其他平台占位符）
  - [x] 实现平台查询函数
  - [x] 更新 `core/__init__.py` 导出平台配置

- [x] **1.2 数据库迁移（最小化）**
  - [x] 修改 `api_missions` 表添加 `platform_strategy` 和 `platform_id` 字段
  - [x] 修改 `api_mission_items` 表添加 `platform_id`、`platform_task_id` 和 `platform_attempt` 字段
  - [x] 创建索引
  - [x] 创建迁移脚本 `migrations/add_platform_fields.sql`

- [x] **1.3 平台适配器框架**
  - [x] 创建 `integrations/platform_adapters/base.py`
  - [x] 创建 `integrations/platform_adapters/runninghub.py`
  - [x] 实现 `RunningHubAdapter` 类
  - [ ] 编写单元测试（可选）

- [x] **1.4 平台管理器**
  - [x] 创建 `services/platform_manager.py`
  - [x] 实现 `PlatformManager` 类
  - [x] 实现平台加载逻辑
  - [x] 实现平台选择策略（specified/failover/priority）
  - [x] 实现故障转移机制（任务失败时自动切换平台重试）
  - [x] 创建测试脚本 `tests/test_multi_platform.py`

### Phase 2: 后端 API（1-2天）✅ 已完成

- [x] **2.1 平台管理接口**
  - [x] 创建 `api/v1/platforms.py`
  - [x] 实现 `GET /api/v1/platforms` - 获取平台列表
  - [x] 支持按任务类型过滤
  - [x] 实现 `GET /api/v1/platforms/task-types` - 获取任务类型列表
  - [x] 更新路由配置

- [x] **2.2 更新任务接口**
  - [x] 修改 `POST /api/v1/api_missions/submit` 支持平台参数
  - [x] 更新 `services/api_task_service.py` 使用 PlatformManager
  - [x] 修改 `GET /api/v1/api_missions/{id}` 返回平台信息（已有字段）
  - [x] 修改 `GET /api/v1/api_mission_items` 返回平台信息（已有字段）

- [x] **2.3 集成平台路由**
  - [x] 修改 `ApiTaskManager.create_api_mission()` 接受平台参数
  - [x] 实现平台选择和任务提交
  - [x] 记录平台使用情况到数据库
  - [x] 集成平台管理器到任务服务
  - [x] 拆分 `_submit_and_start_polling` 方法，提高代码可维护性

### 2.4 数据持久化和恢复 ✅ 已完成

- [x] **数据库字段设计**
  - [x] `api_missions.platform_strategy`: 平台选择策略
  - [x] `api_missions.platform_id`: 用户指定的平台ID
  - [x] `api_mission_items.platform_id`: 实际使用的平台
  - [x] `api_mission_items.platform_task_id`: 平台返回的任务ID（不同平台格式不同）
  - [x] `api_mission_items.platform_attempt`: 已尝试的平台列表JSON

- [x] **PollingTask 数据结构**
  - [x] 添加 `platform_id` 字段
  - [x] 添加 `platform_task_id` 字段
  - [x] 添加 `platform_attempt` 字段

- [x] **任务提交流程**
  - [x] 使用 `platform_manager.submit_task_with_platform()` 提交
  - [x] 保存平台ID和任务ID到数据库
  - [x] 记录已尝试的平台列表

- [x] **轮询查询流程**
  - [x] 创建 `_query_task_status()` 方法
  - [x] 使用平台适配器查询任务状态
  - [x] 使用 `platform_task_id` 进行查询

- [x] **系统恢复流程**
  - [x] 从数据库恢复 `platform_id`
  - [x] 从数据库恢复 `platform_task_id`
  - [x] 从数据库恢复 `platform_attempt`
  - [x] 重新创建轮询任务并启动

### Phase 3: 前端更新（1天）

- [ ] **3.1 更新 API 任务创建页面**
  - [x] 不创建新页面，直接修改 `frontend/app/routes/api-create.tsx`
  - [ ] 添加平台选择状态管理
  - [ ] 添加平台列表加载功能
  - [ ] 在表单中添加平台设置区域
  - [ ] 修改表单提交逻辑，添加平台参数

- [ ] **3.2 平台选择 UI**
  - [ ] 实现平台策略选择器（指定/故障转移/优先级）
  - [ ] 实现平台列表展示（指定模式时）
  - [ ] 添加平台选择交互

- [ ] **3.3 更新任务列表和详情**
  - [ ] 在任务列表中显示使用平台
  - [ ] 在任务详情中显示平台信息
  - [ ] 添加平台徽章显示

- [ ] **3.4 更新 API 客户端**
  - [ ] 添加 `getPlatforms()` 方法
  - [ ] 添加 `getTaskTypes()` 方法
  - [ ] 更新 `createApiMission()` 支持平台参数
  - [ ] 更新类型定义

### Phase 4: 测试和文档（1天）

- [ ] **4.1 功能测试**
  - [ ] 测试指定平台模式
  - [ ] 测试故障转移模式
  - [ ] 测试优先级模式
  - [ ] 测试各任务类型
  - [ ] 测试系统恢复功能

- [ ] **4.2 配置说明**
  - [ ] 更新 `.env.example` 添加其他平台 API Key 占位符
  - [ ] 更新 README 说明如何启用新平台
  - [ ] 编写平台配置指南

- [ ] **4.3 数据库迁移**
  - [ ] 执行迁移脚本
  - [ ] 验证表结构
  - [ ] 测试数据恢复

---

## 六、预期效果

### 6.1 用户体验

- ✅ **灵活的平台选择**: 可以指定平台、故障转移或优先级模式
- ✅ **透明的信息**: 显示使用的平台和策略
- ✅ **无缝集成**: 在现有页面中添加平台功能，不需要学习新界面

### 6.2 系统优势

- ✅ **可扩展性**: 轻松添加新平台（修改配置文件）
- ✅ **可维护性**: 统一的适配器接口
- ✅ **配置简单**: 平台配置集中在配置文件中
- ✅ **版本控制**: 配置变更可以被 git 追踪

### 6.3 成本优化

- ✅ **负载均衡**: 轮询模式分散负载
- ✅ **灵活配置**: 可以根据成本选择平台

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

**文档版本**: 2.3
**创建日期**: 2026-02-02
**最后更新**: 2026-02-02
- ✅ Phase 1 已完成
- ✅ Phase 2 已完成
- ⏸️ Phase 3 待开始（修改现有页面，不新建）
- ⏸️ Phase 4 待开始
**预计总工作量**: 3-4 天
**优先级**: 高
**状态**: 后端完成，前端待开发（修改现有页面）
