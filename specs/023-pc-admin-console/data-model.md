# 数据模型：PC 运营后台

**功能分支**: `023-pc-admin-console` | **日期**: 2026-11-18

## 实体

### 用户（既有 `users`，增量）

| 字段 | 说明 |
|------|------|
| id / username / nick_name / … | 既有 |
| incomes / expenses | 记账人累计；后台用户行直接读 |
| is_del | 软删；列表默认排除 |
| created_at | **新增，可空**；注册时写入；旧行为空 |

关系：`user_wechats` 一对一绑定；`bill_users` 多账本成员。

### 账本（既有 `bills`，增量）

| 字段 | 说明 |
|------|------|
| id / name / creator / is_del / … | 既有 |
| created_at | **新增，可空**；创建时写入；旧行为空 |

关系：`bill_users` 成员；`transactions` 流水（金额统计仅 `is_del = false`）。

### AI 调用审计（新表 `ai_call_audits`）

| 字段 | 类型意向 | 说明 |
|------|----------|------|
| id | CHAR(36) PK | UUID |
| user_id | CHAR(36) | 发起用户 |
| bill_id | CHAR(36) NOT NULL | 必填；与入口必填账本一致 |
| capability | VARCHAR(64) | 如 `parse-batch` |
| upstream_requested | BOOLEAN | 是否请求上游 |
| outcome | VARCHAR(16) | `success` / `error` |
| error_category | VARCHAR(64) | 与现网错误类一致；成功为 `none` |
| duration_ms | INT | 耗时 |
| prompt_tokens | INT NULL | 从 usage 提取 |
| completion_tokens | INT NULL | 从 usage 提取 |
| total_tokens | INT NULL | 从 usage 提取；皆无则空 |
| daily_count | INT NULL | 当日序号 |
| created_at | DATETIME | 调用写入时间（趋势按此） |

索引建议：`(created_at)`、`(user_id, created_at)`、`(bill_id, created_at)`、`(outcome, created_at)`。

**写入规则**: 仅对已通过「账本必填 + 成员校验」的调用插入；插入时 `user_id`、`bill_id` 均非空。缺账本在路由层已拒绝，正常路径不应再出现无账本入库尝试。

**脱敏**: 不得存密钥、prompt、响应正文。`usage` 原始 JSON 可不整存，只存三个 token 整数。

### 默认类型模板（新表 `catalog_defaults`）

| 字段 | 类型意向 | 说明 |
|------|----------|------|
| kind | VARCHAR(16) | `cost` / `income` / `pay_method` |
| id | VARCHAR(32) | 类型编号，同类内唯一 |
| name | VARCHAR(64) | 显示名 |
| is_del | BOOLEAN | 软删；默认列表排除 |

主键：`(kind, id)`。

校验：

- 同类未删除名称唯一
- 每类至少保留 1 条 `is_del = false`
- 新 id = 同类（含已删除）最大数字 id + 1；段位延续 1xxx / 2xxx / 3xxx
- 已删除不可恢复、不可改名
- 新建账本只复制三类中 `is_del = false` 的行

### 运营管理员（配置实体，无表）

由环境变量 `ADMIN_USERNAME` 指向某一个 `users.username`。无角色列。

## 派生视图（非表）

### 用户汇总行

用户名、昵称、是否存在微信绑定、创建时间、加入账本数、incomes、expenses、is_del。

### 账本汇总行

名称、创建者（id + 展示用昵称/用户名）、成员数、未删除流水笔数、支出合计（`type = 1`）、收入合计（非支出）、创建时间、is_del。

### 总览指标

存量：未删除用户/账本数、微信绑定数、未删除流水笔数与全局收支合计。  
窗口（7/30，东八区）：按日记账笔数与金额、按日 AI 次数/成功数/token、窗口内新建用户/账本数（仅 `created_at` 非空）。  
成功率：`successCount / totalAudits`；`totalAudits = 0` 时 `successRate = null`（界面「不适用」）。账本汇总创建者展示名：优先昵称，缺省用户名。

## 状态流转

### 默认类型

```text
[未删除] --软删--> [已删除]（只读可见，不可恢复、不可改名）
[未删除] --改名--> [未删除]（名称唯一校验）
[空模板同类] --新增--> [未删除]（分配新编号）
```

### AI 审计

```text
[parse-batch]
    --> 无 billId：拒绝（不打上游、不计次；可打控制台审计，不入库）
    --> 非成员：拒绝（同现网 forbidden_bill）
    --> 通过后的应审计调用
           --> 写控制台 [ai-audit]
           --> 插入 ai_call_audits（bill_id NOT NULL）
（插入失败不影响业务响应）
```

## 与现网关系

- 不改流水落库、账本成员权限、AI Redis 日额度算法。
- 账本内 `bill_cost_types` 等仍按账本隔离；模板与账本内类型无外键联动。
- `initDatas.ts` 仅作空表种子，运行时真相为 `catalog_defaults`。
