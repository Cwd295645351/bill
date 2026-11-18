# 契约：运营后台 API 与登录扩展

**基础路径**: `/api/v1`  
**响应形状**: `{ retCode, message, data }`；成功 `retCode === 0`，失败非 0。  
**管理鉴权**: 须已登录；服务端用 `ADMIN_USERNAME` 判定。失败 `message` 为「未配置管理员」或「非管理员没有权限」，`data` 为 `null`。  
**改动端**: 后端新增管理前缀；登录响应增量字段；PC 消费。H5/小程序不调用。

## 登录响应扩展（兼容）

既有密码登录 / 微信登录成功体中的用户信息增加：

| 字段 | 类型 | 说明 |
|------|------|------|
| isAdmin | boolean | 当前用户是否为环境变量指定管理员 |

不得返回 `ADMIN_USERNAME` 字符串本身。未配置管理员时所有人 `isAdmin === false`。

## 公共查询参数

| 参数 | 说明 |
|------|------|
| page | 从 1 起，默认 1 |
| pageSize | 默认 20，上限 100 |
| keyword | 可选；空则不筛 |
| includeDeleted | 可选；默认 `false` |
| range | 总览用：`7` 或 `30`（东八区近 N 日） |

分页 `data` 形状：`{ list, total, page, pageSize }`。

---

## `GET /api/v1/admin/overview`

| 参数 | 必填 | 说明 |
|------|------|------|
| range | 否 | `7`（默认）或 `30` |

**成功 data（字段名可微调，语义固定）**:

- 存量：`userCount`、`billCount`、`wechatBindCount`、`transactionCount`、`expenseSum`、`incomeSum`（均未删除口径）
- 窗口：`newUserCount`、`newBillCount`（仅有创建时间且落在窗口）
- 记账趋势：按东八区日的 `[{ date, count, expenseSum, incomeSum }]`
- AI：`aiTotal`、`aiSuccess`、`successRate`（无审计时必须为 `null`，前端显示「不适用」）、`promptTokens`/`completionTokens`/`totalTokens` 合计、按日 `[{ date, total, success, totalTokens }]`

---

## `GET /api/v1/admin/users`

| 参数 | 说明 |
|------|------|
| keyword | 匹配 username 或 nickName |
| includeDeleted | 默认 false |
| page / pageSize | 分页 |

列表项：`id`、`username`、`nickName`、`wechatBound`、`createdAt`（可 null）、`billCount`、`incomes`、`expenses`、`isDel`。

## `GET /api/v1/admin/users/:id`

详情：用户汇总字段 + `bills: [{ id, name, isCreator }]` + `recentAi: [审计摘要至多 20 条]`。  
用户不存在：失败说明可读，无其它用户数据。

---

## `GET /api/v1/admin/bills`

| 参数 | 说明 |
|------|------|
| keyword | 匹配账本 name |
| includeDeleted | 默认 false |
| page / pageSize | 分页 |

列表项：`id`、`name`、`creatorId`、`creatorName`（优先昵称，缺省回退用户名）、`memberCount`、`transactionCount`、`expenseSum`、`incomeSum`、`createdAt`、`isDel`。

## `GET /api/v1/admin/bills/:id`

详情：账本汇总 + `members: [{ userId, userName }]`。  
不得返回流水明细数组。

---

## `GET /api/v1/admin/ai-audits`

| 参数 | 说明 |
|------|------|
| keyword | 匹配发起用户 username / nickName |
| outcome | 可选 `success` / `error` |
| page / pageSize | 分页；按 `createdAt` 倒序 |

列表项：`id`、`createdAt`、`userId`、`userName`、`billId`（必填）、`billName`、`capability`、`outcome`、`errorCategory`、`durationMs`、`promptTokens`、`completionTokens`、`totalTokens`、`dailyCount`、`upstreamRequested`。  
不得含 prompt / 响应正文 / 密钥。列表中不出现无 `billId` 的行。

---

## 默认类型

### `GET /api/v1/admin/catalog-defaults`

| 参数 | 说明 |
|------|------|
| kind | 可选：`cost` / `income` / `pay_method`；缺省三类都返回 |
| includeDeleted | 默认 false |

### `POST /api/v1/admin/catalog-defaults`

Body：`{ kind, name }`。分配新 id；名称冲突或校验失败则错误。

### `PUT /api/v1/admin/catalog-defaults/:kind/:id`

Body：`{ name }`。仅未删除项可改；已删除返回错误。

### `POST /api/v1/admin/catalog-defaults/:kind/:id/delete`

软删。最后一项未删除时拒绝（「至少保留一项」类说明）。已删除再删可幂等成功或明确已删除。

**明确不做**: 恢复接口、排序接口、概览规则管理、改 AI 日额度、封禁用户、删账本。

---

## 新建账本行为变更（既有路径）

`POST` 既有建账接口成功路径改为复制 `catalog_defaults` 中未删除三类模板。  
任一类未删除为空：建账失败，可读说明，不创建半成品账本。  
成功响应形状与现网一致。

## `POST /api/v1/ai/parse-batch` 行为收紧（本期批准）

相对 021：请求体 `billId` 由可选改为**必填**。

| 情况 | 行为 |
|------|------|
| 缺省 / 空串 | 业务错误（可读说明如「请选择账本」）；不打上游；不计日额度；可不入库 |
| 有 `billId` 但非成员 | 与现网一致：`forbidden_bill` 类说明；不打上游；不计次 |
| 校验通过 | 后续编排不变：未配置 → 日额度 → 上游 → 审计（日志 + 入库） |

成功时 `data` 数组字段**不得删除或改名**。PC 继续传当前账本；其他客户端若调用本接口必须补传。

## AI 审计写入（内部行为）

每次通过账本校验后的应审计调用：先打 `[ai-audit]`，再写入 `ai_call_audits`（`bill_id` NOT NULL）。  
持久化失败不得改变 `parse-batch` 对外成功/失败结果。

## 明确不改

| 项 | 说明 |
|----|------|
| `/api/v1/ai/parse-batch` 成功 `data` 形状 | 不变 |
| Redis 日额度 Key 与算法 | 不变（仅「缺账本」路径仍不计次） |
| H5 / 小程序 | 不新增管理调用；若调用解析则须带 `billId` |
