# Contract: GET /api/v1/asset/trend

## Endpoint

`GET /api/v1/asset/trend`

鉴权与成员校验同 `GET /api/v1/asset/monthly-report`：登录用户须为该 `billId` 账本成员。

## Query

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| billId | string/number | 是 | 账本 ID |
| startMonth | string YYYY-MM | 是 | 闭区间起点 |
| endMonth | string YYYY-MM | 是 | 闭区间终点；晚于本月则截断为本月 |
| grain | `month` \| `year` | 否 | 默认 `month` |
| metric | `all` \| `net` | 否 | 默认 `all` |
| memberId | string/number | 否 | 缺省=全部成员 |

## Errors（ResModel retCode≠0，message 中文）

- 缺 billId / 月格式非法：参数错误
- startMonth > endMonth（截断后仍颠倒）：起止月份颠倒
- 窗长 > 240 月：时间范围过大，请缩小到 20 年以内
- 非成员 / 无账本：沿用现有 guard / 控制器提示

## Success data

```json
{
  "billId": "1",
  "startMonth": "2019-03",
  "endMonth": "2026-10",
  "grain": "month",
  "metric": "all",
  "memberId": null,
  "capped": false,
  "labels": ["2019-03", "2019-04"],
  "series": [
    { "key": "liquid", "name": "流动资金", "values": [12000.5, null] },
    { "key": "invest", "name": "投资理财", "values": [null, 100] },
    { "key": "fixed", "name": "固定资产", "values": [null, null] },
    { "key": "receivable", "name": "应收款", "values": [null, null] },
    { "key": "liability", "name": "负债", "values": [-3000, null] }
  ],
  "legend": [
    { "key": "liquid", "first": 12000.5, "last": 12000.5, "delta": 0 }
  ]
}
```

- `metric=net` 时 `series` 仅 `{ key: "net", name: "净资产", values: [...] }`。
- `grain=year` 时 `labels` 为 `YYYY`；每年取窗内该年最后一个「该序列有数」月在投影前的月末点（实现：先按月算全部分类，再按年对投影后的序列取最后非 null）。
- `liability` 在 `all` 下为负债合计的**相反数**（内核存非负）。
- `values` 与 `labels` 等长；`null` = 缺口。
- `capped=true` 表示请求的 endMonth 被截到本月。
- 金额单位：折人民币，与 monthly-report 一致（两位小数）。

## Unchanged

`GET /api/v1/asset/monthly-report` 路径与响应形状保持不变。
