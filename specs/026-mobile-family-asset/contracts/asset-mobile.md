# 契约：移动端家庭资产

**功能分支**: `026-mobile-family-asset` | **日期**: 2026-11-21

微信小程序与移动端 H5 进入账本后使用。前缀保持 `/api/v1/asset`。登录和成员检查与现有资产接口相同：不是该账本成员时失败，文案说明无权查看该账本，响应不带数据。

已有路径的字段保持原样。本文件只写手机要调用的路径。不新增恢复成员，也不新增列出已隐藏成员的参数。电脑端现有调用不变。

## 手机调用的现有路径

| 路径 | 用途 |
|------|------|
| `GET /members?billId=` | 未隐藏的资产成员 |
| `POST /member` | 新增资产成员 |
| `PUT /member` | 改名 |
| `DELETE /member?id=` | 隐藏。软删除成员，不删除名下资产 |
| `GET /list-stats?billId=&memberId=` | 分组和每一笔。变化相对上一次盘点 |
| `POST /` | 登记。金额不小于 0。不传渠道和周转周期 |
| `PUT /` | 编辑。金额变化才新增盘点。必须送回原渠道和周转周期。不能改币种 |
| `DELETE /?id=` | 删除资产及其盘点 |
| `GET /records?assetId=&page=&pageSize=` | 盘点。`pageSize` 为 10 |
| `POST /record`、`PUT /record`、`DELETE /record` | 新增、修改、删除盘点。只剩一条时删除失败 |
| `GET /overview?billId=&memberId=&asOf=` | 卡片合计。`asOf` 为对比日。响应里的 `defaultAsOf` 是默认对比日 |
| `GET /four-money?billId=&memberId=` | 四笔钱 |
| `GET /monthly-report?billId=&year=&memberId=` | 月历。没有盘点的月份仍是空 |
| `GET /trend?billId=&startMonth=&endMonth=&grain=&metric=&memberId=` | 趋势 |
| `GET /exchange-rate?billId=`、`PUT /exchange-rate` | 汇率。必须大于 0 |
| `POST /ledger` | 年度收支对账。正文只有 `billId`、`year`、可选 `memberId`，不传数量 |
| `GET /retire-plan`、`PUT /retire-plan` | 养老计划。查询可带近 3 年或近 5 年，以及是否剔除没有收入的月份 |

手机不调用 `GET /sankey`。

`memberId` 空表示「全部」。看某一名未隐藏成员时传该成员 id。手机不传已隐藏成员，也不把多名已隐藏成员合成一次请求。

## 对账响应里手机要展示的字段

沿用现有 `POST /ledger` 成功体，至少使用：

| 字段 | 用途 |
|------|------|
| `years` | 底部弹层里的年份 |
| `income`、`expense`、`surplus` | 记账总收入、总支出、收支结余 |
| `assetChange`、`netChange`、`diff`、`equal` | 总资产变化、同期净资产变化、差额和是否相等 |
| `openingMonth`、`closingMonth`、`openingAsset`、`closingAsset` | 期初和期末说明。缺少盘点时变化和差额为空 |
| `exclusive`、`sharedShare`、`publicShare`、`effectiveIncome` | 单人支出的三部分和各人有效收入 |
| `unmatched`、`message` | 没有同名记账成员或这一年没有记账 |
| `quantityRules` | 已启用的数量规则说明。没有则为空列表 |
