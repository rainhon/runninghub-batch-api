import runninghub as rh
from pathlib import Path
import json, random, time

def main():
    # res = rh.get_nodo("1982110554355580930")
    # filePath = r"E:\resource\tk素材\others\7.png"
    # res = rh.upload_file(filePath)
    # print(res)

    # 遍历文件夹
    folder = Path("./pics").resolve()
    for file in folder.iterdir():
        if file.is_file():
            print("文件路径：", str(file))
            print("文件名：", file.name)
            upload_result = rh.upload_file(str(file))
            if upload_result and upload_result.get("msg") == "success":
                uploaded_file_name = upload_result.get("data", {}).get("fileName")
            else:
                print("❌ 上传失败或返回格式异常:", upload_result)
                continue
            nodelist = buildNodeList(uploaded_file_name)

            submit_result = rh.submit_task("1982110554355580930", nodelist)
            print("📌 提交任务返回:", submit_result)
            if submit_result.get("code") != 0:
                print("❌ 提交任务失败:", submit_result)
                continue
            task_id = submit_result["data"]["taskId"]
            print(f"📝 taskId: {task_id}")
            prompt_tips_str = submit_result["data"].get("promptTips")
            if prompt_tips_str:
                try:
                    prompt_tips = json.loads(prompt_tips_str)
                    node_errors = prompt_tips.get("node_errors", {})
                    if node_errors:
                        print("⚠️ 节点错误信息如下：")
                        for node_id, err in node_errors.items():
                            print(f"  节点 {node_id} 错误: {err}")
                        continue
                    else:
                        print("✅ 无节点错误，任务提交成功。")
                except Exception as e:
                    print("⚠️ 无法解析 promptTips:", e)
                    continue
            else:
                print("⚠️ 未返回 promptTips 字段。")
            
            timeout = 1500
            start_time = time.time()
            while True:
                outputs_result = rh.query_task_outputs(task_id)
                code = outputs_result.get("code")
                msg = outputs_result.get("msg")
                data = outputs_result.get("data")
                if code == 0 and data:  # 成功
                    file_url = data[0].get("fileUrl")
                    print("🎉 生成结果完成！")
                    print(data)
                    break
                elif code == 805:  # 任务失败
                    failed_reason = data.get("failedReason") if data else None
                    print("❌ 任务失败！")
                    if failed_reason:
                        print(f"节点 {failed_reason.get('node_name')} 失败原因: {failed_reason.get('exception_message')}")
                        print("Traceback:", failed_reason.get("traceback"))
                    else:
                        print(outputs_result)
                    break
                elif code == 804 or code == 813:  # 运行中或排队中
                    status_text = "运行中" if code == 804 else "排队中"
                    print(f"⏳ 任务{status_text}...")
                else:
                    print("⚠️ 未知状态:", outputs_result)
                # 超时检查
                if time.time() - start_time > timeout:
                    print("⏰ 等待超时，任务未完成。")
                    break
                time.sleep(30)

def buildNodeList(file):
    template_id = random.choice(['1', '2', '3', '4', '5', '6'])
    with open('./nodelist.json', encoding='utf-8') as json_file:
        nodelist = json.load(json_file)
    nodelist[0]["fieldValue"] = file
    nodelist[2]["fieldValue"] = template_id
    print("待提交nodelist:")
    print(json.dumps(nodelist, indent=2, ensure_ascii=False))
    return nodelist

if __name__ == "__main__":
    main()