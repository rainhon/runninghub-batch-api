"""
统一日志配置模块
为整个应用提供统一的日志记录功能
"""
import os
import logging
import sys
from logging.handlers import RotatingFileHandler
from datetime import datetime
from pathlib import Path


# 日志目录
LOG_DIR = Path(__file__).parent / 'logs'
LOG_DIR.mkdir(exist_ok=True)

# 日志文件路径
MAIN_LOG_FILE = LOG_DIR / 'app.log'
ERROR_LOG_FILE = LOG_DIR / 'error.log'
RESOURCE_LOG_FILE = LOG_DIR / 'resource.log'

# 日志格式
LOG_FORMAT = '%(asctime)s [%(levelname)s] [%(name)s:%(funcName)s:%(lineno)d] [%(threadName)s] %(message)s'
DATE_FORMAT = '%Y-%m-%d %H:%M:%S'


def setup_logging(
    level=logging.INFO,
    max_bytes=10*1024*1024,  # 10MB
    backup_count=5
):
    """配置应用的日志系统

    Args:
        level: 日志级别
        max_bytes: 单个日志文件最大大小
        backup_count: 保留的备份文件数量
    """
    # 获取根日志器
    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # 清除已有的 handlers
    root_logger.handlers.clear()

    # 创建 formatter
    file_formatter = logging.Formatter(LOG_FORMAT, DATE_FORMAT)

    # 主日志文件（所有级别）
    main_handler = RotatingFileHandler(
        MAIN_LOG_FILE,
        maxBytes=max_bytes,
        backupCount=backup_count,
        encoding='utf-8'
    )
    main_handler.setLevel(level)
    main_handler.setFormatter(file_formatter)
    root_logger.addHandler(main_handler)

    # 错误日志文件（只记录 ERROR 及以上）
    error_handler = RotatingFileHandler(
        ERROR_LOG_FILE,
        maxBytes=max_bytes,
        backupCount=backup_count,
        encoding='utf-8'
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(file_formatter)
    root_logger.addHandler(error_handler)

    # 配置第三方库的日志级别（减少噪音）
    logging.getLogger('uvicorn').setLevel(logging.WARNING)
    logging.getLogger('uvicorn.access').setLevel(logging.WARNING)
    logging.getLogger('fastapi').setLevel(logging.WARNING)
    logging.getLogger('httpx').setLevel(logging.WARNING)
    logging.getLogger('httpcore').setLevel(logging.WARNING)

    # 记录启动信息
    logger = logging.getLogger(__name__)
    logger.info("=" * 60)
    logger.info(f"应用启动 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"日志级别: {logging.getLevelName(level)}")
    logger.info(f"日志目录: {LOG_DIR}")
    logger.info("=" * 60)

    return logger


def get_logger(name: str) -> logging.Logger:
    """获取指定名称的日志器

    Args:
        name: 日志器名称（通常使用 __name__）

    Returns:
        logging.Logger 实例
    """
    return logging.getLogger(name)


# ========== 资源监控 ==========

def get_resource_usage():
    """获取当前进程的资源使用情况

    Returns:
        dict: 包含内存、线程、文件描述符等信息的字典
    """
    try:
        import psutil
        process = psutil.Process()

        # 内存使用情况
        memory_info = process.memory_info()
        memory_mb = memory_info.rss / 1024 / 1024  # 转换为 MB

        # 线程数
        num_threads = process.num_threads()

        # 文件描述符数量（Unix）或打开的文件句柄（Windows）
        try:
            num_fds = len(process.open_files())
        except:
            num_fds = 0

        # CPU 使用率
        cpu_percent = process.cpu_percent(interval=0.1)

        return {
            'memory_mb': round(memory_mb, 2),
            'memory_gb': round(memory_mb / 1024, 2),
            'num_threads': num_threads,
            'num_open_files': num_fds,
            'cpu_percent': cpu_percent,
        }
    except Exception as e:
        return {
            'error': str(e)
        }


def log_resource_usage(logger=None):
    """记录当前资源使用情况到日志

    Args:
        logger: 日志器实例，如果为 None 则使用默认的 resource logger
    """
    if logger is None:
        logger = get_logger('resource_monitor')

    usage = get_resource_usage()

    if 'error' in usage:
        logger.error(f"获取资源使用情况失败: {usage['error']}")
    else:
        logger.info(
            f"资源使用 - 内存: {usage['memory_mb']} MB ({usage['memory_gb']} GB), "
            f"线程数: {usage['num_threads']}, "
            f"打开文件: {usage['num_open_files']}, "
            f"CPU: {usage['cpu_percent']}%"
        )

    return usage
