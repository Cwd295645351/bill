# Contract: 记账归属人支持多名成员

本契约描述现有 `/api/v1` 接口上归属人字段的变化。路径、登录方式、响应外层结构（`retCode`、`message`、`data`）都不变。未列出的字段含义与今天一致。

## 字段替换（破坏性变更）

记账的归属人在接口上统一用 `belongUserIds: string[]` 表示，**旧字段 `belongUserId` 从所有记账相关的请求和响应中移除**：

| 位置 | 改动前 | 改动后 |
|------|--------|--------|
| 新增、编辑、批量新增的请求 | `belongUserId: string` | `belongUserIds: string[]` |
| 列表、导出的筛选条件 | `belongUserId: string \| string[]` | `belongUserIds: string[]` |
| 列表 `datas[]` 的每一项 | `belongUserId` | `belongUserIds` |
| 汇总 `belongUserCosts[]` 的每一项 | `belongUserId` | `belongUserIds` |

保留不变：

- `belongUserName`：全部为 `全部`，单人为名字，多人为「、」拼接的名字。
- 结算请求 `quantityInputs[].belongUserId`：表示数量规则扣到哪个人，不是记账的归属人，不在本次替换范围。

`belongUserIds` 的取值：「全部」为 `[]`，单人为 `[id]`，多人为按成员顺序排列的 id。「成员顺序」= 该账本 `bill_users.id` 升序。数据库里仍存在 `belong_user_id` 一列里，存法见 [data-model.md](../data-model.md)，对客户端不可见。

### 旧客户端的处理

写入接口（新增、编辑、批量新增）收到请求时：

- 请求体里出现 `belongUserId` 键、但没有 `belongUserIds`：拒绝，提示 `当前版本过旧，请更新后再记账`。不能把它当成「名单为空」，否则旧版本记的单人支出会被悄悄存成「全部」。
- 两个键都有：以 `belongUserIds` 为准，忽略 `belongUserId`。

列表、导出的筛选：请求里只有 `belongUserId` 时视为没有归属人条件，不报错（查询不会写坏数据）。

## 名单校验（新增、编辑、批量新增共用）

| 情形 | 支出 | 收入 |
|------|------|------|
| `belongUserIds` 缺省 | 拒绝：`归属人列表无效` | 同左 |
| `belongUserIds` 不是数组 | 拒绝：`归属人列表无效` | 同左 |
| `[]` | 保存为「全部」 | 拒绝：`收入只能选一名归属人` |
| 1 人 | 单人 | 单人 |
| 2 人及以上 | 多人 | 拒绝：`收入只能选一名归属人` |
| 名单有重复 | 拒绝：`归属人不能重复` | 同左 |
| 名单中有人不是该账本成员 | 拒绝：`归属人不是该账本成员` | 同左 |
| 拼接后 id 串超过 1024 字符或名字串超过 2048 字符 | 拒绝：`归属人过多` | 不会发生（只有 1 人） |

拒绝时的响应与现有业务错误相同：`retCode` 非 0，`message` 为上表文案，不写入任何数据。服务端保存前按成员顺序重新排列名单，客户端传入的顺序不影响结果。

## POST /api/v1/transaction（新增）

```json
{
  "type": 1,
  "belongUserIds": ["用户 id 甲", "用户 id 乙"]
}
```

`belongUserIds` 必填。成功响应不变。

## PUT /api/v1/transaction（编辑）

`belongUserIds` 必填，规则同上。

- 电脑端、小程序编辑时总是提交完整名单。
- 只改金额等其它字段、名单与原来相同，保存后名单不变。
- 「只能编辑自己记的账单」的校验先于名单校验，不变。

## POST /api/v1/transaction/batch（批量新增）

列表中每一项都必须带 `belongUserIds`，规则同上。任一项校验失败时整批拒绝，`message` 前加 `第 N 条：`。电脑端批量解析的表格仍是单选，提交时转成 `[]` 或 `[id]`。

## POST /api/v1/transaction/list（列表、搜索）

### 请求

| `belongUserIds` | 返回 |
|-----------------|------|
| 缺省或 `[]` | 不限归属人（电脑端和小程序界面上的「全部」） |
| `[成员 id]` | 归属该成员的单人记账，以及名单包含该成员的多人记账 |
| `[成员 id, '']` | 上一行的结果，再加上归属「全部」的记账（电脑端概览类型明细使用） |

数组中可以有多个成员 id，结果取并集。名单只包含**其他**成员的多人记账不会返回。

### 响应

`datas` 里每一项：

```json
{
  "belongUserIds": ["用户 id 甲", "用户 id 乙"],
  "belongUserName": "甲、乙"
}
```

不再返回 `belongUserId`。`monthSummaries`、`total`、游标字段的计算口径跟随新的筛选条件，字段不变。

## POST /api/v1/transaction/export（导出）

筛选条件改为 `belongUserIds`，规则与 `/list` 相同。「归属人」列对多人记账输出「甲、乙」。

## GET /api/v1/transaction/currentMonthCost、GET /api/v1/overview/balance（汇总）

- `totalCost`、`totalIncomes`、`investCost` 不变。
- `belongUserCosts[]`：每项的 `belongUserId` 换成 `belongUserIds`。分组仍是「归属人 + 记账人 + 收支类型」，不同的多人组合各自成项，多人项的 `belongUserName` 为拼接名。
- `costTypeRank` 不变（按名字分组，多人记账的键为拼接名）。

## POST /api/v1/overview/settlement（结算）

请求不变（`quantityInputs[].belongUserId` 保留，见上文）。响应字段不变，以下数值的算法变化：

- `members[].borne`、`members[].net`、`transfers`、`lines`：包含多人归属支出的分摊，算法见 [research.md](../research.md) 第 6 节。
- `members[].effectiveIncome`：包含指定支出类型规则对多人归属支出的平均扣减。
- `pies.members[].slices`：包含该成员在多人归属支出中分到的份额，不包含名单里没有他的多人支出。
- `pies.all` 不变：仍是全部支出按类型的原金额。

账本中没有多人归属支出时，响应与本功能上线前完全相同（FR-008）。

## 明确不变

- `GET /api/v1/overview/threeYearCost`。
- 导入 Excel（`POST /api/v1/transaction/const`）：服务端内部处理，只导入支出，归属人按名字匹配单人，匹配不到为「全部」。
- 照片相关接口。

## 对各端的影响

| 端 | 影响 |
|----|------|
| 电脑端 | 本次同步改为 `belongUserIds`，与服务端一起发布 |
| 小程序 | 本次同步改为 `belongUserIds`，并接入 `wx.getUpdateManager` 强制更新。服务端发布后、用户更新前，旧版本记账会被拒绝并提示更新 |
| 手机网页 | 不改。上线后新增、编辑记账都会被拒绝，提示「当前版本过旧」；查看流水不受影响，但读不到归属人 id；按归属人搜索时条件被忽略。规格 FR-018 已接受这些后果，手机网页后续下线 |
| 回滚 | 小程序新版本发布后，服务端回滚必须和小程序版本回退一起做（规格 FR-022） |
