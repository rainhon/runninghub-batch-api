"""
平台管理器
负责平台选择和路由
"""
from typing import Dict, Any, List, Optional
import json
import time
from core import get_platforms_for_task_type, get_platform_api_key, get_platform_config, get_enabled_platforms
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

            logger.info(f"✅ 已加载平台适配器: {platform_config['display_name']} (优先级: {config['priority']})")

        logger.info(f"📊 共加载 {len(self.adapters)} 个平台适配器")

    def get_available_platforms(self, task_type: str = None) -> List[Dict[str, Any]]:
        """
        获取可用的平台列表

        Args:
            task_type: 可选，按任务类型过滤

        Returns:
            平台列表
        """
        if task_type:
            return get_platforms_for_task_type(task_type)
        else:
            return get_enabled_platforms()

    def get_platform_adapter(self, platform_id: str):
        """
        获取平台适配器实例

        Args:
            platform_id: 平台 ID

        Returns:
            平台适配器实例
        """
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
            logger.error(f"❌ 没有支持 {task_type} 的平台")
            return None

        if strategy == 'specified' and preferred_platform:
            # 用户指定平台
            if preferred_platform in [p['platform_id'] for p in available]:
                logger.info(f"✅ 使用用户指定的平台: {preferred_platform}")
                return preferred_platform
            else:
                logger.warning(f"⚠️ 指定的平台 {preferred_platform} 不可用或不支持 {task_type}，回退到优先级最高的平台")
                return available[0]['platform_id']

        elif strategy == 'failover':
            # 故障转移模式 - 轮询尝试不同平台
            # 如果指定了首选平台，先尝试它
            if preferred_platform and preferred_platform in [p['platform_id'] for p in available]:
                if not attempted_platforms or preferred_platform not in attempted_platforms:
                    logger.info(f"🎯 尝试首选平台: {preferred_platform}")
                    return preferred_platform

            # 获取未尝试过的平台（按优先级排序）
            attempted = attempted_platforms or []
            remaining = [p for p in available if p['platform_id'] not in attempted]

            if remaining:
                selected = remaining[0]['platform_id']
                logger.info(f"🔄 故障转移: 尝试下一个平台 {selected} (已尝试: {attempted})")
                return selected
            else:
                logger.error(f"❌ 所有平台都已尝试失败: {attempted}")
                return None

        else:  # priority
            # 优先级模式 - 返回优先级最高的平台（已按优先级排序）
            selected = available[0]['platform_id']
            logger.info(f"📊 优先级模式选择平台: {selected}")
            return selected

    def submit_task_with_platform(self, task_type: str, params: Dict[str, Any],
                                   mission_id: int, item_id: int,
                                   platform_id: str = None,
                                   strategy: str = 'specified',
                                   attempted_platforms: List[str] = None) -> Dict[str, Any]:
        """
        使用平台策略提交任务

        Args:
            task_type: 任务类型
            params: 任务参数
            mission_id: 任务 ID
            item_id: 子任务 ID
            platform_id: 指定的平台 ID
            strategy: 平台选择策略
                - specified: 使用指定的平台
                - failover: 任务失败时自动切换平台重试
                - priority: 使用优先级最高的平台
            attempted_platforms: 已经尝试过的平台列表

        Returns:
            提交结果
        """
        import repositories as database

        # 选择平台
        selected_platform = self.select_platform(
            task_type,
            strategy,
            platform_id,
            attempted_platforms
        )

        if not selected_platform:
            return {
                "success": False,
                "status": "failed",
                "message": "没有可用的平台"
            }

        # 获取适配器
        adapter = self.get_platform_adapter(selected_platform)

        if not adapter:
            return {
                "success": False,
                "status": "failed",
                "message": f"平台 {selected_platform} 的适配器未加载"
            }

        logger.info(f"📤 使用平台 {selected_platform} 提交 {task_type} 任务")

        # 标准化参数
        normalized_params = adapter.normalize_params(task_type, params)

        # 提交任务
        try:
            result = adapter.submit_task(task_type, normalized_params)

            # 更新使用的平台、平台任务ID和尝试的平台列表
            current_attempted = (attempted_platforms or []) + [selected_platform]
            database.execute_sql(
                """UPDATE api_mission_items
                   SET platform_id = ?, platform_task_id = ?, platform_attempt = ?
                   WHERE id = ?""",
                (selected_platform, result.get('task_id'), json.dumps(current_attempted), item_id)
            )

            if result['success']:
                logger.info(f"✅ 任务提交成功: task_id={result.get('task_id')}, platform={selected_platform}")
                return result
            else:
                logger.warning(f"⚠️ 任务提交失败: {result.get('message')}, platform={selected_platform}")

                # 如果是故障转移模式，尝试下一个平台
                if strategy == 'failover':
                    logger.info(f"🔄 启用故障转移，尝试下一个平台...")
                    return self.submit_task_with_platform(
                        task_type=task_type,
                        params=params,
                        mission_id=mission_id,
                        item_id=item_id,
                        platform_id=platform_id,  # 保持用户指定的首选平台
                        strategy='failover',
                        attempted_platforms=current_attempted
                    )
                else:
                    return result

        except Exception as e:
            logger.error(f"❌ 提交任务异常: {str(e)}, platform={selected_platform}")

            # 如果是故障转移模式，遇到异常也尝试下一个平台
            if strategy == 'failover':
                current_attempted = (attempted_platforms or []) + [selected_platform]
                logger.info(f"🔄 启用故障转移，尝试下一个平台...")
                return self.submit_task_with_platform(
                    task_type=task_type,
                    params=params,
                    mission_id=mission_id,
                    item_id=item_id,
                    platform_id=platform_id,
                    strategy='failover',
                    attempted_platforms=current_attempted
                )
            else:
                return {
                    "success": False,
                    "status": "failed",
                    "message": f"提交异常: {str(e)}"
                }


# 全局平台管理器实例
platform_manager = PlatformManager()
