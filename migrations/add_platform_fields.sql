-- 多平台支持数据库迁移脚本（最小化修改）
-- 版本: 2.0
-- 日期: 2026-02-02
-- 说明: 添加平台记录字段到现有表

-- ============================================
-- 修改 api_missions 表
-- ============================================

-- 添加平台策略字段
ALTER TABLE api_missions ADD COLUMN platform_strategy TEXT DEFAULT 'specified';

-- 添加用户指定的平台 ID
ALTER TABLE api_missions ADD COLUMN platform_id TEXT;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_api_missions_platform ON api_missions(platform_id);
CREATE INDEX IF NOT EXISTS idx_api_missions_strategy ON api_missions(platform_strategy);

-- ============================================
-- 修改 api_mission_items 表
-- ============================================

-- 添加实际使用的平台
ALTER TABLE api_mission_items ADD COLUMN platform_id TEXT;

-- 添加平台任务ID（不同平台的任务ID格式不同）
ALTER TABLE api_mission_items ADD COLUMN platform_task_id TEXT;

-- 添加已尝试的平台列表 JSON（用于故障转移）
ALTER TABLE api_mission_items ADD COLUMN platform_attempt TEXT;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_api_mission_items_platform ON api_mission_items(platform_id);
CREATE INDEX IF NOT EXISTS idx_api_mission_items_platform_task ON api_mission_items(platform_task_id);

-- ============================================
-- 验证表结构
-- ============================================

-- 查看 api_missions 表结构
.schema api_missions

-- 查看 api_mission_items 表结构
.schema api_mission_items

-- ============================================
-- 迁移完成
-- ============================================

SELECT '=== Migration Completed ===' as info;
SELECT 'Added platform fields to api_missions and api_mission_items' as info;
