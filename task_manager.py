"""
任务管理模块
负责任务队列管理、状态轮询和生命周期管理
"""
import time
import threading
from queue import Queue
from typing import Optional
import database
import runninghub


# 配置常量
MAX_CONCURRENT_TASKS = 2  # 最大并行任务数
MAX_RETRIES = 10  # 最大重试次数
POLL_TIMEOUT = 1200  # 轮询超时时间（秒）= 20分钟
POLL_INTERVAL = 5  # 轮询间隔（秒）


class TaskManager:
    """任务管理器 - 负责任务队列和执行管理"""

    def __init__(self):
        self.queue = Queue()  # 任务队列
        self.running_tasks = set()  # 正在运行的执行实例 ID
        self.execution_counter = 0  # 执行实例计数器
        self.lock = threading.Lock()
        self.processing_thread = None
        self.is_running = False

    def start(self):
        """启动队列处理线程"""
        if self.processing_thread is None or not self.processing_thread.is_alive():
            self.is_running = True
            self.processing_thread = threading.Thread(target=self._process_queue, daemon=True)
            self.processing_thread.start()
            print("✅ 任务管理器已启动")

    def stop(self):
        """停止队列处理"""
        self.is_running = False
        print("⏹️ 任务管理器已停止")

    def add_task(self, mission_id: int, repeat_index: Optional[int] = None):
        """添加任务到队列

        Args:
            mission_id: 任务ID
            repeat_index: 第几次执行（1, 2, 3...），None表示重试
        """
        with self.lock:
            # 更新数据库状态为 queued
            database.execute_sql(
                "UPDATE missions SET status = 'queued' WHERE id = ?",
                (mission_id,)
            )
            # 存储元组 (mission_id, repeat_index)
            self.queue.put((mission_id, repeat_index))
            print(f"📥 任务 #{mission_id} (第{repeat_index}次执行) 已加入队列，队列长度: {self.queue.qsize()}")

    def submit_mission(self, mission_id: int, repeat_count: int):
        """提交任务的所有重复执行到队列

        Args:
            mission_id: 任务ID
            repeat_count: 重复执行次数
        """
        # 将任务的所有重复执行全部加入队列
        # 队列会自动控制并发数（最多 MAX_CONCURRENT_TASKS 个同时运行）
        for i in range(1, repeat_count + 1):
            self.add_task(mission_id, i)

        print(f"📋 任务 #{mission_id} 已提交到队列，共 {repeat_count} 次执行")

    def cancel_mission(self, mission_id: int):
        """取消任务的排队执行

        Args:
            mission_id: 任务ID

        Returns:
            取消的任务数量
        """
        try:
            with self.lock:
                # 获取任务信息
                task = database.execute_sql(
                    "SELECT repeat_count, status FROM missions WHERE id = ?",
                    (mission_id,),
                    fetch_one=True
                )

                if not task:
                    print(f"⚠️ 任务 #{mission_id} 不存在")
                    return 0

                current_status = task['status']

                # 只能取消队列中或排队中的任务
                if current_status not in ['queued', 'pending', 'running']:
                    print(f"⚠️ 任务 #{mission_id} 状态为 {current_status}，无法取消")
                    return 0

                # 查询已完成的执行
                completed_results = database.execute_sql(
                    "SELECT repeat_index FROM results WHERE mission_id = ?",
                    (mission_id,),
                    fetch_all=True
                )
                completed_indices = set(r['repeat_index'] for r in completed_results) if completed_results else set()

                # 从队列中移除未完成的任务
                # 创建一个新的队列，过滤掉要取消的任务
                new_queue = Queue()
                cancelled_count = 0

                while not self.queue.empty():
                    try:
                        item = self.queue.get_nowait()
                        if item[0] == mission_id and item[1] not in completed_indices:
                            cancelled_count += 1
                        else:
                            new_queue.put(item)
                    except:
                        break

                # 替换队列
                self.queue = new_queue

                # 更新任务状态为已取消
                database.execute_sql(
                    "UPDATE missions SET status = 'cancelled', status_code = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (mission_id,)
                )

                print(f"🚫 任务 #{mission_id} 已取消，移除了 {cancelled_count} 个排队中的执行")
                return cancelled_count

        except Exception as e:
            print(f"❌ 取消任务失败: {str(e)}")
            return 0

    def get_status(self) -> dict:
        """获取队列状态

        Returns:
            包含队列大小、运行中任务数、最大并发数的字典
        """
        with self.lock:
            return {
                "queue_size": self.queue.qsize(),
                "running_count": len(self.running_tasks),
                "max_concurrent": MAX_CONCURRENT_TASKS,
            }

    def restore_tasks(self):
        """恢复之前未完成的任务（启动时调用）"""
        try:
            # 获取未完成的任务
            missions = database.execute_sql(
                "SELECT id, repeat_count FROM missions WHERE status IN ('queued', 'pending', 'running')",
                fetch_all=True
            )
            if missions:
                for mission in missions:
                    mission_id = mission['id']
                    repeat_count = mission['repeat_count']

                    # 查询已完成的执行
                    completed_results = database.execute_sql(
                        "SELECT repeat_index FROM results WHERE mission_id = ?",
                        (mission_id,),
                        fetch_all=True
                    )
                    completed_indices = set(r['repeat_index'] for r in completed_results) if completed_results else set()

                    # 将未完成的执行加入队列
                    restored_count = 0
                    for i in range(1, repeat_count + 1):
                        if i not in completed_indices:
                            self.add_task(mission_id, i)
                            restored_count += 1

                    if restored_count > 0:
                        print(f"♻️ 恢复任务 #{mission_id}：{restored_count}/{repeat_count} 次执行")
                print(f"♻️ 总共恢复了 {len(missions)} 个未完成的任务")
        except Exception as e:
            print(f"⚠️ 恢复任务失败: {str(e)}")

    def retry_failed_missions(self, mission_id: int):
        """重试失败的任务

        Args:
            mission_id: 任务ID

        Returns:
            重试的执行次数
        """
        try:
            # 获取任务信息
            task = database.execute_sql(
                "SELECT repeat_count FROM missions WHERE id = ?",
                (mission_id,),
                fetch_one=True
            )

            if not task:
                print(f"⚠️ 任务 #{mission_id} 不存在")
                return 0

            repeat_count = task['repeat_count']

            # 查询已完成的执行
            completed_results = database.execute_sql(
                "SELECT repeat_index, status FROM results WHERE mission_id = ?",
                (mission_id,),
                fetch_all=True
            )

            # 找出失败的执行
            failed_indices = []
            if completed_results:
                for r in completed_results:
                    if r['status'] == 'failed':
                        failed_indices.append(r['repeat_index'])

            if not failed_indices:
                print(f"⚠️ 任务 #{mission_id} 没有失败的执行")
                return 0

            # 重置任务状态和错误信息
            database.execute_sql(
                "UPDATE missions SET status = 'queued', error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (mission_id,)
            )

            # 将失败的执行重新加入队列
            for repeat_index in failed_indices:
                self.add_task(mission_id, repeat_index)

            print(f"🔄 任务 #{mission_id} 重试 {len(failed_indices)} 次失败的执行")
            return len(failed_indices)

        except Exception as e:
            print(f"❌ 重试任务失败: {str(e)}")
            return 0

    # ========== 内部方法 ==========

    def _process_queue(self):
        """队列处理循环（内部方法）"""
        while self.is_running:
            try:
                with self.lock:  # 加锁确保并发控制准确
                    if not self.queue.empty() and self._can_start_task():
                        task_data = self.queue.get_nowait()  # 使用 nowait 因为已经在锁中
                        mission_id, repeat_index = task_data

                        # 先标记为运行中，再启动线程
                        execution_id = self._get_next_execution_id()
                        self._mark_task_running(execution_id)

                        print(f"🚀 从队列取出任务 #{mission_id} (第{repeat_index}次执行)，当前并发: {self._get_running_count()}/{MAX_CONCURRENT_TASKS}")

                        # 在新线程中处理任务，传入 execution_id
                        task_thread = threading.Thread(
                            target=self._execute_task_with_id,
                            args=(execution_id, task_data,),
                            daemon=True
                        )
                        task_thread.start()

                time.sleep(0.5)  # 避免 CPU 占用过高
            except Exception as e:
                print(f"❌ 队列处理错误: {str(e)}")
                time.sleep(1)

    def _can_start_task(self) -> bool:
        """检查是否可以启动新任务（内部方法）"""
        return self._get_running_count() < MAX_CONCURRENT_TASKS

    def _get_running_count(self) -> int:
        """获取当前运行中的任务数量（内部方法）"""
        with self.lock:
            return len(self.running_tasks)

    def _mark_task_running(self, execution_id: int):
        """标记任务为运行中（内部方法）"""
        with self.lock:
            self.running_tasks.add(execution_id)

    def _mark_task_complete(self, execution_id: int):
        """标记任务完成（内部方法）"""
        with self.lock:
            if execution_id in self.running_tasks:
                self.running_tasks.remove(execution_id)

    def _get_next_execution_id(self) -> int:
        """获取下一个执行实例 ID（内部方法）"""
        with self.lock:
            self.execution_counter += 1
            return self.execution_counter

    def _execute_task_with_id(self, execution_id: int, task_data: tuple):
        """执行单个任务（内部方法）- 已预先标记运行中

        Args:
            execution_id: 执行实例ID
            task_data: (mission_id, repeat_index)
        """
        mission_id, repeat_index = task_data
        if repeat_index is None:
            repeat_index = 1  # 默认为第1次

        error_message = None
        try:
            # 已经在 _process_queue 中标记为运行中了，不需要再次标记
            print(f"🔵 执行实例 #{execution_id} - 任务 #{mission_id} (第{repeat_index}次执行) 开始")

            # 获取任务信息
            task = database.execute_sql(
                "SELECT * FROM missions WHERE id = ?",
                (mission_id,),
                fetch_one=True
            )

            if not task:
                print(f"⚠️ 任务 #{mission_id} 不存在")
                return

            app_id = task['workflow']
            import json
            nodes = json.loads(task['nodes_list']) if task['nodes_list'] else []
            repeat_count = task['repeat_count']
            current_retries = task['retries']

            print(f"▶️ 执行实例 #{execution_id} - 任务 #{mission_id} 第{repeat_index}次执行开始（重试 {current_retries} 次）")

            # 提交到 RunningHub
            submit_result = runninghub.submit_task(app_id, nodes)

            if submit_result.get('code') != 0:
                # 提交失败
                error_message = f"提交到 RunningHub 失败: {submit_result.get('msg', '未知错误')}"
                raise Exception(error_message)

            runninghub_task_id = submit_result['data'].get('taskId')

            # 更新任务状态
            database.execute_sql(
                "UPDATE missions SET task_id = ?, status = 'running', status_code = 804, error_message = NULL WHERE id = ?",
                (runninghub_task_id, mission_id)
            )

            # 轮询任务状态
            self._poll_task_status(mission_id, runninghub_task_id, app_id, nodes, repeat_index, repeat_count)

        except Exception as e:
            error_message = str(e)
            print(f"❌ 执行实例 #{execution_id} - 任务 #{mission_id} 出错: {error_message}")

            # 获取当前重试次数
            task_info = database.execute_sql(
                "SELECT retries, repeat_count FROM missions WHERE id = ?",
                (mission_id,),
                fetch_one=True
            )
            current_retries = task_info['retries'] if task_info else 0
            repeat_count = task_info['repeat_count'] if task_info else 1

            if current_retries < MAX_RETRIES:
                # 未达到重试上限，重试当前这次执行
                database.execute_sql(
                    "UPDATE missions SET retries = retries + 1, error_message = ?, status = 'queued', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (error_message, mission_id)
                )
                print(f"🔄 任务 #{mission_id} 第 {repeat_index} 次执行出错，准备重试（{MAX_RETRIES - current_retries} 次剩余）")
                self.add_task(mission_id, repeat_index)  # 重新加入队列，使用相同的 repeat_index
            else:
                # 达到重试上限，记录失败
                database.execute_sql(
                    "INSERT INTO results (mission_id, repeat_index, status, error_message) VALUES (?, ?, 'failed', ?)",
                    (mission_id, repeat_index, error_message)
                )
                print(f"❌ 任务 #{mission_id} 第 {repeat_index} 次执行已达重试上限（{MAX_RETRIES} 次）")

                # 检查是否所有任务都完成
                self._check_and_update_mission_status(mission_id, repeat_count)
        finally:
            self._mark_task_complete(execution_id)

    def _poll_task_status(self, mission_id: int, runninghub_task_id: str, app_id: str, nodes: list, repeat_index: int, repeat_count: int):
        """后台轮询任务状态（内部方法）

        Args:
            mission_id: 任务ID
            runninghub_task_id: RunningHub 任务ID
            app_id: 应用ID
            nodes: 节点配置
            repeat_index: 第几次执行（1, 2, 3...）
            repeat_count: 总共需要执行的次数
        """
        start_time = time.time()

        try:
            while True:
                outputs_result = runninghub.query_task_outputs(runninghub_task_id)
                code = outputs_result.get("code")
                data = outputs_result.get("data")

                if code == 0 and data:  # 成功
                    # 保存结果到 results 表
                    for item in data:
                        file_url = item.get("fileUrl")
                        result_sql = """
                            INSERT INTO results (mission_id, repeat_index, status, file_path, file_url)
                            VALUES (?, ?, 'success', ?, ?)
                        """
                        database.execute_sql(result_sql, (mission_id, repeat_index, file_url, file_url))

                    print(f"✅ 任务 #{mission_id} 第 {repeat_index} 次执行成功")

                    # 检查是否所有任务都完成
                    self._check_and_update_mission_status(mission_id, repeat_count)

                    break

                elif code == 805:  # 失败
                    error_msg = outputs_result.get("msg", "RunningHub 任务执行失败")

                    # 获取当前重试次数
                    task_info = database.execute_sql(
                        "SELECT retries FROM missions WHERE id = ?",
                        (mission_id,),
                        fetch_one=True
                    )
                    current_retries = task_info['retries'] if task_info else 0

                    if current_retries < MAX_RETRIES:
                        # 未达到重试上限，重试当前这次执行
                        database.execute_sql(
                            "UPDATE missions SET retries = retries + 1, error_message = ?, status = 'queued', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                            (error_msg, mission_id)
                        )
                        print(f"❌ 任务 #{mission_id} 第 {repeat_index} 次执行失败，准备重试（{MAX_RETRIES - current_retries} 次剩余）: {error_msg}")
                        self.add_task(mission_id, repeat_index)  # 重新加入队列，使用相同的 repeat_index
                    else:
                        # 达到重试上限，记录失败
                        database.execute_sql(
                            "INSERT INTO results (mission_id, repeat_index, status, error_message) VALUES (?, ?, 'failed', ?)",
                            (mission_id, repeat_index, error_msg)
                        )
                        print(f"❌ 任务 #{mission_id} 第 {repeat_index} 次执行已达重试上限（{MAX_RETRIES} 次）")

                        # 检查是否所有任务都完成
                        self._check_and_update_mission_status(mission_id, repeat_count)

                    break

                elif code == 804:  # 运行中
                    database.execute_sql(
                        "UPDATE missions SET status = 'running', status_code = 804, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                        (mission_id,)
                    )

                elif code == 813:  # 排队中
                    database.execute_sql(
                        "UPDATE missions SET status = 'pending', status_code = 813, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                        (mission_id,)
                    )

                # 超时检查
                if time.time() - start_time > POLL_TIMEOUT:
                    error_msg = f"任务执行超时（{POLL_TIMEOUT}秒）"

                    # 获取当前重试次数
                    task_info = database.execute_sql(
                        "SELECT retries FROM missions WHERE id = ?",
                        (mission_id,),
                        fetch_one=True
                    )
                    current_retries = task_info['retries'] if task_info else 0

                    if current_retries < MAX_RETRIES:
                        # 未达到重试上限，重试
                        database.execute_sql(
                            "UPDATE missions SET retries = retries + 1, error_message = ?, status = 'queued', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                            (error_msg, mission_id)
                        )
                        print(f"⏰ 任务 #{mission_id} 第 {repeat_index} 次执行超时，准备重试（{MAX_RETRIES - current_retries} 次剩余）")
                        self.add_task(mission_id, repeat_index)  # 重新加入队列，使用相同的 repeat_index
                    else:
                        # 达到重试上限，记录失败
                        database.execute_sql(
                            "INSERT INTO results (mission_id, repeat_index, status, error_message) VALUES (?, ?, 'failed', ?)",
                            (mission_id, repeat_index, error_msg)
                        )
                        print(f"⏰ 任务 #{mission_id} 第 {repeat_index} 次执行已达重试上限（{MAX_RETRIES} 次）")

                        # 检查是否所有任务都完成
                        self._check_and_update_mission_status(mission_id, repeat_count)

                    break

                time.sleep(POLL_INTERVAL)  # 每 5 秒轮询一次

        except Exception as e:
            print(f"❌ 轮询任务 {runninghub_task_id} 时出错: {str(e)}")
            database.execute_sql(
                "UPDATE missions SET status = 'failed', status_code = 805, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (mission_id,)
            )

    def _check_and_update_mission_status(self, mission_id: int, repeat_count: int):
        """检查任务是否全部完成，并更新状态（内部方法）

        Args:
            mission_id: 任务ID
            repeat_count: 总共需要执行的次数
        """
        # 查询已完成（成功+失败）的总数（按 repeat_index 去重）
        completed_result = database.execute_sql(
            "SELECT COUNT(DISTINCT repeat_index) as count FROM results WHERE mission_id = ?",
            (mission_id,),
            fetch_one=True
        )
        completed_count = completed_result['count'] if completed_result else 0

        # 查询成功数量（按 repeat_index 去重）
        success_result = database.execute_sql(
            "SELECT COUNT(DISTINCT repeat_index) as count FROM results WHERE mission_id = ? AND status = 'success'",
            (mission_id,),
            fetch_one=True
        )
        success_count = success_result['count'] if success_result else 0

        # 更新 current_repeat
        database.execute_sql(
            "UPDATE missions SET current_repeat = ?, retries = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (completed_count, mission_id)
        )

        # 检查是否全部完成
        if completed_count >= repeat_count:
            if success_count == repeat_count:
                # 全部成功
                database.execute_sql(
                    "UPDATE missions SET status = 'success', status_code = 0, error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (mission_id,)
                )
                print(f"✅ 任务 #{mission_id} 全部完成（共 {repeat_count} 次，全部成功）")
            elif success_count > 0:
                # 部分成功
                database.execute_sql(
                    "UPDATE missions SET status = 'success', status_code = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (mission_id,)
                )
                print(f"⚠️ 任务 #{mission_id} 完成（共 {repeat_count} 次，{success_count} 次成功，{repeat_count - success_count} 次失败）")
            else:
                # 全部失败
                database.execute_sql(
                    "UPDATE missions SET status = 'failed', status_code = 805, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (mission_id,)
                )
                print(f"❌ 任务 #{mission_id} 全部失败（共 {repeat_count} 次）")


# 全局任务管理器实例
task_manager = TaskManager()
