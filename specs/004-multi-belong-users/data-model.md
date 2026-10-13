# Data Model: 支出归属人支持多选

## 1. 记账明细 `transactions`（加宽两列）

不新建表，不新增列，只加宽两列：

| 字段 | 改动前 | 改动后 | 是否可空 |
|------|--------|--------|----------|
| `belong_user_id` | `VARCHAR(36)` | `VARCHAR(1024)` | 可空，与今天相同 |
| `belong_user_name` | `VARCHAR(64)` | `VARCHAR(2048)` | 可空，与今天相同 |

`server/database/models/index.js` 中对应改为 `DataTypes.STRING(1024)` 和 `DataTypes.STRING(2048)`。

三种归属的写法：

| 归属 | `belong_user_id` | `belong_user_name` |
|------|------------------|--------------------|
| 全部（仅支出） | `''` | `全部` |
| 单人 | 成员的用户 id | 成员名 |
| 多人（仅支出，2 人及以上） | 按成员顺序用英文逗号拼接的用户 id，例如 `id甲,id乙` | 按同一顺序用「、」拼接的成员名，例如 `甲、乙` |

### 判断与拆分

全部集中在 `server/database/services/belongUsers.js`，其他地方都从这里引用：

- `BELONG_ID_SEPARATOR = ','`，`BELONG_NAME_SEPARATOR = '、'`。
- `isMultiBelong(belongUserId)`：值中含逗号。
- `splitBelongIds(belongUserId)`：空串返回 `[]`，否则按逗号拆开。

### 校验规则

- 收入只能是「单人」这一行，服务端拒绝其余两种写法。
- 多人名单不重复，至少 2 人，且每人在保存时都是该账本 `bill_users` 中的成员。之后成员离开账本不回写。
- 名单按 `bill_users.id` 升序排列后再拼接。同一组人不论勾选先后，存出来的串都相同，可以直接作为分账时的分组键。
- 拼接后 `belong_user_id` 不超过 1024 字符、`belong_user_name` 不超过 2048 字符，否则拒绝，提示「归属人过多」（约 27 人以上才会触发）。
- 名字是保存时的成员名快照，与今天单人归属的行为一致；成员改名后不回写。

### 生命周期

| 操作 | 两列的变化 |
|------|------------|
| 新增 | 按解析后的名单写入 |
| 编辑并改了归属人 | 按新名单整体覆盖 |
| 编辑但没改归属人 | 客户端提交原来的 `belongUserIds`，写回的值与原来相同 |
| 删除（软删） | 不变 |

## 2. 接口里的归属人形状

数据库列 `belong_user_id` 和 Sequelize 属性 `belongUserId` 的名字都不变，但只在服务端内部使用。接口的请求和响应里只出现：

```text
belongUserIds: string[]   // 由 belong_user_id 拆出：全部 = []，单人 = [id]，多人 = 按成员顺序的 id 列表
belongUserName: string    // 原字段：全部 = '全部'，单人 = 名字，多人 = 「、」拼接
```

`belongUserId` 不再出现在记账相关的请求和响应里。服务端在两个地方转换：

- **写入**：`belongUserIds` 经过校验、按成员顺序排序后，拼接成 `belong_user_id` 和 `belong_user_name`。
- **读出**：列表、导出、汇总在组装响应时，把 `belongUserId` 拆成 `belongUserIds` 并删掉原属性。

规则见 [contracts/transaction-belong-users.md](./contracts/transaction-belong-users.md)。

## 3. 分账中的「归属人组合」（只在计算中存在，不落库）

| 属性 | 说明 |
|------|------|
| `key` | 记账的 `belong_user_id` 逗号串本身 |
| `memberIds` | `splitBelongIds(key)`，已是成员顺序 |
| `totalCents` | 区间内这一组所有支出的金额合计（分），不论谁付款 |
| `rows` | 这一组的每笔记账，用于按类型拆开支出结构 |

计算规则：

- 每组用组内成员的权重 `max(有效收入, 0)` 对 `totalCents` 分一次。组内权重全为 0 时每人权重 1。
- 支出结构中逐笔的份额用 `reconcileToTarget` 对齐到整组的结果，保证每人各类型之和等于他在这一组分到的金额。
- 指定支出类型规则：对该类型的每一组，先汇总，再在组内平均分（权重全为 1），从各人有效收入里扣减。这一步在计算权重之前完成。

## 4. 小程序本地缓存 `RecordPref`

```text
belongUserIds: string[]     // 新：上次记账的名单
belongUserName: string      // 原字段
```

写入时不再保存 `belongUserId`。读取时如果只有旧版本写入的 `belongUserId`，就转成 `[]` 或 `[id]` 使用，下次保存时按新格式覆盖。

## 5. 线上升级脚本

文件：`deploy/sql/004-multi-belong-users-upgrade.sql`。执行前先备份 `transactions`；执行后再发布新代码。

```sql
-- 004 支出归属人支持多选：加宽归属人两列，不改数据，可重复执行
ALTER TABLE transactions
  MODIFY COLUMN belong_user_id VARCHAR(1024) NULL,
  MODIFY COLUMN belong_user_name VARCHAR(2048) NULL;
```

执行前用 `SHOW CREATE TABLE transactions;` 核对这两列当前的字符集和排序规则。如果它们与表默认值不同，要在 `MODIFY COLUMN` 中写明原来的 `CHARACTER SET` 和 `COLLATE`，避免被改成表默认值。

执行后核对：

```sql
SELECT COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions'
  AND COLUMN_NAME IN ('belong_user_id', 'belong_user_name');
```

预期分别是 1024、2048，且都可空。

## 6. 回滚脚本

文件：`deploy/sql/004-multi-belong-users-rollback.sql`。先回退代码，再执行。

```sql
-- 004 回滚：多人归属降级为「全部」，再把两列改回原长度
UPDATE transactions
SET belong_user_id = '', belong_user_name = '全部'
WHERE belong_user_id LIKE '%,%';

ALTER TABLE transactions
  MODIFY COLUMN belong_user_id VARCHAR(36) NULL,
  MODIFY COLUMN belong_user_name VARCHAR(64) NULL;
```

- 降级后，这些记账在分账里会变成按全员比例分摊。执行前应导出 `belong_user_id LIKE '%,%'` 的行（`id`、`belong_user_id`、`belong_user_name`），以备之后重新上线时恢复。
- 第二条 `ALTER` 执行前，确认 `belong_user_name` 中没有超过 64 字的值（第一条 `UPDATE` 之后，只有多人行才可能超长）。
