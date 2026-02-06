-- ============================================
-- 定时执行功能数据库迁移脚本
-- 版本: 3.0
-- 日期: 2026-02-06
-- 说明: 添加定时执行相关字段
-- ============================================

-- 修改 api_missions 表，添加定时执行字段
ALTER TABLE api_missions ADD COLUMN scheduled_time TIMESTAMP;
ALTER TABLE api_missions ADD COLUMN started_at TIMESTAMP;

-- 创建索引以优化定时任务查询性能
CREATE INDEX IF NOT EXISTS idx_api_missions_scheduled_time ON api_missions(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_api_missions_status_scheduled ON api_missions(status, scheduled_time);

-- 验证表结构
.schema api_missions

-- 迁移完成
SELECT '=== Migration Completed ===' as info;
SELECT 'Added scheduled execution fields to api_missions' as info;
