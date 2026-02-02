"""
RunningHub AI 应用集成服务
专门用于 App 任务（调用 AI 应用）
"""
import http.client
import json
import ssl
import requests
import urllib3
from core import get_api_key
from utils import get_logger

# 禁用 SSL 警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 获取日志器
logger = get_logger(__name__)

API_HOST = "www.runninghub.cn"


def _use_mock():
    """判断是否使用 Mock 服务（动态读取环境变量）"""
    import os
    return os.getenv("USE_MOCK_SERVICE", "false").lower() == "true"


def get_api_key_for_app():
    """获取 App 任务专用的 API Key"""
    return get_api_key(task_type="app")


def get_nodo(webappId):
    """
    获取 AI 应用的节点配置

    Args:
        webappId: 应用 ID

    Returns:
        节点信息列表
    """
    # Mock 模式
    if _use_mock():
        from integrations import mock_runninghub
        logger.info(f"使用 Mock 服务获取应用配置: {webappId}")
        return mock_runninghub.get_nodo(webappId)

    # 真实 API 调用
    api_key = get_api_key_for_app()

    # 创建不验证 SSL 的上下文
    context = ssl._create_unverified_context()
    conn = http.client.HTTPSConnection(API_HOST, context=context)
    payload = ''
    headers = {}
    conn.request("GET", f"/api/webapp/apiCallDemo?apiKey={api_key}&webappId={webappId}", payload, headers)
    res = conn.getresponse()
    # 读取响应内容
    data = res.read()
    # 转成 Python 字典
    data_json = json.loads(data.decode("utf-8"))
    # 取出 nodeInfoList
    node_info_list = data_json.get("data", {}).get("nodeInfoList", [])
    print("✅ 提取的 nodeInfoList (使用 App Task API Key):")
    print(json.dumps(node_info_list, indent=2, ensure_ascii=False))
    return node_info_list


def upload_file(file_path):
    """
    上传文件到 RunningHub 平台（用于 App 任务）

    Args:
        file_path: 文件路径

    Returns:
        上传结果
    """
    # Mock 模式
    if _use_mock():
        from integrations import mock_runninghub
        logger.info(f"使用 Mock 服务上传文件: {file_path}")
        return mock_runninghub.upload_file(file_path)

    # 真实 API 调用
    api_key = get_api_key_for_app()

    url = "https://www.runninghub.cn/task/openapi/upload"
    headers = {
        'Host': 'www.runninghub.cn'
    }
    data = {
        'apiKey': api_key,
        'fileType': 'input'
    }
    with open(file_path, 'rb') as f:
        files = {'file': f}
        # 禁用 SSL 验证
        response = requests.post(url, headers=headers, files=files, data=data, verify=False)
    return response.json()


def submit_task(webapp_id, node_info_list):
    """
    提交 App 任务到 RunningHub

    Args:
        webapp_id: 应用 ID
        node_info_list: 节点信息列表

    Returns:
        提交结果
    """
    # Mock 模式
    if _use_mock():
        from integrations import mock_runninghub
        logger.info(f"使用 Mock 服务提交任务: {webapp_id}")
        return mock_runninghub.submit_task(webapp_id, node_info_list)

    # 真实 API 调用
    api_key = get_api_key_for_app()

    # 创建不验证 SSL 的上下文
    context = ssl._create_unverified_context()
    conn = http.client.HTTPSConnection(API_HOST, context=context)
    payload = json.dumps({
        "webappId": webapp_id,
        "apiKey": api_key,
        "nodeInfoList": node_info_list
    })
    headers = {
        'Host': API_HOST,
        'Content-Type': 'application/json'
    }
    conn.request("POST", "/task/openapi/ai-app/run", payload, headers)
    res = conn.getresponse()
    data = json.loads(res.read().decode("utf-8"))
    conn.close()
    return data


def query_task_outputs(task_id):
    """
    查询 App 任务输出

    Args:
        task_id: 任务 ID

    Returns:
        任务输出结果
    """
    # Mock 模式
    if _use_mock():
        from integrations import mock_runninghub
        logger.info(f"使用 Mock 服务查询任务输出: {task_id}")
        return mock_runninghub.query_task_outputs(task_id)

    # 真实 API 调用
    api_key = get_api_key_for_app()

    # 创建不验证 SSL 的上下文
    context = ssl._create_unverified_context()
    conn = http.client.HTTPSConnection(API_HOST, context=context)
    payload = json.dumps({
        "apiKey": api_key,
        "taskId": task_id
    })
    headers = {
        'Host': API_HOST,
        'Content-Type': 'application/json'
    }
    conn.request("POST", "/task/openapi/outputs", payload, headers)
    res = conn.getresponse()
    data = json.loads(res.read().decode("utf-8"))
    conn.close()
    return data


