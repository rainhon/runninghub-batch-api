"""
Mock API 客户端
用于模拟 RunningHub API 任务接口,方便测试和开发
支持四种任务类型: text_to_image, image_to_image, text_to_video, image_to_video
支持持久化存储，重启后可恢复任务状态
"""
import time
import random
import threading
import json
import os
from typing import Dict, Any, Optional
from utils import get_logger

logger = get_logger(__name__)

# Mock 持久化文件路径
MOCK_STATE_FILE = "./mock_api_state.json"


class MockApiClient:
    """模拟 RunningHub API 客户端（支持持久化）"""

    def __init__(self):
        # 模拟任务存储
        self.mock_tasks = {}  # {task_id: task_info}
        self.task_counter = 0
        self.running_tasks = set()  # 跟踪正在运行的任务
        self.lock = threading.Lock()

        # 模拟的并发限制
        self.max_concurrent = 50

        # 模拟的执行时间配置（秒）
        self.min_execution_time = 3
        self.max_execution_time = 15

        # 模拟的成功率
        self.success_rate = 0.85  # 85% 成功率

        # 加载持久化状态
        self._load_state()

    def submit_task(self, task_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        模拟提交 API 任务

        Args:
            task_type: 任务类型 (text_to_image, image_to_image, text_to_video, image_to_video)
            payload: 任务参数

        Returns:
            提交结果，包含 taskId
        """
        with self.lock:
            # 检查并发限制
            if len(self.running_tasks) >= self.max_concurrent:
                return {
                    "code": 429,
                    "message": f"超过最大并发数限制（当前: {len(self.running_tasks)}，最大: {self.max_concurrent}）"
                }

            self.task_counter += 1
            task_id = f"mock_api_task_{self.task_counter}_{int(time.time())}"

            # 验证必需参数
            validation_result = self._validate_params(task_type, payload)
            if not validation_result["valid"]:
                return {
                    "code": 400,
                    "message": validation_result["error"]
                }

            # 模拟存储任务
            self.mock_tasks[task_id] = {
                "taskId": task_id,
                "taskType": task_type,
                "payload": payload,
                "status": "QUEUED",
                "created_at": time.time(),
                "execution_time": random.randint(self.min_execution_time, self.max_execution_time)
            }

            # 标记为运行中
            self.running_tasks.add(task_id)

            logger.info(f"📤 Mock: 提交任务 {task_id} (类型: {task_type})")

            # 在锁外保存状态
            self._save_state_unsafe()

            return {
                "code": 200,
                "message": "任务提交成功",
                "taskId": task_id
            }

    def query_task(self, task_id: str) -> Dict[str, Any]:
        """
        模拟查询任务状态

        Args:
            task_id: 任务ID

        Returns:
            任务状态和结果
        """
        if task_id not in self.mock_tasks:
            return {
                "code": 404,
                "message": "任务不存在"
            }

        task = self.mock_tasks[task_id]
        elapsed = time.time() - task["created_at"]
        execution_time = task["execution_time"]

        # 模拟不同的执行阶段
        if elapsed < 1:
            # 0-1秒：排队中
            task["status"] = "QUEUED"
            return {
                "code": 200,
                "status": "QUEUED",
                "message": "任务排队中"
            }
        elif elapsed < execution_time:
            # 执行中
            task["status"] = "RUNNING"
            progress = min(95, int((elapsed / execution_time) * 100))
            return {
                "code": 200,
                "status": "RUNNING",
                "message": f"任务执行中 ({progress}%)",
                "progress": progress
            }
        else:
            # 执行完成，随机决定成功或失败
            if task["status"] != "SUCCESS" and task["status"] != "FAILED":
                # 从运行任务集合中移除
                with self.lock:
                    if task_id in self.running_tasks:
                        self.running_tasks.remove(task_id)

                # 根据成功率随机决定结果
                if random.random() < self.success_rate:
                    # 成功
                    task["status"] = "SUCCESS"
                    result_url = self._generate_mock_result(task)
                    task["result_url"] = result_url

                    logger.info(f"✅ Mock: 任务 {task_id} 成功完成")

                    # 保存最终状态
                    self._save_state_unsafe()

                    return {
                        "code": 200,
                        "status": "SUCCESS",
                        "message": "任务执行成功",
                        "results": [{
                            "url": result_url,
                            "type": task["taskType"]
                        }]
                    }
                else:
                    # 失败
                    task["status"] = "FAILED"
                    error_message = self._generate_mock_error()
                    task["error_message"] = error_message

                    logger.warning(f"❌ Mock: 任务 {task_id} 失败: {error_message}")

                    # 保存最终状态
                    self._save_state_unsafe()

                    return {
                        "code": 500,
                        "status": "FAILED",
                        "message": "任务执行失败",
                        "errorMessage": error_message
                    }

            # 返回已保存的结果
            if task["status"] == "SUCCESS":
                return {
                    "code": 200,
                    "status": "SUCCESS",
                    "message": "任务执行成功",
                    "results": [{
                        "url": task["result_url"],
                        "type": task["taskType"]
                    }]
                }
            else:  # FAILED
                return {
                    "code": 500,
                    "status": "FAILED",
                    "message": "任务执行失败",
                    "errorMessage": task.get("error_message", "未知错误")
                }

    def _validate_params(self, task_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """验证任务参数"""
        required_fields = {
            "text_to_image": ["prompt"],
            "image_to_image": ["imageUrls", "prompt"],
            "text_to_video": ["prompt"],
            "image_to_video": ["imageUrl", "prompt"]
        }

        if task_type not in required_fields:
            return {
                "valid": False,
                "error": f"不支持的任务类型: {task_type}"
            }

        fields = required_fields[task_type]
        missing_fields = [f for f in fields if f not in payload or not payload[f]]

        if missing_fields:
            return {
                "valid": False,
                "error": f"缺少必需参数: {', '.join(missing_fields)}"
            }

        return {"valid": True}

    def _generate_mock_result(self, task: Dict[str, Any]) -> str:
        """生成模拟结果 URL"""
        task_type = task["taskType"]
        timestamp = int(time.time())

        # 根据任务类型生成不同的模拟结果
        if "image" in task_type:
            # 图片任务：使用 picsum.photos 提供的真实随机图片
            # 根据 taskId 生成固定的随机种子，确保同一任务返回相同图片
            seed = hash(task['taskId']) % 1000

            if task_type == "text_to_image":
                # 文生图：横版 16:9
                return f"https://picsum.photos/seed/{seed}/1024/576"
            else:
                # 图生图：竖版 3:4
                return f"https://picsum.photos/seed/{seed}/768/1024"

        elif "video" in task_type:
            # 视频任务：返回示例视频 URL（使用公共示例视频）
            # 使用 Big Buck Bunny 或 Sintel 的示例视频片段
            return "https://media.w3.org/2010/05/sintel/trailer.mp4"

        return f"mock://result/{task['taskId']}_{timestamp}"

    def _generate_mock_error(self) -> str:
        """生成模拟错误信息"""
        errors = [
            "API 服务暂时不可用",
            "生成超时",
            "参数验证失败",
            "资源不足",
            "内容审核未通过",
            "模型服务异常"
        ]
        return random.choice(errors)

    def get_stats(self) -> Dict[str, Any]:
        """获取 Mock 服务统计信息"""
        with self.lock:
            total = len(self.mock_tasks)
            queued = sum(1 for t in self.mock_tasks.values() if t["status"] == "QUEUED")
            running = sum(1 for t in self.mock_tasks.values() if t["status"] == "RUNNING")
            success = sum(1 for t in self.mock_tasks.values() if t["status"] == "SUCCESS")
            failed = sum(1 for t in self.mock_tasks.values() if t["status"] == "FAILED")

            return {
                "total_tasks": total,
                "queued": queued,
                "running": running,
                "success": success,
                "failed": failed,
                "running_tasks_count": len(self.running_tasks),
                "max_concurrent": self.max_concurrent
            }

    def reset(self):
        """重置 Mock 服务状态"""
        with self.lock:
            self.mock_tasks.clear()
            self.running_tasks.clear()
            self.task_counter = 0

        # 在锁外保存状态
        self._save_state_unsafe()
        logger.info("🔄 Mock 服务已重置")

    def _save_state_unsafe(self):
        """保存状态到文件（内部方法，假设调用者已持有锁或确保安全）"""
        try:
            state = {
                'mock_tasks': dict(self.mock_tasks),  # 复制一份
                'task_counter': self.task_counter,
                'saved_at': time.time()
            }

            with open(MOCK_STATE_FILE, 'w', encoding='utf-8') as f:
                json.dump(state, f, ensure_ascii=False, indent=2)

            logger.debug(f"💾 已保存 {len(state['mock_tasks'])} 个 Mock 任务状态")

        except Exception as e:
            logger.error(f"❌ 保存 Mock 状态失败: {str(e)}")

    def _load_state(self):
        """从文件加载持久化状态"""
        try:
            if not os.path.exists(MOCK_STATE_FILE):
                logger.info("📝 Mock 状态文件不存在，使用初始状态")
                return

            with open(MOCK_STATE_FILE, 'r', encoding='utf-8') as f:
                state = json.load(f)

            with self.lock:
                self.mock_tasks = state.get('mock_tasks', {})
                self.task_counter = state.get('task_counter', 0)
                # 重新构建 running_tasks 集合
                self.running_tasks = set()
                for task_id, task in self.mock_tasks.items():
                    if task.get('status') in ['QUEUED', 'RUNNING']:
                        self.running_tasks.add(task_id)

            logger.info(f"📥 已加载 {len(self.mock_tasks)} 个 Mock 任务状态")

        except Exception as e:
            logger.error(f"❌ 加载 Mock 状态失败: {str(e)}")


# 全局 Mock 实例
mock_api_client = MockApiClient()


def submit_mock_task(task_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """提交 Mock 任务"""
    return mock_api_client.submit_task(task_type, payload)


def query_mock_task(task_id: str) -> Dict[str, Any]:
    """查询 Mock 任务状态"""
    return mock_api_client.query_task(task_id)


def get_mock_stats() -> Dict[str, Any]:
    """获取 Mock 服务统计"""
    return mock_api_client.get_stats()


def reset_mock():
    """重置 Mock 服务"""
    mock_api_client.reset()


if __name__ == "__main__":
    # 测试代码
    print("=== 测试 Mock API 客户端 ===\n")

    # 1. 测试文生图任务
    print("1. 测试文生图任务:")
    result = submit_mock_task("text_to_image", {
        "prompt": "a beautiful sunset over the ocean",
        "aspectRatio": "16:9"
    })
    print(f"   提交结果: {result}")
    task_id = result.get("taskId")

    # 2. 轮询查询状态
    print(f"\n2. 轮询查询任务状态 (task_id: {task_id}):")
    for i in range(10):
        time.sleep(2)
        status = query_mock_task(task_id)
        print(f"   第{i+1}次查询: status={status.get('status')}, message={status.get('message')}")
        if status.get("status") in ["SUCCESS", "FAILED"]:
            if status.get("status") == "SUCCESS":
                print(f"   ✅ 结果URL: {status['results'][0]['url']}")
            break

    # 3. 测试批量任务
    print("\n3. 测试批量提交:")
    task_ids = []
    for i in range(5):
        result = submit_mock_task("text_to_image", {
            "prompt": f"test image {i+1}"
        })
        if result.get("code") == 200:
            task_ids.append(result["taskId"])
            print(f"   任务 {i+1}: {result['taskId']}")

    # 4. 查看统计信息
    print("\n4. Mock 服务统计:")
    stats = get_mock_stats()
    for key, value in stats.items():
        print(f"   {key}: {value}")

    # 5. 等待所有任务完成
    print("\n5. 等待所有任务完成:")
    completed = 0
    max_wait = 30
    start = time.time()

    while completed < len(task_ids) and time.time() - start < max_wait:
        completed = 0
        for tid in task_ids:
            status = query_mock_task(tid)
            if status.get("status") in ["SUCCESS", "FAILED"]:
                completed += 1
        time.sleep(1)
        print(f"   进度: {completed}/{len(task_ids)} 完成")

    # 6. 最终统计
    print("\n6. 最终统计:")
    stats = get_mock_stats()
    for key, value in stats.items():
        print(f"   {key}: {value}")

    print("\n=== 测试完成 ===")
