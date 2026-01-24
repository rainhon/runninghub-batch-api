### sora2 图生视频
```
import os
import requests
import json
import time

def main():
    print("Hello from RunningHubAPI!")
    API_KEY = RUNNINGHUB_API_KEY
    print(f"API_KEY: {API_KEY}")

    url = "https://www.runninghub.cn/openapi/v2/rhart-video-s/image-to-video"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}",
    }
    payload = {
    "imageUrl": "https://www.runninghub.cn/view?filename=7226c36bd0532c86b6f22780a6bc8e603b81b56e8ba83dd6411fcaced2228b84.png&type=input&subfolder=&Rh-Comfy-Auth=eyJ1c2VySWQiOiIzZjY1MTNlNWEwNjY1N2I4OGYyNjU5NTEzYmU3ZDM0YyIsInNpZ25FeHBpcmUiOjE3Njg5MTAyODM5MTksInRzIjoxNzY4MzA1NDgzOTE5LCJzaWduIjoiZTdhYThjMWU5ZjcxMWM5ZjIyMjA2NWYxNjQ1MTM2NmIifQ==&Rh-Identify=3f6513e5a06657b88f2659513be7d34c&rand=0.23897629876295323",
    "duration": "10",
    "aspectRatio": "9:16",
    "prompt": "基于原图生成10秒动态视频，角色使用地道男声京腔配音，语气带点胡同大爷的调侃劲儿。 0–2秒：狸花猫翘着二郎腿，爪尖轻敲桌面，斜眼笑：“咱这节目今天炸了啊！” 2–5秒：哈士奇一愣，领结歪了也不管，急问：“真的啊？咱上热搜了？” 5–10秒：哈士奇瞬间石化，瞳孔地震；狸花猫憋不住，“噗”地笑出声，拍桌打滚，耳机滑到耳朵尖，背景霓虹灯“Whisker & Howl”同步闪红——全场爆笑收尾！"
}

    begin = time.time()
    response = requests.post(url, headers=headers, data=json.dumps(payload))
    if response.status_code == 200:
        result = response.json()
        task_id = result.get("taskId")
        print(f"Task submitted successfully. Task ID: {task_id}")
    else:
        print(f"Error: {response.status_code}, {response.text}")
        return

    query_url = "https://www.runninghub.cn/openapi/v2/query"
    query_headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}",
    }

    # Poll for results
    while True:
        query_payload = {"taskId": task_id}
        response = requests.post(query_url, headers=query_headers, data=json.dumps(query_payload))
        if response.status_code == 200:
            result = response.json()
            status = result["status"]

            if status == "SUCCESS":
                end = time.time()
                print(f"Task completed in {end - begin} seconds.")
                if result.get("results") and len(result["results"]) > 0:
                    output_url = result["results"][0]["url"]
                    print(f"Task completed. URL: {output_url}")
                else:
                    print("Task completed but no results found.")
                break
            elif status == "RUNNING" or status == "QUEUED":
                print(f"Task still processing. Status: {status}")
            else:
                # FAILED or other error status
                error_message = result.get("errorMessage", "Unknown error")
                print(f"Task failed: {error_message}")
                break
        else:
            print(f"Error: {response.status_code}, {response.text}")
            break

        time.sleep(5)


if __name__ == "__main__":
    main()
```
### sora2 文生视频
```
import os
import requests
import json
import time

def main():
    print("Hello from RunningHubAPI!")
    API_KEY = RUNNINGHUB_API_KEY
    print(f"API_KEY: {API_KEY}")

    url = "https://www.runninghub.cn/openapi/v2/rhart-video-s/text-to-video"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}",
    }
    payload = {
    "duration": "10",
    "prompt": "阳光透过高大的橡树洒在一片魔法森林中，小狐狸与会说话的蘑菇一起跳舞，远处有瀑布和漂浮的蒲公英。画面柔和温暖，手绘动画质感，色彩明亮饱和，镜头缓慢推进，风格致敬宫崎骏《龙猫》。",
    "aspectRatio": "9:16"
}

    begin = time.time()
    response = requests.post(url, headers=headers, data=json.dumps(payload))
    if response.status_code == 200:
        result = response.json()
        task_id = result.get("taskId")
        print(f"Task submitted successfully. Task ID: {task_id}")
    else:
        print(f"Error: {response.status_code}, {response.text}")
        return

    query_url = "https://www.runninghub.cn/openapi/v2/query"
    query_headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}",
    }

    # Poll for results
    while True:
        query_payload = {"taskId": task_id}
        response = requests.post(query_url, headers=query_headers, data=json.dumps(query_payload))
        if response.status_code == 200:
            result = response.json()
            status = result["status"]

            if status == "SUCCESS":
                end = time.time()
                print(f"Task completed in {end - begin} seconds.")
                if result.get("results") and len(result["results"]) > 0:
                    output_url = result["results"][0]["url"]
                    print(f"Task completed. URL: {output_url}")
                else:
                    print("Task completed but no results found.")
                break
            elif status == "RUNNING" or status == "QUEUED":
                print(f"Task still processing. Status: {status}")
            else:
                # FAILED or other error status
                error_message = result.get("errorMessage", "Unknown error")
                print(f"Task failed: {error_message}")
                break
        else:
            print(f"Error: {response.status_code}, {response.text}")
            break

        time.sleep(5)


if __name__ == "__main__":
    main()
```

