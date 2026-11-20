# 契约：概览按累计收入分账

**基础路径**: `/api/v1`  
**响应形状**: `{ retCode, message, data }`；成功 `retCode === 0`，失败非 0，失败时 `data` 为 `null`。  
**鉴权**: 须已登录，且是该账本成员。非成员 `message` 为「不是该账本成员」。

不新增路径。`GET /overview/balance`、`GET /overview/threeYearCost`、`GET /overview/mobile/records` 不增加参数。资产对账不增加累计标志。

## `POST /overview/settlement`

在现有 `billId`、`beginDate`、`endDate` 之外增加：

| 参数 | 必填 | 说明 |
|------|------|------|
| cumulativeIncome | 否 | 只接受 JSON 布尔值。缺省或 `false` 为关闭，`true` 为打开 |

缺省和 `false` 以外、又不是 `true` 的值：`message` 为「按累计收入分参数不正确」，`data` 为 `null`。`true` 且支出区间跨自然年：`message` 为「跨年时不能按累计收入分」，`data` 为 `null`，不返回结算字段。支出区间缺参、开始晚于结束，沿用现有文案。

请求体里的 `quantityInputs` 不再读取。传来也忽略，不因此失败。数量和归属只使用对应年份已保存的配置。

成功体保留现有 `members`、`lines`、`transfers`、`pies`。另外始终返回：

```json
{
  "expenseBeginDate": 1761926400000,
  "expenseEndDate": 1764518399999,
  "incomeBeginDate": 1735660800000,
  "incomeEndDate": 1764518399999
}
```

未打开时，收入两端等于支出两端。打开后，收入两端是服务端推导的结果；与支出区间相同时，收入两端仍等于支出两端。

收入区间更长时：

- `members[].income`、`effectiveIncome`、`weight` 来自收入区间。
- `paid`、`borne`、`exclusive`、`sharedShare`、`publicShare`、`net`、`lines`、`transfers`、`pies` 来自支出区间的分摊。

未打开，或两端相同：这些字段与现在按该支出区间、不传临时数量的结算一致，包括跨年。

`members` 仍按 `bill_users.id` 升序。`effectiveIncome` 允许为负。`income` 是归属到该成员的毛收入。

## `GET /overview/mobile`

Query 增加可选的 `cumulativeIncome`，只接受 `true` 或 `false`。缺省视为 `false`。校验句子与结算接口相同。

服务端自己调用结算。收入区间更长时，对收支汇总查两次：支出区间取总支出和总投资，收入区间取总收入。浏览器一次请求拿到全部结果。

成功体原有字段保留：

- `totalCost`、`investCost`、`consumptionCost`、`categories`：支出区间。总投资仍只含基金（类型 id `1015`）。总消费 = 总支出 − 总投资。
- `totalIncome`：收入区间的收支汇总，含公共归属。
- `incomes`：归属人收入。仍只含金额大于 0 的当前成员，按 `bill_users.id` 升序。项为 `userId`、`name`、`money`。
- `lines`：本次结算句子。未打开时，必须与同一支出区间、不传累计标志的 `POST /overview/settlement` 的 `lines` 一致，包括跨年。
- `members`、`categories`、`minYear`、`maxYear` 的原有含义不变。

新增，旧客户端可忽略：

- `effectiveIncomes`：当前全部成员，按 `bill_users.id` 升序。项为 `userId`、`name`、`money`。`money` 是有效收入，允许为负，保留两位小数。
- 与结算接口相同的四个日期字段。

响应不得返回数量、单价、归属配置或规则 id。

`GET /overview/mobile/records` 不接收累计标志。它只列支出区间的原始记账。

## 页面使用契约时的约束

这些不是新的接口字段，验收时要一起看：

- 三端都不得提交收入起止日。
- 归属人收入展示为「成员名收入」，不展示记账人。
- 总支出、总投资、总消费、总收入、归属人收入，名称一行、金额一行。结算句子不拆行。页面不列出每人有效收入。
- 只有开关打开才显示收入区间说明。两个区间不同且本次查询已成功时，总收入标签为「总收入（分账区间）」。开关打开且区间相同时，开关下写「收入区间：YYYY-MM-DD 至 YYYY-MM-DD，与支出区间相同」，总收入标签仍是「总收入」。开关关闭时不显示收入区间说明。
- 电脑端用递增的查询序号丢掉过期响应。查询成功返回前，只预览开关下的收入区间说明；总收入标签、汇总数和结算保持上次成功结果。手机改开关或改同一年内的日期后立即请求。
