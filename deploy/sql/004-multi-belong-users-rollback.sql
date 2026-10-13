-- 004 回滚：多人归属降级为「全部」，再把两列改回原长度。
-- 先回退代码，再执行本脚本。小程序新版本已发布时，服务端回滚必须同时把小程序回退到旧版本。
-- 降级后这些记账在分账里会按全员比例分摊。执行前先导出多人归属的行，以备之后重新上线时恢复：
--   SELECT id, belong_user_id, belong_user_name FROM transactions WHERE belong_user_id LIKE '%,%';

UPDATE transactions
SET belong_user_id = '', belong_user_name = '全部'
WHERE belong_user_id LIKE '%,%';

-- 改回原长度前核对：结果必须为 0，否则下面的 ALTER 会截断或失败
SELECT COUNT(*) AS too_long
FROM transactions
WHERE CHAR_LENGTH(belong_user_name) > 64 OR CHAR_LENGTH(belong_user_id) > 36;

ALTER TABLE transactions
  MODIFY COLUMN belong_user_id VARCHAR(36) NULL,
  MODIFY COLUMN belong_user_name VARCHAR(64) NULL;