### 香蕉图生图
```
import os
import requests
import json
import time

def main():
    print("Hello from RunningHubAPI!")
    API_KEY = RUNNINGHUB_API_KEY
    print(f"API_KEY: {API_KEY}")

    url = "https://www.runninghub.cn/openapi/v2/rhart-image-v1/edit"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}",
    }
    payload = {
    "prompt": "Replace the dragon fruit in the image with an adorable, stylized monkey that matches the original artistic style and texture.",
    "aspectRatio": "auto",
    "imageUrls": [
        "https://www.runninghub.cn/view?filename=f93dc1c0814751c58295aac0a0051a4be43eee56cd50e6ae86e6ef035846616f.png&type=input&subfolder=&Rh-Comfy-Auth=eyJ1c2VySWQiOiI2YmM2OGI0OTM1OWJkYjU2YzNlYWExYjdlN2JkZGIyYyIsInNpZ25FeHBpcmUiOjE3Njg4OTQxMDM4NDYsInRzIjoxNzY4Mjg5MzAzODQ2LCJzaWduIjoiNjNkMmU4YjE4NTJiYmQyNzYzNzQ0YjUyZDlkNjY4NGYifQ==&Rh-Identify=6bc68b49359bdb56c3eaa1b7e7bddb2c&rand=0.42244149371610906"
    ]
}

    begin = time.time()
    response = requests.post(url, headers=headers, data=json.dumps(payload))
    if response.status_code == 200:
        result = response.json()
        task_id = result.get("taskId")
        print(f"Task submitted successfully. Task ID: {task_id}")
    else:
        print(f"Error: {response.status_code}, {response.text}")
        return

    query_url = "https://www.runninghub.cn/openapi/v2/query"
    query_headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}",
    }

    # Poll for results
    while True:
        query_payload = {"taskId": task_id}
        response = requests.post(query_url, headers=query_headers, data=json.dumps(query_payload))
        if response.status_code == 200:
            result = response.json()
            status = result["status"]

            if status == "SUCCESS":
                end = time.time()
                print(f"Task completed in {end - begin} seconds.")
                if result.get("results") and len(result["results"]) > 0:
                    output_url = result["results"][0]["url"]
                    print(f"Task completed. URL: {output_url}")
                else:
                    print("Task completed but no results found.")
                break
            elif status == "RUNNING" or status == "QUEUED":
                print(f"Task still processing. Status: {status}")
            else:
                # FAILED or other error status
                error_message = result.get("errorMessage", "Unknown error")
                print(f"Task failed: {error_message}")
                break
        else:
            print(f"Error: {response.status_code}, {response.text}")
            break

        time.sleep(5)


if __name__ == "__main__":
    main()
```

### 香蕉文生图
```
import os
import requests
import json
import time

def main():
    print("Hello from RunningHubAPI!")
    API_KEY = RUNNINGHUB_API_KEY
    print(f"API_KEY: {API_KEY}")

    url = "https://www.runninghub.cn/openapi/v2/rhart-image-v1/text-to-image"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}",
    }
    payload = {
    "prompt": "A cute baby monkey with hyper-realistic soft fur, its body covered in intricate tribal-inspired geometric patterns that have a holographic iridescent sheen (shifting metallic gold, cyan, and purple hues). The monkey has large expressive dark eyes and a gentle facial expression, crouched on a glossy reflective surface.  Background: Moody neon-lit scene with swirling blue and purple bokeh, blurred glowing abstract decorative elements, and soft ambient neon lighting.  Style: Photorealistic, highly detailed texture, sharp focus on the monkey’s face.",
    "aspectRatio": "3:4"
}

    begin = time.time()
    response = requests.post(url, headers=headers, data=json.dumps(payload))
    if response.status_code == 200:
        result = response.json()
        task_id = result.get("taskId")
        print(f"Task submitted successfully. Task ID: {task_id}")
    else:
        print(f"Error: {response.status_code}, {response.text}")
        return

    query_url = "https://www.runninghub.cn/openapi/v2/query"
    query_headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}",
    }

    # Poll for results
    while True:
        query_payload = {"taskId": task_id}
        response = requests.post(query_url, headers=query_headers, data=json.dumps(query_payload))
        if response.status_code == 200:
            result = response.json()
            status = result["status"]

            if status == "SUCCESS":
                end = time.time()
                print(f"Task completed in {end - begin} seconds.")
                if result.get("results") and len(result["results"]) > 0:
                    output_url = result["results"][0]["url"]
                    print(f"Task completed. URL: {output_url}")
                else:
                    print("Task completed but no results found.")
                break
            elif status == "RUNNING" or status == "QUEUED":
                print(f"Task still processing. Status: {status}")
            else:
                # FAILED or other error status
                error_message = result.get("errorMessage", "Unknown error")
                print(f"Task failed: {error_message}")
                break
        else:
            print(f"Error: {response.status_code}, {response.text}")
            break

        time.sleep(5)


if __name__ == "__main__":
    main()
```