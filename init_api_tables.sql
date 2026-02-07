-- API 任务管理系统数据库表初始化脚本
-- 创建时间: 2026-01-23
-- 更新时间: 2026-02-07 (添加 model_id 字段)

-- 创建 API 任务主表
DROP TABLE IF EXISTS api_missions;

CREATE TABLE IF NOT EXISTS api_missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(200) NOT NULL,                    -- 任务名称
    description TEXT,                               -- 任务描述
    task_type VARCHAR(50) NOT NULL,                -- 任务类型: text_to_image/image_to_image/text_to_video/image_to_video/frame_to_video
    model_id VARCHAR(50),                           -- 模型 ID: sora/sorapro/banana/veo/veopro
    status VARCHAR(20) DEFAULT 'queued',           -- 状态: queued/running/completed/cancelled/failed/scheduled
    total_count INTEGER NOT NULL,                   -- 总任务数
    completed_count INTEGER DEFAULT 0,              -- 已完成数
    failed_count INTEGER DEFAULT 0,                 -- 失败数
    config_json TEXT NOT NULL,                      -- 任务配置JSON
    scheduled_time TIMESTAMP,                       -- 定时执行时间（中国时区 ISO 格式）
    started_at TIMESTAMP,                           -- 任务实际开始执行时间
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
    platform_id VARCHAR(50) DEFAULT 'runninghub',   -- 使用的平台ID
    platform_task_id TEXT,                          -- 平台任务ID（不同平台格式不同）
    retry_count INTEGER DEFAULT 0,                  -- 重试次数
    next_retry_at TIMESTAMP,                        -- 下次重试时间（中国时区 ISO 格式，指数退避）
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
CREATE INDEX IF NOT EXISTS idx_api_missions_model_id ON api_missions(model_id);
CREATE INDEX IF NOT EXISTS idx_api_missions_created ON api_missions(created_at);
CREATE INDEX IF NOT EXISTS idx_api_missions_scheduled_time ON api_missions(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_api_missions_status_scheduled ON api_missions(status, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_api_items_mission_id ON api_mission_items(api_mission_id);
CREATE INDEX IF NOT EXISTS idx_api_items_status ON api_mission_items(status);
CREATE INDEX IF NOT EXISTS idx_api_items_next_retry ON api_mission_items(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_api_items_status_retry ON api_mission_items(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_api_templates_type ON api_templates(task_type);