# 测试代码（已注释）
# if __name__ == "__main__":
#     print("下面两个输入用于获得AI应用所需要的信息，api_key为用户的密钥从api调用——进入控制台中获得，webappId为（此为示例，具体的webappId为你所选择的AI应用界面上方的链接https://www.runninghub.cn/ai-detail/1937084629516193794，最后的数字为webappId）")
#     Api_key = input("请输入你的 api_key: ").strip()
#     webappid = input("请输入 webappId: ").strip()
#     print("等待node_info_list生成（包涵所有的可以修改的node节点）")
#     node_info_list = get_nodo(webappid, Api_key)
#     print("下面用户可以输入AI应用可以修改的节点id：nodeId,以及对应的fileName,锁定具体的节点位置，在找到具体位置之后，输入您需要修改的fileValue信息完成信息的修改用户发送AI应用请求")
#     while True:
#         node_id_input = input("请输入 nodeId（输入 'exit' 结束修改）: ").strip()
#         if node_id_input.lower() == "exit":
#             break
#         field_name_input = input("请输入 fieldName: ").strip()
#         # 查找对应节点
#         target_node = next(
#             (n for n in node_info_list if n['nodeId'] == node_id_input and n['fieldName'] == field_name_input), None)
#         if not target_node:
#             print("❌ 未找到对应节点")
#             continue
#         print(f"选中节点: {target_node}")
#         # 根据类型处理
#         if target_node['fieldType'] in ["IMAGE", "AUDIO", "VIDEO"]:
#             file_path = input(f"请输入您本地{target_node['fieldType']}文件路径: ").strip()
#             print("等待文件上传中")
#             upload_result = upload_file(Api_key, file_path)
#             print("上传结果:", upload_result)
#             # 假设 upload_file 已返回解析后的 JSON 字典
#             if upload_result and upload_result.get("msg") == "success":
#                 uploaded_file_name = upload_result.get("data", {}).get("fileName")
#                 if uploaded_file_name:
#                     target_node['fieldValue'] = uploaded_file_name
#                     print(f"✅ 已更新 {target_node['fieldType']} fieldValue:", uploaded_file_name)
#             else:
#                 print("❌ 上传失败或返回格式异常:", upload_result)
#         else:
#             # 其他类型直接修改
#             new_value = input(f"请输入新的 fieldValue ({target_node['fieldType']}): ").strip()
#             target_node['fieldValue'] = new_value
#             print("✅ 已更新 fieldValue:", new_value)
#     print("开始提交任务，请等待")
#     # 提交任务
#     submit_result = submit_task(webappid, node_info_list,Api_key)
#     print("📌 提交任务返回:", submit_result)
#     if submit_result.get("code") != 0:
#         print("❌ 提交任务失败:", submit_result)
#         exit()
#     task_id = submit_result["data"]["taskId"]
#     print(f"📝 taskId: {task_id}")
#     # 解析成功返回
#     prompt_tips_str = submit_result["data"].get("promptTips")
#     if prompt_tips_str:
#         try:
#             prompt_tips = json.loads(prompt_tips_str)
#             node_errors = prompt_tips.get("node_errors", {})
#             if node_errors:
#                 print("⚠️ 节点错误信息如下：")
#                 for node_id, err in node_errors.items():
#                     print(f"  节点 {node_id} 错误: {err}")
#             else:
#                 print("✅ 无节点错误，任务提交成功。")
#         except Exception as e:
#             print("⚠️ 无法解析 promptTips:", e)
#     else:
#         print("⚠️ 未返回 promptTips 字段。")
#     timeout = 600
#     start_time = time.time()
#     while True:
#         outputs_result = query_task_outputs(task_id, Api_key)
#         code = outputs_result.get("code")
#         msg = outputs_result.get("msg")
#         data = outputs_result.get("data")
#         if code == 0 and data:  # 成功
#             file_url = data[0].get("fileUrl")
#             print("🎉 生成结果完成！")
#             print(data)
#             break
#         elif code == 805:  # 任务失败
#             failed_reason = data.get("failedReason") if data else None
#             print("❌ 任务失败！")
#             if failed_reason:
#                 print(f"节点 {failed_reason.get('node_name')} 失败原因: {failed_reason.get('exception_message')}")
#                 print("Traceback:", failed_reason.get("traceback"))
#             else:
#                 print(outputs_result)
#             break
#         elif code == 804 or code == 813:  # 运行中或排队中
#             status_text = "运行中" if code == 804 else "排队中"
#             print(f"⏳ 任务{status_text}...")
#         else:
#             print("⚠️ 未知状态:", outputs_result)
#         # 超时检查
#         if time.time() - start_time > timeout:
#             print("⏰ 等待超时（超过10分钟），任务未完成。")
#             break
#         time.sleep(5)
#     print("✅ 任务完成！")
