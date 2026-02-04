-- 移除 platform_attempt 字段迁移脚本
-- 创建时间: 2026-02-04
-- 说明: 平台切换逻辑已移至消费者队列，不再需要 tracking platform_attempt

-- 移除 api_mission_items 表中的 platform_attempt 字段
ALTER TABLE api_mission_items DROP COLUMN IF EXISTS platform_attempt;

-- 验证迁移结果
SELECT
    'api_mission_items' AS table_name,
    COUNT(*) AS total_items,
    COUNT(CASE WHEN platform_id IS NOT NULL THEN 1 END) AS items_with_platform,
    COUNT(CASE WHEN platform_task_id IS NOT NULL THEN 1 END) AS items_with_task_id
FROM api_mission_items;
