"""
定时任务调度器
负责管理定时任务的自动执行
"""
import time
import threading
from datetime import datetime, timedelta
from typing import Optional
import repositories as database
from utils import get_logger
from utils.datetime import CHINA_TZ, get_current_timestamp

logger = get_logger(__name__)

# 调度检查间隔（秒）
SCHEDULER_CHECK_INTERVAL = 10

# 时间提前量（秒）：避免因为延迟导致的任务错过
SCHEDULED_TIME_TOLERANCE = 5


class TaskScheduler:
    """任务调度器 - 管理定时任务"""

    def __init__(self):
        self.is_running = False
        self.scheduler_thread = None
        self.lock = threading.Lock()

    def start(self):
        """启动调度器"""
        if not self.is_running:
            self.is_running = True
            self.scheduler_thread = threading.Thread(
                target=self._scheduler_loop,
                daemon=True,
                name="Task-Scheduler"
            )
            self.scheduler_thread.start()
            logger.info("✅ 任务调度器已启动")

    def stop(self):
        """停止调度器"""
        self.is_running = False
        logger.info("⏹️ 任务调度器已停止")

    def _scheduler_loop(self):
        """调度器主循环"""
        logger.info("🔄 调度器线程已启动")

        # 启动时恢复定时任务
        self._restore_scheduled_tasks()

        while self.is_running:
            try:
                # 检查并执行到期的定时任务
                self._check_and_execute_due_tasks()

                # 等待下次检查
                time.sleep(SCHEDULER_CHECK_INTERVAL)

            except Exception as e:
                logger.error(f"❌ 调度器循环错误: {str(e)}")
                import traceback
                traceback.print_exc()
                time.sleep(SCHEDULER_CHECK_INTERVAL)

        logger.info("⏹️ 调度器线程已停止")

    def _restore_scheduled_tasks(self):
        """恢复定时任务（应用重启时调用）"""
        try:
            logger.info("🔄 恢复定时任务...")

            # 获取所有 scheduled 状态的任务
            scheduled_missions = database.execute_sql(
                """SELECT id, name, scheduled_time
                   FROM api_missions
                   WHERE status = 'scheduled'
                   ORDER BY scheduled_time ASC""",
                fetch_all=True
            )

            if scheduled_missions:
                logger.info(f"📋 发现 {len(scheduled_missions)} 个待执行的定时任务")

                for mission in scheduled_missions:
                    scheduled_time_str = mission.get('scheduled_time')
                    if scheduled_time_str:
                        try:
                            # 解析定时时间
                            if isinstance(scheduled_time_str, str):
                                scheduled_time = datetime.fromisoformat(
                                    scheduled_time_str.replace('Z', '+00:00')
                                )
                            else:
                                scheduled_time = scheduled_time_str

                            # 检查是否已过期（超过10分钟视为过期）
                            now = get_current_timestamp()
                            if scheduled_time < now - timedelta(minutes=10):
                                logger.warning(
                                    f"⚠️ 任务 #{mission['id']} ({mission['name']}) "
                                    f"定时时间已过期: {scheduled_time_str}"
                                )
                                # 标记为失败
                                database.execute_sql(
                                    """UPDATE api_missions
                                       SET status = 'failed',
                                           error_message = '定时时间已过期'
                                       WHERE id = ?""",
                                    (mission['id'],)
                                )
                            else:
                                logger.info(
                                    f"✅ 任务 #{mission['id']} ({mission['name']}) "
                                    f"将在 {scheduled_time_str} 执行"
                                )
                        except Exception as e:
                            logger.error(
                                f"❌ 解析任务 #{mission['id']} 定时时间失败: {str(e)}"
                            )

            logger.info("✅ 定时任务恢复完成")

        except Exception as e:
            logger.error(f"❌ 恢复定时任务时出错: {str(e)}")

    def _check_and_execute_due_tasks(self):
        """检查并执行到期的定时任务"""
        try:
            # 获取当前时间
            now = get_current_timestamp()

            # 查询所有应该执行的定时任务
            # 条件：status = 'scheduled' AND scheduled_time <= now + tolerance
            due_missions = database.execute_sql(
                """SELECT id, name, scheduled_time
                   FROM api_missions
                   WHERE status = 'scheduled'
                     AND scheduled_time IS NOT NULL
                     AND datetime(scheduled_time) <= datetime(?)
                   ORDER BY scheduled_time ASC""",
                (now.isoformat(),),
                fetch_all=True
            )

            # 定期输出日志（每分钟一次），避免日志过多
            if int(now.timestamp()) % 60 == 0:
                logger.info(f"⏰ 调度器检查中... 当前时间: {now.strftime('%H:%M:%S')}")

            if not due_missions:
                return

            logger.info(f"🕐 发现 {len(due_missions)} 个到期的定时任务")

            # 导入 api_task_service（延迟导入避免循环依赖）
            from services import api_task_service

            # 批量处理到期任务
            for mission in due_missions:
                try:
                    mission_id = mission['id']
                    mission_name = mission['name']
                    scheduled_time = mission['scheduled_time']

                    # 更新状态为 queued
                    database.execute_sql(
                        """UPDATE api_missions
                           SET status = 'queued'
                           WHERE id = ?""",
                        (mission_id,)
                    )

                    # 添加到队列
                    api_task_service.add_to_queue(mission_id)

                    logger.info(
                        f"✅ 定时任务 #{mission_id} ({mission_name}) "
                        f"已加入队列（原定时间: {scheduled_time}）"
                    )

                except Exception as e:
                    logger.error(
                        f"❌ 处理定时任务 #{mission['id']} 失败: {str(e)}"
                    )

        except Exception as e:
            logger.error(f"❌ 检查定时任务时出错: {str(e)}")

    def get_scheduled_tasks(self) -> list:
        """获取所有定时任务列表"""
        try:
            missions = database.execute_sql(
                """SELECT id, name, description, task_type, status,
                          total_count, scheduled_time, created_at
                   FROM api_missions
                   WHERE status = 'scheduled'
                   ORDER BY scheduled_time ASC""",
                fetch_all=True
            )

            # 格式化时间字段
            return database.format_datetime_fields(missions, ['scheduled_time', 'created_at'])

        except Exception as e:
            logger.error(f"❌ 获取定时任务列表失败: {str(e)}")
            return []


# 全局实例
task_scheduler = TaskScheduler()
