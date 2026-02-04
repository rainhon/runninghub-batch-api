-- 迁移脚本：移除 api_missions 表中的平台策略相关字段
-- 执行时间: 2026-02-03
-- 说明: 平台策略现在由系统自动控制（failover 策略），不再需要用户配置

-- 检查并移除 platform_strategy 字段（如果存在）
-- SQLite 不支持直接 DROP COLUMN，需要重建表

BEGIN TRANSACTION;

-- 1. 创建新的 api_missions 表（不含平台字段）
CREATE TABLE IF NOT EXISTS api_missions_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    task_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'queued',
    total_count INTEGER NOT NULL,
    completed_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    config_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 将现有数据复制到新表（排除 platform_strategy 和 platform_id 字段）
INSERT INTO api_missions_new (
    id, name, description, task_type, status,
    total_count, completed_count, failed_count, config_json,
    created_at, updated_at
)
SELECT
    id, name, description, task_type, status,
    total_count, completed_count, failed_count, config_json,
    created_at, updated_at
FROM api_missions;

-- 3. 删除旧表
DROP TABLE api_missions;

-- 4. 重命名新表
ALTER TABLE api_missions_new RENAME TO api_missions;

-- 5. 重新创建索引
CREATE INDEX IF NOT EXISTS idx_api_missions_status ON api_missions(status);
CREATE INDEX IF NOT EXISTS idx_api_missions_type ON api_missions(task_type);
CREATE INDEX IF NOT EXISTS idx_api_missions_created ON api_missions(created_at);

COMMIT;

-- 验证迁移结果
SELECT '迁移完成！api_missions 表已移除 platform_strategy 和 platform_id 字段。' AS message;
SELECT COUNT(*) AS total_missions FROM api_missions;

-- 注: api_mission_items 表中的 platform_id, platform_task_id, platform_attempt 字段保持不变
-- 这些字段用于记录任务执行过程中的平台使用情况
