"""
Mock RunningHub 服务
用于模拟任务执行过程，方便测试和开发
"""
import time
import random
import threading
from typing import Optional, Dict, Any, List


class MockRunningHub:
    """模拟 RunningHub API 的行为"""

    def __init__(self):
        # 模拟任务存储
        self.mock_tasks = {}  # {task_id: task_info}
        self.task_counter = 0
        self.running_tasks = set()  # 跟踪正在运行的任务
        self.lock = threading.Lock()

    def get_nodes(self, app_id: str) -> Dict[str, Any]:
        """
        模拟获取应用节点配置

        Args:
            app_id: 应用ID

        Returns:
            应用节点配置
        """
        # 模拟返回一些节点配置
        return {
            "code": 0,
            "msg": "success",
            "data": {
                "nodeInfoList": [
                    {
                        "nodeId": "node_001",
                        "nodeName": "输入文本",
                        "nodeType": "input",
                        "nodeTitle": "请输入内容",
                        "valueType": "text",
                        "isRequired": True,
                        "placeholder": "请输入要处理的文本"
                    },
                    {
                        "nodeId": "node_002",
                        "nodeName": "AI处理",
                        "nodeType": "ai_model",
                        "nodeTitle": "AI文本处理",
                        "modelId": "gpt-4",
                        "modelName": "GPT-4"
                    },
                    {
                        "nodeId": "node_003",
                        "nodeName": "输出结果",
                        "nodeType": "output",
                        "nodeTitle": "处理结果",
                        "outputType": "text"
                    }
                ]
            }
        }

    def submit_task(self, app_id: str, nodes: List[Dict]) -> Dict[str, Any]:
        """
        模拟提交任务

        Args:
            app_id: 应用ID
            nodes: 节点配置列表

        Returns:
            提交结果
        """
        with self.lock:
            # 检查并发限制（模拟最大2个并发任务）
            MAX_CONCURRENT = 2
            if len(self.running_tasks) >= MAX_CONCURRENT:
                return {
                    "code": 806,
                    "msg": f"超过最大并发数限制（当前: {len(self.running_tasks)}，最大: {MAX_CONCURRENT}）"
                }

            self.task_counter += 1
            task_id = f"mock_task_{self.task_counter}_{int(time.time())}"

            # 模拟存储任务
            self.mock_tasks[task_id] = {
                "taskId": task_id,
                "app_id": app_id,
                "nodes": nodes,
                "status": "queued",
                "created_at": time.time()
            }

            # 标记为运行中
            self.running_tasks.add(task_id)

        return {
            "code": 0,
            "msg": "任务提交成功",
            "data": {
                "taskId": task_id
            }
        }

    def query_task_outputs(self, task_id: str) -> Dict[str, Any]:
        """
        模拟查询任务输出

        Args:
            task_id: 任务ID

        Returns:
            任务结果（模拟不同的执行阶段）
        """
        if task_id not in self.mock_tasks:
            return {
                "code": 805,
                "msg": "任务不存在"
            }

        task = self.mock_tasks[task_id]
        elapsed = time.time() - task["created_at"]

        # 模拟不同的执行阶段
        if elapsed < 2:
            # 0-2秒：排队中
            task["status"] = "queued"
            return {
                "code": 813,
                "msg": "任务排队中"
            }
        elif elapsed < 10:
            # 2-40秒：运行中
            task["status"] = "running"
            return {
                "code": 804,
                "msg": "任务执行中"
            }
        else:
            # 40秒后：完成（移除超时失败逻辑）
            task["status"] = "completed"

            # 从运行任务集合中移除
            with self.lock:
                if task_id in self.running_tasks:
                    self.running_tasks.remove(task_id)
            if random.random() < 0.3:
                # 失败
                return {
                    "code": 777,
                    "msg": "ttt"
                }
            
            
            # 成功
            outputs = [{
                "fileUrl": f"mock_result_{task_id}_1.txt",
                "fileName": f"result_{int(time.time())}.txt"
            }]

            # 50%概率返回多个文件
            if random.random() < 0.5:
                outputs.append({
                    "fileUrl": f"mock_result_{task_id}_2.txt",
                    "fileName": f"result_{int(time.time())}_2.txt"
                })

            return {
                "code": 0,
                "msg": "任务执行成功",
                "data": outputs
            }

    def upload_file(self, file_path: str) -> Dict[str, Any]:
        """
        模拟上传文件

        Args:
            file_path: 文件路径

        Returns:
            上传结果
        """
        import os
        file_name = os.path.basename(file_path)

        return {
            "code": 0,
            "msg": "文件上传成功",
            "data": {
                "fileName": f"mock_{file_name}",
                "fileId": f"mock_file_{int(time.time())}",
                "fileHash": "mock_hash_" + str(random.randint(1000, 9999))
            }
        }


# 全局模拟实例
mock_runninghub = MockRunningHub()


# 导出与 runninghub.py 相同的函数接口
def get_nodo(webappId: str) -> List[Dict]:
    """获取应用节点配置"""
    result = mock_runninghub.get_nodes(webappId)
    if result["code"] == 0:
        return result["data"]["nodeInfoList"]
    else:
        raise Exception(f"获取节点失败: {result['msg']}")


def submit_task(webapp_id: str, node_info_list: List[Dict]) -> Dict[str, Any]:
    """提交任务"""
    return mock_runninghub.submit_task(webapp_id, node_info_list)


def query_task_outputs(task_id: str) -> Dict[str, Any]:
    """查询任务输出"""
    return mock_runninghub.query_task_outputs(task_id)


def upload_file(file_path: str) -> Dict[str, Any]:
    """上传文件"""
    return mock_runninghub.upload_file(file_path)


# 配置常量
API_HOST = "mock.runninghub.cn"
API_KEY = "mock_api_key_for_testing"


if __name__ == "__main__":
    # 测试代码
    print("=== 测试 Mock RunningHub ===\n")

    # 1. 测试获取节点
    print("1. 获取应用节点:")
    nodes = get_nodo("test_app_001")
    for node in nodes:
        print(f"  - {node['nodeName']} ({node['nodeId']})")

    # 2. 测试提交任务
    print("\n2. 提交任务:")
    submit_result = submit_task("test_app_001", nodes)
    print(f"  任务ID: {submit_result['data']['taskId']}")

    # 3. 测试查询状态
    print("\n3. 查询任务状态:")
    task_id = submit_result['data']['taskId']
    for i in range(5):
        time.sleep(2)
        result = query_task_outputs(task_id)
        print(f"  第{i+1}次查询: code={result['code']}, msg={result['msg']}")
        if result['code'] == 0 or result['code'] == 805:
            break

    print("\n=== 测试完成 ===")
