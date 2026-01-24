"""
API 任务服务模块
支持四种 API 任务类型：文生图、图生图、文生视频、图生视频
最多支持 50 个并发任务
"""
import time
import threading
import json
import os
from collections import deque
from typing import List, Dict, Optional
import requests
import repositories as database
from core import API_TASK_TYPES, MAX_CONCURRENT_API_TASKS, API_POLL_INTERVAL, get_api_key
from utils import get_logger

# 获取日志器
logger = get_logger('api_task_service')


class ApiTaskManager:
    """API任务管理器"""

    def __init__(self):
        self.queue = deque()  # 任务队列
        self.running_items = set()  # 正在运行的子项ID
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

        # 创建数据库记录
        mission_id = database.execute_insert_returning_id(
            """INSERT INTO api_missions
               (name, description, task_type, status, total_count, config_json)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (name, description, task_type, "queued", total_count, json.dumps(fixed_config))
        )

        logger.info(f"📋 API任务 #{mission_id} 已创建，共 {total_count} 个子任务")

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
        """添加任务到队列"""
        with self.lock:
            self.queue.append(mission_id)
            logger.info(f"📥 API任务 #{mission_id} 已加入队列")

    def get_queue_status(self) -> Dict:
        """获取队列状态"""
        with self.lock:
            return {
                "queue_length": len(self.queue),
                "running_items": len(self.running_items),
                "max_concurrent": MAX_CONCURRENT_API_TASKS
            }

    def _process_queue(self):
        """处理队列（内部方法）"""
        while self.is_running:
            try:
                with self.lock:
                    # 检查是否有任务在队列中且未达到并发上限
                    if len(self.queue) > 0 and len(self.running_items) < MAX_CONCURRENT_API_TASKS:
                        mission_id = self.queue.popleft()
                        logger.info(f"🚀 从队列取出 API任务 #{mission_id}")

                        # 在新线程中处理任务
                        thread = threading.Thread(
                            target=self._execute_mission,
                            args=(mission_id,),
                            daemon=True
                        )
                        thread.start()

                time.sleep(0.5)  # 避免 CPU 占用过高
            except Exception as e:
                logger.error(f"❌ 队列处理错误: {str(e)}")
                import traceback
                traceback.print_exc()
                time.sleep(1)

    def _execute_mission(self, mission_id: int):
        """执行单个API任务（内部方法）"""
        try:
            # 获取任务信息
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

            if not items:
                logger.warning(f"⚠️ API任务 #{mission_id} 没有待处理的子任务")
                database.execute_sql(
                    "UPDATE api_missions SET status = 'completed' WHERE id = ?",
                    (mission_id,)
                )
                return

            logger.info(f"▶️ 开始处理 API任务 #{mission_id}，共 {len(items)} 个子任务")

            # 处理每个子任务
            for item in items:
                # 检查是否已取消
                mission_status = database.execute_sql(
                    "SELECT status FROM api_missions WHERE id = ?",
                    (mission_id,),
                    fetch_one=True
                )
                if mission_status and mission_status['status'] == 'cancelled':
                    logger.info(f"🚫 API任务 #{mission_id} 已取消，停止处理")
                    return

                # 标记子任务为处理中
                with self.lock:
                    self.running_items.add(item['id'])

                # 提交到 RunningHub API
                self._submit_item(mission_id, task_type, config, item)

                # 等待完成或失败
                self._poll_item(mission_id, item)

                # 从运行中移除
                with self.lock:
                    self.running_items.discard(item['id'])

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

            # 标记任务为失败
            database.execute_sql(
                "UPDATE api_missions SET status = 'failed' WHERE id = ?",
                (mission_id,)
            )

    def _submit_item(self, mission_id: int, task_type: str, config: Dict, item: Dict):
        """提交单个子任务到 RunningHub API"""
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
            url = api_config["url"]
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {get_api_key()}"
            }

            logger.info(f"📤 提交子任务 #{item['item_index']} 到 RunningHub API: {api_config['name']}")

            response = requests.post(url, headers=headers, json=payload, timeout=30)

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
            raise  # 重新抛出异常，让上层处理

    def _poll_item(self, mission_id: int, item: Dict):
        """轮询单个子任务状态"""
        try:
            runninghub_task_id = item['runninghub_task_id']
            if not runninghub_task_id:
                logger.warning(f"⚠️ 子任务 #{item['item_index']} 没有 runninghub_task_id，跳过轮询")
                return

            query_url = "https://www.runninghub.cn/openapi/v2/query"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {get_api_key()}"
            }

            logger.info(f"🔄 开始轮询子任务 #{item['item_index']} (task_id: {runninghub_task_id})")

            max_polls = 120  # 最多轮询 10 分钟（120 * 5秒）
            poll_count = 0

            while poll_count < max_polls:
                response = requests.post(
                    query_url,
                    headers=headers,
                    json={"taskId": runninghub_task_id},
                    timeout=30
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
                        poll_count += 1
                        time.sleep(API_POLL_INTERVAL)

                    else:
                        # 失败
                        error_message = result.get("errorMessage", "未知错误")
                        raise Exception(f"任务失败: {error_message}")
                else:
                    raise Exception(f"查询失败: {response.status_code}")

            if poll_count >= max_polls:
                raise Exception("轮询超时")

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
