"""
数据库迁移脚本：添加 retry_count 字段到 api_mission_items 表
运行方式：python migrate_add_retry_count.py
"""
import sqlite3
import sys
from pathlib import Path

# 数据库文件路径
DB_FILE_PATH = "./runninghub.db"

def migrate():
    """执行迁移"""
    print("🔄 开始迁移数据库...")

    try:
        conn = sqlite3.connect(DB_FILE_PATH)
        cursor = conn.cursor()

        # 检查字段是否已存在
        cursor.execute("PRAGMA table_info(api_mission_items)")
        columns = [col[1] for col in cursor.fetchall()]

        if 'retry_count' in columns:
            print("✅ retry_count 字段已存在，无需迁移")
            return

        # 添加字段
        print("📝 添加 retry_count 字段...")
        cursor.execute(
            "ALTER TABLE api_mission_items ADD COLUMN retry_count INTEGER DEFAULT 0"
        )
        conn.commit()
        print("✅ 数据库迁移完成！")

    except sqlite3.Error as e:
        print(f"❌ 迁移失败: {e}")
        sys.exit(1)
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    # 检查数据库文件是否存在
    if not Path(DB_FILE_PATH).exists():
        print(f"⚠️ 数据库文件不存在: {DB_FILE_PATH}")
        print("请先运行应用程序创建数据库")
        sys.exit(1)

    migrate()
