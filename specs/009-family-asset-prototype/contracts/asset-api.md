# Contract: 按原型补齐家庭资产

电脑网页进入账本后使用。微信小程序不调用。前缀保持 `/api/v1/asset`。登录方式和成员检查与现有资产接口相同：不是该账本成员时失败，文案说明无权查看该账本，响应不带数据。

已有路径见 `specs/007-family-asset/contracts/asset-api.md`。本文件只写这次新增和加可选参数的部分。未提到的字段保持原样。

金额在请求里按资产币种理解。统计响应里的合计、变化和图表金额是人民币，并另给原币字段，避免把两种单位混在一个数里。

## 汇率

### GET /api/v1/asset/exchange-rate?billId=

返回 `{ hkdRate, usdRate, saved }`。尚未保存时 `saved` 为假，两个汇率仍是大于 0 的初始值。

### PUT /api/v1/asset/exchange-rate

正文：`billId`、`hkdRate`、`usdRate`。任一不是大于 0 的数字时失败，文案说明汇率必须大于 0，已保存的值不变。成功后该账本之后的折算都用新值。

## 资产与盘点

### POST /api/v1/asset

增加可选 `currency`，缺省 `CNY`。不是三种币种之一时失败。`latestAmount` 按该币种填写，必须大于 0。类型为负债时不保存四笔钱。

### PUT /api/v1/asset

正文里的 `currency` 若与库中不同，失败，文案说明要换币种需删除后重新登记。只改四笔钱、名称、成员或保险信息时不新增盘点。从保险改走时清空险种和年交保费。改成负债时清空四笔钱、险种和年交保费。年交保费若填写，必须不小于 0。

### GET /api/v1/asset/records?assetId=&page=&pageSize=

`page` 与 `pageSize` 都可选。传入时按日期从新到旧返回 `{ list, total, page, pageSize }`，`pageSize` 缺省为 10。不传时仍返回该资产全部未删除盘点。每条金额是原币。

### POST /api/v1/asset/record 与 PUT /api/v1/asset/record

金额必须大于 0，日期必填。否则失败并说明原因，不写入。

## 总览与图表

### GET /api/v1/asset/overview?billId=&memberId=&asOf=

`asOf` 可选，格式 `YYYY-MM-DD`。传入时，每笔资产的截至金额是该日及以前最新一条原币盘点乘当前汇率；该日及以前没有盘点则为 0。不传时，合计仍用当前金额。

响应在原有人民币合计之外增加：

| 字段 | 含义 |
|------|------|
| `defaultAsOf` | 上一个盘点日。没有则为空字符串 |
| `earliestRecordMonth` | 当前筛选下最早有盘点的 `YYYY-MM`。没有则为空 |
| `hkdRate`、`usdRate` | 本次折算使用的汇率 |
| 每笔资产的 `currency`、`rawAmount` | 原币。人民币资产仍返回币种，页面自己决定不显示附注 |

总资产变化只比较非负债。固定资产始终计入。接口不接受「排除固定资产」。

`/four-money`、`/sankey`、`/monthly-report` 的金额同样改为人民币，并在需要标出原币的明细上带 `currency` 与 `rawAmount`。分类名和「负债只在桑基左侧」保持 007 的契约。月历没有盘点的月份仍是 `null`。

## 年度对账

### POST /api/v1/asset/ledger

正文：

| 字段 | 规则 |
|------|------|
| `billId` | 必填 |
| `year` | 四位年份。当年统计到本月，已结束的年份统计到 12 月 |
| `memberId` | 可空。空表示全部资产成员 |
| `quantityInputs` | 与概览结算相同：`{ ruleId, quantity, belongUserId }`。数量不能为负。只对已启用的数量规则生效 |

响应给出人民币的 `income`、`expense`、`surplus`、`assetChange`、`netChange`、`diff`、期初说明、是否相等，以及单人时的 `exclusive`、`sharedShare`、`publicShare` 和各记账成员的 `effectiveIncome`。没有同名记账成员时 `income` 与 `expense` 为 0，并带说明。没有盘点时 `assetChange` 与 `diff` 为空。

看全部时，收支是每一笔记账各算一次。看单人时，支出等于 `buildSettlement` 给出的该记账成员应承担金额。本接口不写 `transactions`，不写 `bill_overview_rules`，也不改变概览查询结果。

## 养老计划

### GET /api/v1/asset/retire-plan?billId=&memberId=

`memberId` 空表示「全部」。没有计划时返回空数据，不报错。

### PUT /api/v1/asset/retire-plan

正文：`billId`、`memberId`（可空）、`amount`、`startMonth`、`targetMonth`（可空）。目标金额必须大于 0。开始月份必填且不晚于本月。目标月份为空，或晚于本月。任一不满足则失败并说明原因，原计划不变。成功后按账本和成员范围覆盖这一行。

同一响应附上推算用的 `monthlyIncome` 与 `monthlyExpense`。选中单个资产成员时，这两项只统计只归属该同名记账成员的收入和支出，不调用 `buildSettlement`。看全部时，每一笔收入和支出各算一次。
