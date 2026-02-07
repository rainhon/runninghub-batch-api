-- 添加 model_id 字段到 api_missions 表
-- 执行时间: 2026-02-07

-- 添加 model_id 字段
ALTER TABLE api_missions ADD COLUMN model_id VARCHAR(50);

-- 为现有数据设置默认值（可选，根据实际情况调整）
-- UPDATE api_missions SET model_id = 'sora' WHERE model_id IS NULL;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_api_missions_model_id ON api_missions(model_id);
