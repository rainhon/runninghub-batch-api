#!/usr/bin/env python3
"""
将 retries 字段从 missions 表移动到 results 表的迁移脚本

运行方式：
python migrate_move_retries.py
"""

import sqlite3
import os

def migrate():
    db_path = 'runninghub.db'

    if not os.path.exists(db_path):
        print(f"❌ 数据库文件不存在: {db_path}")
        return

    print(f"🔄 开始迁移数据库: {db_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # 3. 为 results 表添加 retries 字段
        print("📝 为 results 表添加 retries 字段...")
        cursor.execute("ALTER TABLE results ADD COLUMN retries INTEGER DEFAULT 0")
        conn.commit()
        print("✅ 已添加 retries 字段到 results 表")

        conn.commit()

    except Exception as e:
        conn.rollback()
        print(f"❌ 迁移失败: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
