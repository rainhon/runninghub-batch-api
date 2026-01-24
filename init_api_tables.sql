-- API 任务管理系统数据库表初始化脚本
-- 创建时间: 2026-01-23

-- 创建 API 任务主表
DROP TABLE IF EXISTS api_missions;

CREATE TABLE IF NOT EXISTS api_missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(200) NOT NULL,                    -- 任务名称
    description TEXT,                               -- 任务描述
    task_type VARCHAR(50) NOT NULL,                -- 任务类型: text_to_image/image_to_image/text_to_video/image_to_video
    status VARCHAR(20) DEFAULT 'queued',           -- 状态: queued/running/completed/cancelled/failed
    total_count INTEGER NOT NULL,                   -- 总任务数
    completed_count INTEGER DEFAULT 0,              -- 已完成数
    failed_count INTEGER DEFAULT 0,                 -- 失败数
    config_json TEXT NOT NULL,                      -- 任务配置JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建 API 任务子项表
DROP TABLE IF EXISTS api_mission_items;

CREATE TABLE IF NOT EXISTS api_mission_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_mission_id INTEGER NOT NULL,               -- 关联API任务ID
    item_index INTEGER NOT NULL,                   -- 子任务序号（1,2,3...）
    input_params TEXT NOT NULL,                    -- 输入参数JSON
    status VARCHAR(20) DEFAULT 'pending',          -- 状态: pending/processing/completed/failed
    result_url TEXT,                                -- 结果文件URL
    error_message TEXT,                             -- 错误信息
    runninghub_task_id TEXT,                        -- RunningHub返回的任务ID
    retry_count INTEGER DEFAULT 0,                  -- 重试次数
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (api_mission_id) REFERENCES api_missions(id) ON DELETE CASCADE
);

-- 创建 API 任务模板表
DROP TABLE IF EXISTS api_templates;

CREATE TABLE IF NOT EXISTS api_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(200) NOT NULL,                    -- 模板名称
    description TEXT,                               -- 模板描述
    task_type VARCHAR(50) NOT NULL,                -- 任务类型
    config_json TEXT NOT NULL,                      -- 固定配置JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_api_missions_status ON api_missions(status);
CREATE INDEX IF NOT EXISTS idx_api_missions_type ON api_missions(task_type);
CREATE INDEX IF NOT EXISTS idx_api_missions_created ON api_missions(created_at);
CREATE INDEX IF NOT EXISTS idx_api_items_mission_id ON api_mission_items(api_mission_id);
CREATE INDEX IF NOT EXISTS idx_api_items_status ON api_mission_items(status);
CREATE INDEX IF NOT EXISTS idx_api_templates_type ON api_templates(task_type);
