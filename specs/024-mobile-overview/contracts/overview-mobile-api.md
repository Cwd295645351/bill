# 契约：移动端收支概览

**基础路径**: `/api/v1`  
**响应形状**: `{ retCode, message, data }`；成功 `retCode === 0`，失败非 0，失败时 `data` 为 `null`。  
**鉴权**: 须已登录，且是该账本成员。非成员 `message` 为「不是该账本成员」。  
**改动端**: 后端在现有概览模块上新增两个只读接口，并修正未传数量时的跨年结算。小程序与 H5 调用新接口。电脑端继续调用原来的结算接口，不改页面。`/overview/balance`、`/overview/settlement`、`/overview/threeYearCost` 的路径和成功体字段保持不变。

两个新接口都不得接受 `quantityInputs`，也不得写入概览规则或年度配置。

## `GET /overview/mobile`

查询一个闭区间的手机概览。

**Query**:

| 参数 | 必填 | 说明 |
|------|------|------|
| billId | 是 | 账本 ID |
| beginDate | 是 | `YYYY-MM-DD`，含当日 00:00:00 |
| endDate | 是 | `YYYY-MM-DD`，含当日结束（23:59:59.999），与电脑端 `dayEndTs` 一致 |

开始晚于结束：`message` 为「开始时间不能晚于结束时间」。缺参沿用概览现有短句（账本 id、开始时间、结束时间不能为空）。未来日期没有记账时仍成功，数值为 0、列表为空。

**成功 `data`**:

```json
{
  "totalCost": 28640.5,
  "investCost": 8000,
  "consumptionCost": 20640.5,
  "totalIncome": 52000,
  "incomes": [
    { "userId": "u1", "name": "甲", "money": 45000 }
  ],
  "lines": ["乙 → 甲 转 860.00 元"],
  "members": [
    { "userId": "u1", "name": "甲" },
    { "userId": "u2", "name": "乙" }
  ],
  "categories": {
    "all": [
      { "costTypeId": "1015", "name": "基金", "money": 8000, "count": 2, "percent": "27.93" }
    ],
    "members": [
      {
        "userId": "u1",
        "name": "甲",
        "slices": [
          { "costTypeId": "1001", "name": "餐饮买菜", "money": 4200, "count": 20, "percent": "20.59" }
        ]
      }
    ]
  },
  "minYear": 2020,
  "maxYear": 2036
}
```

规则：

- `consumptionCost` 等于总支出减总投资，保留到分。总投资只含基金（类型 id `1015`）。
- `incomes` 只含金额大于 0 的当前成员，按成员加入顺序。没有则是空数组。
- `lines` 至少一句。未传 `quantityInputs` 时，必须与 `POST /overview/settlement` 按同一区间得到的 `lines` 一致，包括跨年。跨年先按年分摊再合并净额，仍然只返回这一组句子。
- `members` 是当前成员。只有一名时 `categories.members` 必须是空数组。
- 分类按金额从高到低，金额相同按名称中文排序。金额为 0 的分类不出现。
- `percent` 是已经四舍五入的两位小数字符串，不带百分号。除该列表最后一项外，按该项金额占该列表金额合计计算；最后一项等于 `100` 减去其余项，使数值之和为 `100.00`。只有一项时为 `"100.00"`。`categories.all` 与每个成员的 `slices` 各自计算。
- `count` 是原始记账笔数。成员分类的笔数包含归属该成员、归属「全部」、以及归属名单里有该成员的支出。
- 响应不得出现数量、归属人 id、单价、规则 id 或「计算」字段。

## `GET /overview/mobile/records`

某一分类在当前视图下的原始支出。

**Query**:

| 参数 | 必填 | 说明 |
|------|------|------|
| billId | 是 | 账本 ID |
| beginDate | 是 | 与主接口相同 |
| endDate | 是 | 与主接口相同 |
| costTypeId | 是 | 分类 ID |
| memberId | 否 | 不传表示「全部」。传入时只保留归属该成员、归属「全部」、或该成员参与的多人支出 |

开始晚于结束、缺参、非成员的失败语义与主接口相同。

**成功 `data`**:

```json
{
  "total": 2,
  "records": [
    {
      "id": "t1",
      "date": "2026-11-03",
      "payerName": "甲",
      "belongName": "全部",
      "money": 120.5,
      "remark": ""
    }
  ]
}
```

- `total` 必须等于主接口里对应分类的 `count`。
- `money` 是记账原金额。
- `records` 按日期从新到旧，同一天按 id 从新到旧。
- 没有记录时 `total` 为 0，`records` 为空数组，仍然成功。

## 既有接口

| 接口 | 约束 |
|------|------|
| `GET /overview/balance` | 电脑端汇总。字段与基金口径不变 |
| `POST /overview/settlement` | 成功体字段不变。传入 `quantityInputs` 时仍按整段使用这组数量。不传时按自然年切开，各年使用该年已保存配置，再合并成一组 `lines` 和成员份额；同一年与改前一致。电脑端概览不传该字段，因此跨年查询走合并计算 |
| `GET /overview/threeYearCost` | 仍只给电脑端近五年趋势。手机不得请求它来画趋势 |
