"""
测试 Mock 模式是否正常工作
"""
import os
import sys

# 设置 Mock 模式
os.environ["USE_MOCK_SERVICE"] = "true"
os.environ["RUNNINGHUB_APP_TASK_KEY"] = ""
os.environ["RUNNINGHUB_DIRECT_API_KEY"] = ""

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 导入配置
from core import get_api_key, USE_MOCK_SERVICE

print("USE_MOCK_SERVICE =", USE_MOCK_SERVICE)
print()

try:
    api_key = get_api_key(task_type="app")
    print("[OK] Successfully get API Key:", api_key)
except Exception as e:
    print("[FAIL] Failed to get API Key:", e)

try:
    api_key = get_api_key(task_type="direct")
    print("[OK] Successfully get Direct API Key:", api_key)
except Exception as e:
    print("[FAIL] Failed to get Direct API Key:", e)

print()
print("Testing runninghub.get_nodo()...")
from integrations import runninghub

try:
    nodes = runninghub.get_nodo("test_app_123")
    print("[OK] Successfully get nodes, count:", len(nodes))
    print("Nodes:", nodes)
except Exception as e:
    print("[FAIL] Failed to get nodes:", e)
    import traceback
    traceback.print_exc()
