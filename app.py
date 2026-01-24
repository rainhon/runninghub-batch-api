from fastapi import FastAPI
from fastapi.responses import RedirectResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from pathlib import Path
import repositories as database
import integrations.runninghub as runninghub
from services import task_manager, api_task_manager
from utils import setup_logging, get_logger
from api import api_router


# ============== 生命周期管理 ==============

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时执行
    # 初始化日志系统
    setup_logging(level=logging.INFO)

    logger = get_logger(__name__)
    logger.info("正在初始化应用...")

    # 启动任务管理器
    task_manager.start()
    task_manager.restore_tasks()

    # 启动 API 任务管理器
    api_task_manager.start()
    logger.info("✅ API任务管理器已启动")

    logger.info("应用初始化完成")

    yield

    # 关闭时执行
    logger.info("应用正在关闭...")
    task_manager.stop()
    api_task_manager.stop()
    logger.info("应用已关闭")


app = FastAPI(title="runninghub任务管理", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = get_logger(__name__)


# ============== 额外的通用 API 端点 ==============
# 这些端点不属于任何特定模块，保留在 app.py 中

@app.get("/api/test")
def test():
    """测试数据库连接"""
    try:
        result = database.execute_sql("SELECT COUNT(*) as count FROM medias", fetch_one=True)
        return {"code": 0, "data": result, "msg": "数据库连接正常"}
    except Exception as e:
        return {"code": 500, "data": None, "msg": f"数据库连接失败: {str(e)}"}

@app.get('/api/app/read/{app_id}')
def read_workflow(app_id: str):
    """获取应用的节点配置"""
    try:
        result = runninghub.get_nodo(app_id)
        return {"code": 0, "data": result, "msg": "获取成功"}
    except Exception as e:
        return {"code": 500, "data": None, "msg": f"获取应用配置失败: {str(e)}"}


# ============== 包含新架构的路由 ==============

# 包含所有 API 路由（从 api 模块导入）
app.include_router(api_router, prefix="/api/v1")


# ============== 静态文件服务 ==============

DIST = Path("static")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/")
def redirect_to_static():
    """根路径重定向到 /static"""
    return RedirectResponse(url="/static", status_code=302)

@app.get("/static/{path:path}")
def spa_fallback(path: str):
    """SPA fallback: 对于不存在的路径，返回 index.html"""
    candidate = DIST / path
    if candidate.exists() and candidate.is_file():
        return FileResponse(candidate)
    return FileResponse(DIST / "index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7777)
