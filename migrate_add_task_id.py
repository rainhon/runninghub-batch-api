"""
数据库迁移脚本：为 results 表添加 runninghub_task_id 字段
执行方式：python migrate_add_task_id.py
"""
import sqlite3
import os

DB_FILE_PATH = "./runninghub.db"


def migrate():
    """执行数据库迁移"""
    if not os.path.exists(DB_FILE_PATH):
        print(f"❌ 数据库文件不存在: {DB_FILE_PATH}")
        return False

    try:
        conn = sqlite3.connect(DB_FILE_PATH)
        cursor = conn.cursor()

        # 检查字段是否已存在
        cursor.execute("PRAGMA table_info(results)")
        columns = [col[1] for col in cursor.fetchall()]

        if 'runninghub_task_id' in columns:
            print("✅ runninghub_task_id 字段已存在，无需迁移")
            conn.close()
            return True

        # 添加字段
        print("📝 正在添加 runninghub_task_id 字段...")
        cursor.execute(
            "ALTER TABLE results ADD COLUMN runninghub_task_id TEXT"
        )

        conn.commit()
        conn.close()

        print("✅ 迁移完成！runninghub_task_id 字段已添加到 results 表")
        return True

    except sqlite3.Error as e:
        print(f"❌ 迁移失败: {str(e)}")
        return False


if __name__ == "__main__":
    print("=== 数据库迁移：添加 runninghub_task_id 字段 ===\n")
    success = migrate()
    if success:
        print("\n✅ 迁移成功")
    else:
        print("\n❌ 迁移失败")
