"""
API 任务服务模块
支持四种 API 任务类型：文生图、图生图、文生视频、图生视频
最多支持 50 个并发任务
子任务失败自动重试，最多重试 5 次
"""
import time
import threading
import json
from collections import deque
from typing import Dict, Any, List
import repositories as database
from core import API_TASK_TYPES, MAX_CONCURRENT_API_TASKS, get_api_key
from utils import get_logger

# 获取日志器
logger = get_logger('api_task_service')

# 最大重试次数
MAX_RETRY_COUNT = 5


class PollingTask:
    """轮询任务：管理单个子任务的轮询"""

    def __init__(self, item_id: int, item_index: int, mission_id: int,
                 task_type: str, runninghub_task_id: str,
                 platform_id: str = None, platform_task_id: str = None,
                 platform_attempt: List[str] = None):
        self.item_id = item_id
        self.item_index = item_index
        self.mission_id = mission_id
        self.task_type = task_type
        self.runninghub_task_id = runninghub_task_id
        self.platform_id = platform_id or 'runninghub'  # 使用的平台
        self.platform_task_id = platform_task_id  # 平台任务ID（不同平台格式不同）
        self.platform_attempt = platform_attempt or []  # 已尝试的平台列表
        self.should_stop = False


class ApiTaskManager:
    """API任务管理器 - 子任务队列模式"""

    def __init__(self):
        # 子任务队列（直接存放待提交的子任务数据）
        self.item_queue = deque()

        # 正在运行的子任务 {(mission_id, item_id): polling_task}
        self.running_tasks = {}

        # 轮询任务线程列表 {item_id: thread}
        self.polling_threads = {}

        # 并发控制
        self.max_concurrent = MAX_CONCURRENT_API_TASKS  # 最大并发数
        self.current_concurrent = 0  # 当前并发数

        # 线程安全锁
        self.lock = threading.Lock()
        self.queue_lock = threading.Lock()

        # 消费者线程
        self.consumer_thread = None
        self.is_running = False

    def start(self):
        """启动消费者线程并恢复未完成的任务"""
        if not self.is_running:
            self.is_running = True

            # 恢复未完成的任务
            self._restore_tasks()

            # 启动消费者线程
            self.consumer_thread = threading.Thread(
                target=self._consumer_loop,
                daemon=True,
                name="API-Task-Consumer"
            )
            self.consumer_thread.start()
            logger.info("✅ API任务管理器已启动（消费者线程）")

    def stop(self):
        """停止处理"""
        self.is_running = False
        logger.info("⏹️ API任务管理器已停止")

    def create_api_mission(self, name: str, description: str, task_type: str,
                           config: Dict, platform_strategy: str = "specified",
                           platform_id: str = None) -> int:
        """
        创建API任务（支持多平台）

        Args:
            name: 任务名称
            description: 任务描述
            task_type: 任务类型
            config: 任务配置（包含 batch_input）
            platform_strategy: 平台选择策略 (specified/failover/priority)
            platform_id: 指定的平台 ID

        Returns:
            任务 ID
        """
        # 验证 API Key
        try:
            api_key = get_api_key()
        except ValueError as e:
            raise Exception(str(e))

        # 验证任务类型
        if task_type not in API_TASK_TYPES:
            raise ValueError(f"不支持的任务类型: {task_type}，支持的类型: {list(API_TASK_TYPES.keys())}")

        # 解析批量输入
        batch_input = config.get("batch_input", [])
        if not batch_input:
            raise ValueError("batch_input 不能为空")

        total_count = len(batch_input)

        # 从 config 中移除 batch_input，其余保存为固定配置
        fixed_config = {k: v for k, v in config.items() if k != "batch_input"}

        # 创建数据库记录（包含平台信息）
        mission_id = database.execute_insert_returning_id(
            """INSERT INTO api_missions
               (name, description, task_type, status, total_count, config_json, platform_strategy, platform_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (name, description, task_type, "queued", total_count, json.dumps(fixed_config),
             platform_strategy, platform_id)
        )

        logger.info(f"📋 API任务 #{mission_id} 已创建，共 {total_count} 个子任务，平台策略: {platform_strategy}")

        # 创建子任务
        for idx, input_data in enumerate(batch_input, 1):
            database.execute_sql(
                """INSERT INTO api_mission_items
                   (api_mission_id, item_index, input_params, status)
                   VALUES (?, ?, ?, ?)""",
                (mission_id, idx, json.dumps(input_data), "pending")
            )

        logger.info(f"📋 API任务 #{mission_id} 已创建 {total_count} 个子任务")

        # 添加到队列
        self.add_to_queue(mission_id)

        return mission_id

    def add_to_queue(self, mission_id: int):
        """添加任务的所有子任务到队列"""
        try:
            # 获取任务信息
            mission = database.execute_sql(
                "SELECT * FROM api_missions WHERE id = ?",
                (mission_id,),
                fetch_one=True
            )

            if not mission:
                logger.warning(f"⚠️ 任务 #{mission_id} 不存在")
                return

            task_type = mission['task_type']
            config = json.loads(mission['config_json'])

            # 获取所有待处理的子任务
            items = database.execute_sql(
                "SELECT * FROM api_mission_items WHERE api_mission_id = ? AND status = 'pending' ORDER BY item_index",
                (mission_id,),
                fetch_all=True
            )

            if not items:
                logger.warning(f"⚠️ 任务 #{mission_id} 没有待处理的子任务")
                return

            # 将所有子任务加入队列
            with self.queue_lock:
                for item in items:
                    item_data = {
                        'mission_id': mission_id,
                        'item': item,
                        'task_type': task_type,
                        'config': config
                    }
                    self.item_queue.append(item_data)

            logger.info(f"📥 任务 #{mission_id} 的 {len(items)} 个子任务已加入队列")

            # 更新任务状态
            database.execute_sql(
                "UPDATE api_missions SET status = 'queued' WHERE id = ?",
                (mission_id,)
            )

        except Exception as e:
            logger.error(f"❌ 添加任务 #{mission_id} 到队列失败: {str(e)}")

    def _restore_tasks(self):
        """恢复未完成的任务（应用重启时调用）"""
        try:
            logger.info("🔄 开始恢复未完成的任务...")

            # 1. 恢复 pending 状态的子任务到队列
            pending_items = database.execute_sql(
                """SELECT i.*, m.task_type, m.config_json
                   FROM api_mission_items i
                   JOIN api_missions m ON i.api_mission_id = m.id
                   WHERE i.status = 'pending'
                   ORDER BY i.api_mission_id, i.item_index""",
                fetch_all=True
            )

            restored_count = 0
            for item in pending_items:
                item_data = {
                    'mission_id': item['api_mission_id'],
                    'item': item,
                    'task_type': item['task_type'],
                    'config': json.loads(item['config_json'])
                }
                with self.queue_lock:
                    self.item_queue.append(item_data)
                restored_count += 1

            logger.info(f"📥 恢复 {restored_count} 个待处理的子任务到队列")

            # 2. 恢复 processing 状态且有 runninghub_task_id 的子任务的轮询
            processing_items = database.execute_sql(
                """SELECT i.*, m.task_type, m.config_json
                   FROM api_mission_items i
                   JOIN api_missions m ON i.api_mission_id = m.id
                   WHERE i.status = 'processing' AND i.runninghub_task_id IS NOT NULL
                   ORDER BY i.api_mission_id, i.item_index""",
                fetch_all=True
            )

            restored_polling_count = 0
            for item in processing_items:
                try:
                    # 获取平台信息
                    platform_id = item.get('platform_id', 'runninghub')
                    platform_task_id = item.get('platform_task_id')
                    platform_attempt_json = item.get('platform_attempt', '[]')
                    platform_attempt = json.loads(platform_attempt_json) if platform_attempt_json else []

                    # 创建轮询任务
                    polling_task = PollingTask(
                        item_id=item['id'],
                        item_index=item['item_index'],
                        mission_id=item['api_mission_id'],
                        task_type=item['task_type'],
                        runninghub_task_id=item['runninghub_task_id'],
                        platform_id=platform_id,
                        platform_task_id=platform_task_id,
                        platform_attempt=platform_attempt
                    )

                    # 添加到运行中任务
                    key = (item['api_mission_id'], item['id'])
                    with self.lock:
                        self.running_tasks[key] = polling_task
                        self.current_concurrent += 1

                    # 启动轮询线程
                    polling_thread = threading.Thread(
                        target=self._polling_worker,
                        args=(polling_task,),
                        daemon=True,
                        name=f"Polling-Item-{item['id']}"
                    )
                    self.polling_threads[item['id']] = polling_thread
                    polling_thread.start()

                    restored_polling_count += 1
                    logger.info(f"🔄 恢复轮询：子任务 #{item['item_index']} "
                              f"(task_id: {item['runninghub_task_id']}, platform: {platform_id})")

                except Exception as e:
                    logger.error(f"❌ 恢复子任务 #{item['item_index']} 轮询失败: {str(e)}")

            logger.info(f"🔄 恢复 {restored_polling_count} 个轮询任务")

            # 3. 恢复任务状态
            missions_to_restore = database.execute_sql(
                """SELECT DISTINCT m.id
                   FROM api_missions m
                   JOIN api_mission_items i ON m.id = i.api_mission_id
                   WHERE i.status IN ('pending', 'processing')""",
                fetch_all=True
            )

            for mission in missions_to_restore:
                mission_id = mission['id']
                # 确保任务状态正确
                mission_status = database.execute_sql(
                    "SELECT status FROM api_missions WHERE id = ?",
                    (mission_id,),
                    fetch_one=True
                )

                if mission_status and mission_status['status'] in ['queued', 'completed', 'failed']:
                    database.execute_sql(
                        "UPDATE api_missions SET status = 'running' WHERE id = ?",
                        (mission_id,)
                    )

                    # 启动监控线程
                    monitor_thread = threading.Thread(
                        target=self._monitor_mission_completion,
                        args=(mission_id,),
                        daemon=True,
                        name=f"Monitor-Mission-{mission_id}"
                    )
                    monitor_thread.start()

            logger.info(f"✅ 任务恢复完成：队列 {restored_count} 个，轮询 {restored_polling_count} 个")

        except Exception as e:
            logger.error(f"❌ 恢复任务时出错: {str(e)}")
            import traceback
            traceback.print_exc()

    def get_queue_status(self) -> Dict:
        """获取队列状态"""
        with self.lock:
            return {
                "queue_length": len(self.item_queue),
                "running_tasks": len(self.running_tasks),
                "current_concurrent": self.current_concurrent,
                "max_concurrent": self.max_concurrent
            }

    def _consumer_loop(self):
        """消费者循环：从子任务队列中取出并提交执行"""
        logger.info("🔄 消费者线程已启动")

        while self.is_running:
            try:
                # 从队列中取出子任务并提交（控制并发）
                with self.queue_lock:
                    # 检查是否还有子任务且未达到并发上限
                    while self.item_queue and self.current_concurrent < self.max_concurrent:
                        # 取出一个子任务
                        item_data = self.item_queue.popleft()

                        # 提交任务
                        try:
                            self._submit_and_start_polling(item_data)
                            self.current_concurrent += 1
                        except Exception as e:
                            logger.error(f"❌ 提交子任务失败: {str(e)}")

                time.sleep(0.5)  # 避免 CPU 占用过高

            except Exception as e:
                logger.error(f"❌ 消费者循环错误: {str(e)}")
                import traceback
                traceback.print_exc()
                time.sleep(1)

        logger.info("⏹️ 消费者线程已停止")

    def _submit_and_start_polling(self, item_data: Dict):
        """提交子任务并启动独立的轮询线程"""
        mission_id = item_data['mission_id']
        item = item_data['item']

        try:
            # 更新任务状态为运行中（第一次提交时）
            self._update_mission_status_to_running(mission_id)

            # 提交任务到平台
            result = self._submit_task_to_platform(item_data)

            # 处理提交成功
            if result['success']:
                self._handle_task_submission_success(mission_id, item, item_data, result)

            # 处理提交失败
            else:
                raise Exception(result.get('error', '未知错误'))

        except Exception as e:
            self._handle_task_submission_failure(item, item_data, str(e))

    def _update_mission_status_to_running(self, mission_id: int):
        """更新任务状态为运行中并启动监控线程"""
        mission = database.execute_sql(
            "SELECT status FROM api_missions WHERE id = ?",
            (mission_id,),
            fetch_one=True
        )
        if mission and mission['status'] == 'queued':
            database.execute_sql(
                "UPDATE api_missions SET status = 'running' WHERE id = ?",
                (mission_id,)
            )
            # 启动监控线程
            monitor_thread = threading.Thread(
                target=self._monitor_mission_completion,
                args=(mission_id,),
                daemon=True,
                name=f"Monitor-Mission-{mission_id}"
            )
            monitor_thread.start()

    def _submit_task_to_platform(self, item_data: Dict) -> Dict[str, Any]:
        """提交任务到平台（支持多平台故障转移）"""
        mission_id = item_data['mission_id']
        item = item_data['item']
        task_type = item_data['task_type']
        config = item_data['config']

        # 获取任务的平台策略和平台ID
        mission = database.execute_sql(
            "SELECT platform_strategy, platform_id FROM api_missions WHERE id = ?",
            (mission_id,),
            fetch_one=True
        )

        platform_strategy = mission.get('platform_strategy', 'specified') if mission else 'specified'
        platform_id = mission.get('platform_id') if mission else None

        # 获取已尝试的平台列表
        attempted_platforms_json = item.get('platform_attempt', '[]')
        attempted_platforms = json.loads(attempted_platforms_json) if attempted_platforms_json else []

        # 使用平台管理器提交任务
        from services.platform_manager import platform_manager

        result = platform_manager.submit_task_with_platform(
            task_type=task_type,
            params=config,
            mission_id=mission_id,
            item_id=item['id'],
            platform_id=platform_id,
            strategy=platform_strategy,
            attempted_platforms=attempted_platforms
        )

        return result

    def _handle_task_submission_success(self, mission_id: int, item: Dict,
                                       item_data: Dict, result: Dict):
        """处理任务提交成功"""
        runninghub_task_id = result['task_id']
        used_platform = result.get('platform_id', 'runninghub')

        # 更新数据库状态（platform_id 和 platform_attempt 已在 platform_manager 中更新）
        database.execute_sql(
            """UPDATE api_mission_items
               SET status = 'processing', runninghub_task_id = ?
               WHERE id = ?""",
            (runninghub_task_id, item['id'])
        )

        logger.info(f"✅ 子任务 #{item['item_index']} 已提交到 {used_platform} (task_id: {runninghub_task_id})")

        # 创建并启动轮询任务
        self._create_and_start_polling_task(mission_id, item, item_data, runninghub_task_id)

    def _create_and_start_polling_task(self, mission_id: int, item: Dict,
                                      item_data: Dict, runninghub_task_id: str):
        """创建并启动轮询任务"""
        # 从 item 中获取平台信息
        platform_id = item.get('platform_id', 'runninghub')
        platform_task_id = item.get('platform_task_id')
        platform_attempt_json = item.get('platform_attempt', '[]')
        platform_attempt = json.loads(platform_attempt_json) if platform_attempt_json else []

        # 创建轮询任务
        polling_task = PollingTask(
            item_id=item['id'],
            item_index=item['item_index'],
            mission_id=mission_id,
            task_type=item_data['task_type'],
            runninghub_task_id=runninghub_task_id,
            platform_id=platform_id,
            platform_task_id=platform_task_id,
            platform_attempt=platform_attempt
        )

        # 添加到运行中任务
        key = (mission_id, item['id'])
        with self.lock:
            self.running_tasks[key] = polling_task

        # 启动独立的轮询线程
        polling_thread = threading.Thread(
            target=self._polling_worker,
            args=(polling_task,),
            daemon=True,
            name=f"Polling-Item-{item['id']}"
        )
        self.polling_threads[item['id']] = polling_thread
        polling_thread.start()

    def _handle_task_submission_failure(self, item: Dict, item_data: Dict, error_msg: str):
        """处理任务提交失败"""
        logger.error(f"❌ 提交子任务 #{item['item_index']} 失败: {error_msg}")

        # 检查是否需要重试
        current_item = database.execute_sql(
            "SELECT retry_count FROM api_mission_items WHERE id = ?",
            (item['id'],),
            fetch_one=True
        )

        if current_item:
            retry_count = current_item.get('retry_count', 0)

            if retry_count < MAX_RETRY_COUNT:
                # 增加重试次数并重新加入队列
                new_retry_count = retry_count + 1
                database.execute_sql(
                    """UPDATE api_mission_items
                       SET status = 'pending', retry_count = ?, error_message = ?
                       WHERE id = ?""",
                    (new_retry_count,
                     f"提交失败: {error_msg} (重试 {new_retry_count}/{MAX_RETRY_COUNT})",
                     item['id'])
                )

                # 重新加入队列
                with self.queue_lock:
                    self.item_queue.append(item_data)

                logger.warning(f"⚠️ 子任务 #{item['item_index']} 提交失败，重新加入队列 "
                             f"(重试 {new_retry_count}/{MAX_RETRY_COUNT})")
            else:
                # 达到最大重试次数，标记为永久失败
                database.execute_sql(
                    """UPDATE api_mission_items
                       SET status = 'failed', error_message = ?
                       WHERE id = ?""",
                    (f"提交失败 (已达最大重试次数 {MAX_RETRY_COUNT}): {error_msg}", item['id'])
                )
                logger.error(f"❌ 子任务 #{item['item_index']} 提交失败，已达最大重试次数: {error_msg}")

    def _monitor_mission_completion(self, mission_id: int):
        """监控任务完成状态"""
        try:
            while self.is_running:
                # 检查是否还有待处理或运行中的子任务
                status_result = database.execute_sql(
                    """SELECT COUNT(*) as count
                       FROM api_mission_items
                       WHERE api_mission_id = ? AND status IN ('pending', 'processing')""",
                    (mission_id,),
                    fetch_one=True
                )

                remaining_count = status_result['count'] if status_result else 0

                if remaining_count == 0:
                    # 所有子任务完成
                    database.execute_sql(
                        "UPDATE api_missions SET status = 'completed' WHERE id = ?",
                        (mission_id,)
                    )
                    logger.info(f"✅ 任务 #{mission_id} 全部完成")
                    break

                time.sleep(2)  # 每2秒检查一次

        except Exception as e:
            logger.error(f"❌ 监控任务 #{mission_id} 出错: {str(e)}")

    def _query_task_status(self, polling_task: PollingTask) -> Dict[str, Any]:
        """
        查询任务状态（使用平台管理器）

        Args:
            polling_task: 轮询任务对象

        Returns:
            任务状态信息
        """
        try:
            from services.platform_manager import platform_manager

            adapter = platform_manager.get_platform_adapter(polling_task.platform_id)
            if adapter:
                # 使用平台任务ID进行查询
                result = adapter.query_task(polling_task.platform_task_id)
                return result
            else:
                logger.error(f"❌ 平台 {polling_task.platform_id} 适配器不可用")
                return {
                    "status": "FAILED",
                    "errorMessage": f"平台 {polling_task.platform_id} 适配器不可用"
                }

        except Exception as e:
            logger.error(f"❌ 查询任务状态失败: {str(e)}")
            # 返回错误状态
            return {
                "status": "FAILED",
                "errorMessage": f"查询失败: {str(e)}"
            }

    def _polling_worker(self, polling_task: PollingTask):
        """轮询工作线程：独立管理单个子任务的轮询"""
        logger.info(f"🔄 轮询线程启动：子任务 #{polling_task.item_index} (平台: {polling_task.platform_id})")

        try:
            while not polling_task.should_stop and self.is_running:
                try:
                    # 使用平台管理器查询任务状态
                    result = self._query_task_status(polling_task)
                    status = result.get("status")

                    if status == "SUCCESS":
                        # 成功
                        if result.get("results") and len(result["results"]) > 0:
                            result_url = result["results"][0]["url"]

                            database.execute_sql(
                                """UPDATE api_mission_items
                                   SET status = 'completed', result_url = ?
                                   WHERE id = ?""",
                                (result_url, polling_task.item_id)
                            )

                            logger.info(f"✅ 子任务 #{polling_task.item_index} 成功: {result_url}")
                        else:
                            database.execute_sql(
                                """UPDATE api_mission_items
                                   SET status = 'failed', error_message = ?
                                   WHERE id = ?""",
                                ("任务完成但无结果", polling_task.item_id)
                            )

                        break  # 退出轮询

                    elif status == "FAILED":
                        # 失败 - 检查是否需要重试
                        error_message = result.get("errorMessage", "未知错误")

                        item = database.execute_sql(
                            "SELECT retry_count FROM api_mission_items WHERE id = ?",
                            (polling_task.item_id,),
                            fetch_one=True
                        )

                        if item:
                            retry_count = item.get('retry_count', 0)

                            if retry_count < MAX_RETRY_COUNT:
                                # 增加重试次数并重新加入队列
                                new_retry_count = retry_count + 1
                                database.execute_sql(
                                    """UPDATE api_mission_items
                                       SET status = 'pending', retry_count = ?, runninghub_task_id = NULL, error_message = ?
                                       WHERE id = ?""",
                                    (new_retry_count, f"任务失败: {error_message} (重试 {new_retry_count}/{MAX_RETRY_COUNT})", polling_task.item_id)
                                )

                                # 重新构建子任务数据并加入队列
                                mission = database.execute_sql(
                                    "SELECT * FROM api_missions WHERE id = ?",
                                    (polling_task.mission_id,),
                                    fetch_one=True
                                )

                                if mission:
                                    item_data = {
                                        'mission_id': polling_task.mission_id,
                                        'item': database.execute_sql(
                                            "SELECT * FROM api_mission_items WHERE id = ?",
                                            (polling_task.item_id,),
                                            fetch_one=True
                                        ),
                                        'task_type': polling_task.task_type,
                                        'config': json.loads(mission['config_json'])
                                    }

                                    with self.queue_lock:
                                        self.item_queue.append(item_data)

                                    logger.warning(f"⚠️ 子任务 #{polling_task.item_index} 失败，重新加入队列 (重试 {new_retry_count}/{MAX_RETRY_COUNT})")
                            else:
                                # 达到最大重试次数，标记为永久失败
                                database.execute_sql(
                                    """UPDATE api_mission_items
                                       SET status = 'failed', error_message = ?
                                       WHERE id = ?""",
                                    (f"任务失败 (已达最大重试次数 {MAX_RETRY_COUNT}): {error_message}", polling_task.item_id)
                                )
                                logger.error(f"❌ 子任务 #{polling_task.item_index} 失败，已达最大重试次数: {error_message}")

                        break  # 退出轮询

                    elif status in ["RUNNING", "QUEUED", "PENDING"]:
                        # 仍在运行中，继续轮询
                        pass

                    else:
                        # 未知状态
                        logger.debug(f"子任务 #{polling_task.item_index} 未知状态: {status}")

                    # 等待下次轮询
                    time.sleep(3)  # 每3秒轮询一次

                except Exception as e:
                    logger.error(f"❌ 轮询子任务 #{polling_task.item_index} 出错: {str(e)}")
                    # 轮询失败继续尝试，不放弃任务
                    time.sleep(10)  # 出错后等待更长时间再重试

            # 轮询结束，清理资源
            key = (polling_task.mission_id, polling_task.item_id)
            with self.lock:
                self.running_tasks.pop(key, None)
                self.polling_threads.pop(polling_task.item_id, None)
                self.current_concurrent -= 1

            # 更新进度
            self._update_progress(polling_task.mission_id)

            logger.info(f"⏹️ 轮询线程结束：子任务 #{polling_task.item_index}")

        except Exception as e:
            logger.error(f"❌ 轮询线程异常: {str(e)}")
            key = (polling_task.mission_id, polling_task.item_id)
            with self.lock:
                self.running_tasks.pop(key, None)
                self.polling_threads.pop(polling_task.item_id, None)
                self.current_concurrent -= 1


    def _update_progress(self, mission_id: int):
        """更新任务进度"""
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

        logger.info(f"📊 API任务 #{mission_id} 进度: {completed} 完成, {failed} 失败")


# 全局实例
api_task_manager = ApiTaskManager()


# 便捷函数：供 API 路由直接调用
def create_mission(name: str, description: str, task_type: str, config: dict) -> int:
    """创建 API 任务"""
    return api_task_manager.create_api_mission(name, description, task_type, config)


def add_to_queue(mission_id: int):
    """添加任务到队列"""
    api_task_manager.add_to_queue(mission_id)


def get_queue_status() -> dict:
    """获取队列状态"""
    return api_task_manager.get_queue_status()

