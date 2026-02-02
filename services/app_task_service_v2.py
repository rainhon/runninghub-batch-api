"""
App 任务服务模块 V2.0 - 批量输入模式
参考 API 任务架构，完全重构
支持批量输入：每个子任务独立参数
"""
import time
import threading
import json
from collections import deque
from typing import Dict, List
import repositories as database
import integrations
from utils import get_logger

# 获取日志器
logger = get_logger('app_task_service_v2')

# 配置常量
MAX_CONCURRENT_TASKS = 2  # 最大并行任务数（App 任务限制）
MAX_RETRY_COUNT = 5  # 最大重试次数
POLL_INTERVAL = 5  # 轮询间隔（秒）

# 使用外部集成服务
runninghub_service = integrations.runninghub_service


class AppTaskManager:
    """App任务管理器 - 批量输入模式（参考 ApiTaskManager）"""

    def __init__(self):
        # 子任务队列（直接存放待提交的子任务数据）
        self.item_queue = deque()

        # 正在运行的子任务 {(mission_id, item_id): polling_task}
        self.running_tasks = {}

        # 轮询任务线程列表 {item_id: thread}
        self.polling_threads = {}

        # 并发控制
        self.max_concurrent = MAX_CONCURRENT_TASKS
        self.current_concurrent = 0

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
                name="App-Task-Consumer"
            )
            self.consumer_thread.start()
            logger.info("✅ App任务管理器已启动（批量输入模式）")

    def stop(self):
        """停止处理"""
        self.is_running = False
        logger.info("⏹️ App任务管理器已停止")

    def create_mission(self, name: str, description: str, app_id: str,
                       config: Dict, batch_input: List[Dict]) -> int:
        """创建App任务（批量输入模式）

        Args:
            name: 任务名称
            description: 任务描述
            app_id: App ID (RunningHub AI 应用的 ID)
            config: 固定配置（所有子任务共享）
            batch_input: 批量输入（每个元素对应一个子任务）

        Returns:
            任务 ID
        """
        # 验证
        if not batch_input:
            raise ValueError("batch_input 不能为空")

        total_count = len(batch_input)

        # 创建主任务记录
        mission_id = database.execute_insert_returning_id(
            """INSERT INTO app_missions
               (name, description, app_id, status, total_count,
                completed_count, failed_count, config_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (name, description, app_id, 'queued', total_count,
             0, 0, json.dumps(config))
        )

        logger.info(f"📋 App任务 #{mission_id} 已创建，共 {total_count} 个子任务")

        # 创建子任务记录（app_mission_items表）
        for idx, input_data in enumerate(batch_input, 1):
            # 合并固定配置和批量输入
            full_params = {**config, **input_data}

            database.execute_sql(
                """INSERT INTO app_mission_items
                   (app_mission_id, item_index, input_params, status)
                   VALUES (?, ?, ?, ?)""",
                (mission_id, idx, json.dumps(full_params), 'pending')
            )

        logger.info(f"📋 已创建 {total_count} 个子任务记录")

        # 添加到队列
        self.add_to_queue(mission_id)

        return mission_id

    def add_to_queue(self, mission_id: int):
        """添加任务的所有子任务到队列"""
        try:
            # 获取所有待处理的子任务
            items = database.execute_sql(
                """SELECT id, app_mission_id, item_index, input_params
                   FROM app_mission_items
                   WHERE app_mission_id = ? AND status = 'pending'
                   ORDER BY item_index""",
                (mission_id,),
                fetch_all=True
            )

            # 将子任务加入队列
            with self.queue_lock:
                for item in items:
                    # 将完整子任务数据加入队列
                    self.item_queue.append({
                        'item_id': item['id'],
                        'mission_id': item['app_mission_id'],
                        'item_index': item['item_index'],
                        'input_params': json.loads(item['input_params'])
                    })

            logger.info(f"📥 已将 {len(items)} 个子任务加入队列")

        except Exception as e:
            logger.error(f"❌ 添加任务到队列失败: {str(e)}")

    def cancel_mission(self, mission_id: int) -> int:
        """取消任务"""
        try:
            # 更新任务状态
            database.execute_sql(
                "UPDATE app_missions SET status = 'cancelled' WHERE id = ?",
                (mission_id,)
            )

            # 取消所有待处理的子任务
            database.execute_sql(
                """UPDATE app_mission_items SET status = 'cancelled'
                   WHERE app_mission_id = ? AND status = 'pending'""",
                (mission_id,)
            )

            logger.info(f"🚫 任务 #{mission_id} 已取消")
            return 0

        except Exception as e:
            logger.error(f"❌ 取消任务失败: {str(e)}")
            return -1

    def retry_failed_items(self, mission_id: int) -> int:
        """重试失败的子任务"""
        try:
            # 获取失败的子任务
            failed_items = database.execute_sql(
                """SELECT id, item_index
                   FROM app_mission_items
                   WHERE app_mission_id = ? AND status = 'failed'
                   ORDER BY item_index""",
                (mission_id,),
                fetch_all=True
            )

            if not failed_items:
                logger.warning(f"⚠️ 任务 #{mission_id} 没有失败的子任务")
                return 0

            # 重置子任务状态
            for item in failed_items:
                database.execute_sql(
                    """UPDATE app_mission_items
                       SET status = 'pending', error_message = NULL, retry_count = 0
                       WHERE id = ?""",
                    (item['id'],)
                )

            # 重置任务状态
            database.execute_sql(
                "UPDATE app_missions SET status = 'queued' WHERE id = ?",
                (mission_id,)
            )

            # 重新加入队列
            self.add_to_queue(mission_id)

            logger.info(f"🔄 任务 #{mission_id} 重试 {len(failed_items)} 个失败子任务")
            return len(failed_items)

        except Exception as e:
            logger.error(f"❌ 重试任务失败: {str(e)}")
            return 0

    def get_status(self) -> Dict:
        """获取队列状态"""
        with self.lock:
            return {
                "queue_size": len(self.item_queue),
                "running_count": len(self.running_tasks),
                "max_concurrent": self.max_concurrent,
            }

    # ========== 内部方法 ==========

    def _consumer_loop(self):
        """消费者循环（从队列取出子任务并执行）"""
        while self.is_running:
            try:
                with self.lock:
                    if len(self.item_queue) > 0 and len(self.running_tasks) < self.max_concurrent:
                        item_data = self.item_queue.popleft()
                        item_id = item_data['item_id']
                        mission_id = item_data['item_index']

                        # 标记为运行中
                        self.running_tasks[item_id] = item_data

                        logger.info(f"🚀 从队列取出子任务 #{item_id}，当前并发: {len(self.running_tasks)}/{self.max_concurrent}")

                        # 在新线程中处理子任务
                        task_thread = threading.Thread(
                            target=self._execute_item,
                            args=(item_data,),
                            daemon=True
                        )
                        task_thread.start()

                time.sleep(0.5)  # 避免 CPU 占用过高

            except Exception as e:
                logger.error(f"❌ 消费者循环错误: {str(e)}")
                import traceback
                traceback.print_exc()
                time.sleep(1)

    def _execute_item(self, item_data: Dict):
        """执行单个子任务

        Args:
            item_data: 子任务数据
                {
                    'item_id': int,
                    'mission_id': int,
                    'item_index': int,
                    'input_params': dict
                }
        """
        item_id = item_data['item_id']
        mission_id = item_data['mission_id']
        item_index = item_data['item_index']
        input_params = item_data['input_params']

        try:
            logger.info(f"🔵 子任务 #{item_id} (任务#{mission_id} 第{item_index}个) 开始")

            # 更新子任务状态为 processing
            database.execute_sql(
                """UPDATE app_mission_items SET status = 'processing'
                   WHERE id = ?""",
                (item_id,)
            )

            # 获取任务信息（获取 App ID）
            mission = database.execute_sql(
                "SELECT app_id FROM app_missions WHERE id = ?",
                (mission_id,),
                fetch_one=True
            )

            if not mission:
                logger.warning(f"⚠️ 任务 #{mission_id} 不存在")
                return

            app_id = mission['app_id']

            # 构建节点配置（从 input_params 转换为节点列表）
            # input_params 格式：{"prompt": "xxx", "image": "url", "ratio": "16:9"}
            # 需要转换为：[{"nodeId": "prompt", "fieldName": "prompt", "fieldValue": "xxx", ...}]
            nodes = self._params_to_nodes(input_params)

            # 提交到 RunningHub
            submit_result = runninghub_service.submit_task(app_id, nodes)

            if submit_result.get('code') != 0:
                # 提交失败
                error_message = f"提交到 RunningHub 失败: {submit_result.get('msg', '未知错误')}"
                database.execute_sql(
                    """UPDATE app_mission_items
                       SET status = 'failed', error_message = ?
                       WHERE id = ?""",
                    (error_message, item_id)
                )
                logger.error(f"❌ 子任务 #{item_id} 提交失败")

                # 更新任务状态
                self._update_mission_status(mission_id)
                raise Exception(error_message)

            runninghub_task_id = submit_result['data'].get('taskId')

            # 更新子任务状态
            database.execute_sql(
                """UPDATE app_mission_items
               SET status = 'processing', runninghub_task_id = ?
               WHERE id = ?""",
                (runninghub_task_id, item_id)
            )

            logger.info(f"✅ 子任务 #{item_id} 已提交到 RunningHub (task_id: {runninghub_task_id})")

            # 更新任务状态为 running
            database.execute_sql(
                "UPDATE app_missions SET status = 'running' WHERE id = ?",
                (mission_id,)
            )

            # 轮询任务状态
            self._poll_item_status(item_id, mission_id, item_index, runninghub_task_id)

        except Exception as e:
            error_message = str(e)
            logger.error(f"❌ 子任务 #{item_id} 执行出错: {error_message}")

            # 检查是否需要重试
            item_info = database.execute_sql(
                "SELECT retry_count FROM app_mission_items WHERE id = ?",
                (item_id,),
                fetch_one=True
            )
            current_retries = item_info['retry_count'] if item_info else 0

            if current_retries < MAX_RETRY_COUNT:
                # 未达到重试上限，标记为待重试
                database.execute_sql(
                    """UPDATE app_mission_items
                       SET status = 'pending', retry_count = ?
                       WHERE id = ?""",
                    (current_retries + 1, item_id)
                )
                logger.info(f"🔄 子任务 #{item_id} 准备重试（{MAX_RETRY_COUNT - current_retries} 次剩余）")

                # 重新加入队列
                with self.queue_lock:
                    self.item_queue.append(item_data)
            else:
                # 达到重试上限，标记为失败
                database.execute_sql(
                    """UPDATE app_mission_items
                       SET status = 'failed', error_message = ?
                       WHERE id = ?""",
                    (f"达到重试上限: {error_message}", item_id)
                )
                logger.error(f"❌ 子任务 #{item_id} 达到重试上限（{MAX_RETRY_COUNT} 次）")

            # 更新任务状态
            self._update_mission_status(mission_id)

        finally:
            # 从运行任务中移除
            with self.lock:
                if item_id in self.running_tasks:
                    del self.running_tasks[item_id]

    def _params_to_nodes(self, params: Dict) -> List[Dict]:
        """将参数字典转换为节点列表

        Args:
            params: 参数字典 {"prompt": "xxx", "image": "url"}

        Returns:
            节点列表 [{"nodeId": "prompt", "fieldName": "prompt", "fieldValue": "xxx", ...}]
        """
        nodes = []
        for key, value in params.items():
            # 简单的转换逻辑，可以根据需要扩展
            node = {
                "nodeId": key,
                "fieldName": key,
                "fieldValue": value,
                "fieldType": self._guess_field_type(value)
            }
            nodes.append(node)
        return nodes

    def _guess_field_type(self, value: any) -> str:
        """根据值猜测字段类型"""
        if isinstance(value, str):
            # 如果是 URL，可能是 IMAGE/VIDEO/AUDIO
            if value.startswith(('http://', 'https://')):
                if any(ext in value.lower() for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']):
                    return 'IMAGE'
                elif any(ext in value.lower() for ext in ['.mp4', '.mov', '.avi']):
                    return 'VIDEO'
                elif any(ext in value.lower() for ext in ['.mp3', '.wav', '.aac']):
                    return 'AUDIO'
            return 'TEXT'
        elif isinstance(value, int) or isinstance(value, float):
            return 'NUMBER'
        elif isinstance(value, list):
            return 'ARRAY'
        elif isinstance(value, dict):
            return 'OBJECT'
        return 'TEXT'

    def _poll_item_status(self, item_id: int, mission_id: int, item_index: int,
                          runninghub_task_id: str):
        """轮询单个子任务状态

        Args:
            item_id: 子任务 ID
            mission_id: 主任务 ID
            item_index: 子任务序号
            runninghub_task_id: RunningHub 任务 ID
        """
        try:
            while True:
                outputs_result = runninghub_service.query_task_outputs(runninghub_task_id)
                code = outputs_result.get("code")
                data = outputs_result.get("data")

                if code == 0 and data:  # 成功
                    # 更新子任务状态
                    for item in data:
                        file_url = item.get("fileUrl")
                        database.execute_sql(
                            """UPDATE app_mission_items
                               SET status = 'completed', result_url = ?
                               WHERE id = ?""",
                            (file_url, item_id)
                        )

                    logger.info(f"✅ 子任务 #{item_id} 完成")

                    # 更新任务状态
                    self._update_mission_status(mission_id)
                    break

                elif code == 805:  # 失败
                    error_msg = outputs_result.get("msg", "RunningHub 任务执行失败")

                    # 检查是否需要重试
                    item_info = database.execute_sql(
                        "SELECT retry_count FROM app_mission_items WHERE id = ?",
                        (item_id,),
                        fetch_one=True
                    )
                    current_retries = item_info['retry_count'] if item_info else 0

                    if current_retries < MAX_RETRY_COUNT:
                        # 标记为待重试
                        database.execute_sql(
                            """UPDATE app_mission_items
                               SET status = 'pending', retry_count = ?
                               WHERE id = ?""",
                            (current_retries + 1, item_id)
                        )

                        # 重新加入队列
                        with self.queue_lock:
                            self.item_queue.append({
                                'item_id': item_id,
                                'mission_id': mission_id,
                                'item_index': item_index,
                                'input_params': {}
                            })

                        logger.error(f"❌ 子任务 #{item_id} 失败，准备重试")
                    else:
                        # 达到重试上限
                        database.execute_sql(
                            """UPDATE app_mission_items
                               SET status = 'failed', error_message = ?
                               WHERE id = ?""",
                            (f"达到重试上限: {error_msg}", item_id)
                        )
                        logger.error(f"❌ 子任务 #{item_id} 达到重试上限")

                    # 更新任务状态
                    self._update_mission_status(mission_id)
                    break

                elif code == 804:  # 运行中
                    pass  # 继续等待

                elif code == 813:  # 排队中
                    pass  # 继续等待

                else:  # 未知状态
                    logger.error(f"❌ 子任务 #{item_id} 遇到未知状态码 {code}")
                    break

                time.sleep(POLL_INTERVAL)

        except Exception as e:
            logger.error(f"❌ 轮询子任务 #{item_id} 出错: {str(e)}")
            database.execute_sql(
                """UPDATE app_mission_items
                   SET status = 'failed', error_message = ?
                   WHERE id = ?""",
                (f"轮询异常: {str(e)}", item_id)
            )

            # 更新任务状态
            self._update_mission_status(mission_id)

    def _update_mission_status(self, mission_id: int):
        """更新任务状态（统计完成/失败数量）"""
        try:
            # 查询子任务统计
            stats = database.execute_sql(
                """SELECT
                   COUNT(*) as total,
                   SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                   SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
                   FROM app_mission_items
                   WHERE app_mission_id = ?""",
                (mission_id,),
                fetch_one=True
            )

            if stats:
                total = stats['total'] or 0
                completed = stats['completed'] or 0
                failed = stats['failed'] or 0

                # 更新任务统计
                database.execute_sql(
                    """UPDATE app_missions
                       SET completed_count = ?, failed_count = ?
                       WHERE id = ?""",
                    (completed, failed, mission_id)
                )

                # 检查是否全部完成
                if completed + failed >= total and total > 0:
                    # 所有子任务都已完成
                    if failed > 0 and completed == 0:
                        # 全部失败
                        database.execute_sql(
                            "UPDATE app_missions SET status = 'failed' WHERE id = ?",
                            (mission_id,)
                        )
                    else:
                        # 至少有一个成功
                        database.execute_sql(
                            "UPDATE app_missions SET status = 'completed' WHERE id = ?",
                            (mission_id,)
                        )
                    logger.info(f"✅ 任务 #{mission_id} 全部完成（{completed} 成功, {failed} 失败）")

        except Exception as e:
            logger.error(f"❌ 更新任务状态失败: {str(e)}")

    def _restore_tasks(self):
        """恢复之前未完成的任务（启动时调用）"""
        try:
            # 恢复正在处理的子任务
            processing_items = database.execute_sql(
                """SELECT id, app_mission_id, item_index, runninghub_task_id, input_params
                   FROM app_mission_items
                   WHERE status = 'processing' AND runninghub_task_id IS NOT NULL""",
                fetch_all=True
            )

            if processing_items:
                logger.info(f"♻️ 发现 {len(processing_items)} 个正在处理的子任务，恢复轮询...")

                for item in processing_items:
                    item_id = item['id']
                    mission_id = item['app_mission_id']
                    item_index = item['item_index']
                    runninghub_task_id = item['runninghub_task_id']

                    logger.info(f"♻️ 恢复轮询：子任务 #{item_id} (runninghub_task_id: {runninghub_task_id})")

                    # 标记为运行中
                    with self.lock:
                        self.running_tasks[item_id] = {
                            'item_id': item_id,
                            'mission_id': mission_id,
                            'item_index': item_index
                        }

                    # 在新线程中恢复轮询
                    poll_thread = threading.Thread(
                        target=self._poll_item_status,
                        args=(item_id, mission_id, item_index, runninghub_task_id),
                        daemon=True
                    )
                    poll_thread.start()

                # 更新任务状态
                mission_ids = set(item['app_mission_id'] for item in processing_items)
                for mission_id in mission_ids:
                    database.execute_sql(
                        "UPDATE app_missions SET status = 'running' WHERE id = ?",
                        (mission_id,)
                    )

            # 恢复待处理的子任务
            pending_items = database.execute_sql(
                """SELECT id, app_mission_id, item_index, input_params
                   FROM app_mission_items
                   WHERE status = 'pending'
                   ORDER BY app_mission_id, item_index""",
                fetch_all=True
            )

            if pending_items:
                logger.info(f"♻️ 发现 {len(pending_items)} 个待处理的子任务，重新加入队列...")

                # 按任务分组
                mission_items = {}
                for item in pending_items:
                    mission_id = item['app_mission_id']
                    if mission_id not in mission_items:
                        mission_items[mission_id] = []
                    mission_items[mission_id].append(item)

                # 更新任务状态
                for mission_id in mission_items.keys():
                    database.execute_sql(
                        "UPDATE app_missions SET status = 'queued' WHERE id = ?",
                        (mission_id,)
                    )

                # 加入队列
                with self.queue_lock:
                    for item in pending_items:
                        self.item_queue.append({
                            'item_id': item['id'],
                            'mission_id': item['app_mission_id'],
                            'item_index': item['item_index'],
                            'input_params': json.loads(item['input_params'])
                        })

                logger.info(f"♻️ 总共恢复了 {len(pending_items)} 个待处理子任务")

        except Exception as e:
            logger.warning(f"⚠️ 恢复任务失败: {str(e)}")
            import traceback
            traceback.print_exc()


# 全局 App 任务服务实例
app_task_manager = AppTaskManager()

# 保持向后兼容，创建 task_manager 别名
task_manager = app_task_manager
