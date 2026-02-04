"""
平台管理器
负责加载和管理平台适配器
"""
from typing import Dict, Any
from core import get_platform_api_key, get_enabled_platforms, USE_MOCK_SERVICE
from utils import get_logger

logger = get_logger(__name__)


class PlatformManager:
    """平台管理器 - 负责加载和管理平台适配器"""

    def __init__(self):
        self.adapters: Dict[str, Any] = {}  # platform_id -> adapter instance
        self._load_adapters()

    def _load_adapters(self):
        """加载所有平台适配器"""
        # 如果启用了 Mock 服务，加载 Mock 适配器
        if USE_MOCK_SERVICE:
            logger.info("🔶 Mock 服务已启用，加载 Mock 适配器")
            self._load_mock_adapter()
            return

        # 否则加载真实平台适配器
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

    def _load_mock_adapter(self):
        """加载 Mock 适配器"""
        from integrations.platform_adapters.mock import MockAdapter

        # 创建多个 Mock 适配器来模拟多平台环境
        mock_platforms = [
            {
                'platform_id': 'mock_runninghub',
                'display_name': 'Mock RunningHub',
                'task_delay': 3,
                'failure_rate': 0
            },
            {
                'platform_id': 'mock_midjourney',
                'display_name': 'Mock Midjourney',
                'task_delay': 5,
                'failure_rate': 0.1  # 10% 失败率，用于测试故障转移
            },
            {
                'platform_id': 'mock_stable_diffusion',
                'display_name': 'Mock Stable Diffusion',
                'task_delay': 2,
                'failure_rate': 0
            }
        ]

        for platform_config in mock_platforms:
            adapter = MockAdapter(platform_config)
            self.adapters[platform_config['platform_id']] = adapter
            logger.info(f"✅ 已加载 Mock 平台: {platform_config['display_name']} (delay={platform_config['task_delay']}s)")

        # 默认使用 mock_runninghub
        self.adapters['runninghub'] = self.adapters['mock_runninghub']

        logger.info(f"📊 共加载 {len(self.adapters)} 个 Mock 平台适配器")

    def get_adapter(self, platform_id: str = None):
        """
        获取平台适配器实例

        Args:
            platform_id: 平台 ID，如果为 None 则返回默认平台（runninghub）

        Returns:
            平台适配器实例
        """
        if platform_id is None:
            platform_id = 'runninghub'

        return self.adapters.get(platform_id)

    def submit_task(self, task_type: str, params: Dict[str, Any],
                    item_id: int, platform_id: str = None) -> Dict[str, Any]:
        """
        提交任务到指定平台

        Args:
            task_type: 任务类型
            params: 任务参数
            item_id: 子任务 ID
            platform_id: 平台 ID，如果为 None 则使用默认平台（runninghub）

        Returns:
            提交结果
        """
        import repositories as database

        # 确定使用的平台
        if platform_id is None:
            platform_id = 'runninghub'

        # 获取适配器
        adapter = self.get_adapter(platform_id)

        if not adapter:
            return {
                "success": False,
                "status": "failed",
                "message": f"平台 {platform_id} 的适配器未加载"
            }

        logger.info(f"📤 使用平台 {platform_id} 提交 {task_type} 任务")

        # 标准化参数
        normalized_params = adapter.normalize_params(task_type, params)

        # 提交任务
        try:
            result = adapter.submit_task(task_type, normalized_params)

            # 更新使用的平台、平台任务ID
            database.execute_sql(
                """UPDATE api_mission_items
                   SET platform_id = ?, platform_task_id = ?
                   WHERE id = ?""",
                (platform_id, result.get('task_id'), item_id)
            )

            if result['success']:
                logger.info(f"✅ 任务提交成功: task_id={result.get('task_id')}, platform={platform_id}")
                return result
            else:
                logger.warning(f"⚠️ 任务提交失败: {result.get('message')}, platform={platform_id}")
                return result

        except Exception as e:
            logger.error(f"❌ 提交任务异常: {str(e)}, platform={platform_id}")
            return {
                "success": False,
                "status": "failed",
                "message": f"提交异常: {str(e)}"
            }


# 全局平台管理器实例
platform_manager = PlatformManager()
