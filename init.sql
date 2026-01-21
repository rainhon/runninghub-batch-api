-- 更新 missions 任务表（添加 task_id、status_code、repeat_count 和 error_message）
DROP TABLE IF EXISTS missions;

CREATE TABLE IF NOT EXISTS missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    status_code INTEGER DEFAULT 813,
    task_id TEXT,
    repeat_count INTEGER DEFAULT 1,
    current_repeat INTEGER DEFAULT 0,
    error_message TEXT,  -- 失败原因
    nodes_list TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建 results 产出表（记录每次重复执行的成功/失败）
DROP TABLE IF EXISTS results;

CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mission_id INTEGER NOT NULL,
    repeat_index INTEGER NOT NULL,  -- 第几次重复执行（1, 2, 3...）
    status TEXT NOT NULL,  -- 'success' 或 'failed'
    runninghub_task_id TEXT,  -- RunningHub 返回的任务ID（用于重启后继续查询）
    retries INTEGER DEFAULT 0,  -- 重试次数
    error_message TEXT,  -- 失败原因
    file_path TEXT,  -- 成功时的文件路径
    file_url TEXT,  -- 成功时的结果文件 URL
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE
);

-- 创建 media_files 媒体文件表（支持去重）
DROP TABLE IF EXISTS media_files;

CREATE TABLE IF NOT EXISTS media_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_hash TEXT NOT NULL UNIQUE,  -- SHA256 哈希值，用于去重
    original_name TEXT NOT NULL,  -- 原始文件名
    file_path TEXT NOT NULL,  -- 本地存储路径
    file_size INTEGER NOT NULL,  -- 文件大小（字节）
    runninghub_filename TEXT,  -- RunningHub 返回的文件名
    mime_type TEXT,  -- 文件 MIME 类型
    upload_count INTEGER DEFAULT 1,  -- 被使用次数
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建 task_templates 任务模板表
DROP TABLE IF EXISTS task_templates;

CREATE TABLE IF NOT EXISTS task_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    app_id TEXT NOT NULL,
    nodes_list TEXT NOT NULL,  -- JSON 格式的节点配置
    repeat_count INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建 task_media_rel 任务与媒体文件关联表
DROP TABLE IF EXISTS task_media_rel;

CREATE TABLE IF NOT EXISTS task_media_rel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    media_file_id INTEGER NOT NULL,
    node_id TEXT NOT NULL,  -- 对应的 nodeId
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES missions(id) ON DELETE CASCADE,
    FOREIGN KEY (media_file_id) REFERENCES media_files(id) ON DELETE CASCADE,
    UNIQUE(task_id, node_id)  -- 每个任务的每个节点只能关联一个媒体文件
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_media_files_hash ON media_files(file_hash);
CREATE INDEX IF NOT EXISTS idx_task_media_rel_task ON task_media_rel(task_id);
CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);

