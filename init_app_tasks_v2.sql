-- App 任务管理系统 V2.0 - 批量输入模式
-- 参考 API 任务命名规范
-- 创建时间: 2026-01-24

-- ============================================
-- 1. App 任务主表 (app_missions)
-- ============================================

DROP TABLE IF EXISTS app_missions;

CREATE TABLE IF NOT EXISTS app_missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,                    -- 任务名称
    description TEXT,                       -- 任务描述
    app_id TEXT NOT NULL,                   -- App ID (RunningHub AI 应用的 ID)
    status TEXT NOT NULL DEFAULT 'queued',  -- 状态: queued/running/completed/failed/cancelled
    total_count INTEGER NOT NULL,           -- 子任务总数
    completed_count INTEGER DEFAULT 0,      -- 已完成数
    failed_count INTEGER DEFAULT 0,         -- 失败数
    config_json TEXT NOT NULL,              -- 固定配置 JSON（所有子任务共享）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. App 任务子项表 (app_mission_items)
-- ============================================

DROP TABLE IF EXISTS app_mission_items;

CREATE TABLE IF NOT EXISTS app_mission_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_mission_id INTEGER NOT NULL,        -- 关联 App 任务 ID
    item_index INTEGER NOT NULL,            -- 子任务序号（1,2,3...）
    input_params TEXT NOT NULL,             -- 输入参数 JSON（完整参数：config_json + batch_input[i]）
    status TEXT NOT NULL DEFAULT 'pending', -- 状态: pending/processing/completed/failed
    result_url TEXT,                        -- 结果文件 URL
    result_path TEXT,                       -- 结果文件本地路径
    error_message TEXT,                     -- 错误信息
    runninghub_task_id TEXT,                -- RunningHub 返回的任务 ID
    retry_count INTEGER DEFAULT 0,          -- 重试次数
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (app_mission_id) REFERENCES app_missions(id) ON DELETE CASCADE
);

-- ============================================
-- 3. App 任务模板表 (app_templates)
-- ============================================

DROP TABLE IF EXISTS app_templates;

CREATE TABLE IF NOT EXISTS app_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,                     -- 模板名称
    description TEXT,                       -- 模板描述
    app_id TEXT NOT NULL,                   -- App ID
    config_json TEXT NOT NULL,              -- 固定配置 JSON
    batch_input_template TEXT,              -- 批量输入模板（JSON 数组，可选）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 4. 媒体文件表 (media_files) - 保持不变
-- ============================================

DROP TABLE IF EXISTS media_files;

CREATE TABLE IF NOT EXISTS media_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_hash TEXT NOT NULL UNIQUE,         -- SHA256 哈希值，用于去重
    original_name TEXT NOT NULL,            -- 原始文件名
    file_path TEXT NOT NULL,                -- 本地存储路径
    file_size INTEGER NOT NULL,             -- 文件大小（字节）
    runninghub_filename TEXT,               -- RunningHub 返回的文件名
    mime_type TEXT,                         -- 文件 MIME 类型
    upload_count INTEGER DEFAULT 1,         -- 被使用次数
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 5. 创建索引
-- ============================================

-- app_missions 表索引
CREATE INDEX IF NOT EXISTS idx_app_missions_app_id ON app_missions(app_id);
CREATE INDEX IF NOT EXISTS idx_app_missions_status ON app_missions(status);
CREATE INDEX IF NOT EXISTS idx_app_missions_created ON app_missions(created_at);

-- app_mission_items 表索引
CREATE INDEX IF NOT EXISTS idx_app_items_mission_id ON app_mission_items(app_mission_id);
CREATE INDEX IF NOT EXISTS idx_app_items_status ON app_mission_items(status);
CREATE INDEX IF NOT EXISTS idx_app_items_index ON app_mission_items(item_index);

-- app_templates 表索引
CREATE INDEX IF NOT EXISTS idx_app_templates_app_id ON app_templates(app_id);

-- media_files 表索引
CREATE INDEX IF NOT EXISTS idx_media_files_hash ON media_files(file_hash);
