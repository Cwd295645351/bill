-- 004 支出归属人支持多选：加宽归属人两列。
-- 只加宽、不改数据，可以重复执行。
-- 执行前：
--   1. 备份 transactions 表。
--   2. 执行 SHOW CREATE TABLE transactions; 核对 belong_user_id、belong_user_name 的字符集和排序规则。
--      如果与表默认值不同，要在下面的 MODIFY COLUMN 中写明原来的 CHARACTER SET 和 COLLATE，避免被改成表默认值。
-- 执行后再发布新版服务端。

ALTER TABLE transactions
  MODIFY COLUMN belong_user_id VARCHAR(1024) NULL,
  MODIFY COLUMN belong_user_name VARCHAR(2048) NULL;

-- 核对：预期 belong_user_id 为 1024、belong_user_name 为 2048，且都可空（IS_NULLABLE = YES）
SELECT COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions'
  AND COLUMN_NAME IN ('belong_user_id', 'belong_user_name');
