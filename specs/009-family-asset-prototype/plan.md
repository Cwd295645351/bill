# Implementation Plan: 按原型补齐家庭资产

**Branch**: `009-family-asset-prototype` | **Date**: 2026-10-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-family-asset-prototype/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

在已有的电脑端资产页上，按原型补齐这些可见变化：外币按账本汇率折成人民币、总览用日期选择器对比截至某一天、分组用缩短金额且不再显示变化率、四笔钱可直接改分类、年度对账按概览同一套有效收入拆共同支出和公共支出、养老计划、趋势默认「记账以来」并可按年、盘点分页。页签「构成」改称「资产组成」。不恢复「排除固定资产」，也不提供按月明细。

做法见 [research.md](./research.md)。币种、汇率和养老计划需要新列或新表。对账单人支出直接调用现有 `buildSettlement`，不在资产模块再写一套分摊。趋势仍用月历拼接。小程序不增加入口。用户手册改写家庭资产一章。

## Technical Context

**Language/Version**: 服务端 TypeScript，运行时 Node.js + Koa 2（`server/`）。电脑端 Vue 3 + Vite + TypeScript（`frontend/`）。

**Primary Dependencies**: 继续用 Sequelize、Element Plus、ECharts、现有 `/api/v1/asset`。分摊复用 `server/database/services/overviewSettlement.ts` 的 `buildSettlement`。不新增 npm 依赖，不新增测试框架。缩短金额和趋势图例只在电脑端完成。

**Storage**: `assets` 增加币种，负债的四笔钱改为可空。新增账本汇率表和养老计划表。盘点金额继续以原币存在 `asset_records`。概览规则和记账明细不改表，对账只读。

**Testing**: `npm test` 仍是占位。按 [quickstart.md](./quickstart.md) 在电脑网页手工验收。服务端改完后执行已有的 `npm run typecheck --prefix server`。

**Target Platform**: 电脑网页、进入账本之后的「资产」。微信小程序不新增资产、汇率、对账或养老入口。手机网页保持退出。

**Performance Goals**: 一个家庭账本、资产在百笔以内，打开总览就能看到合计和截至日变化。对账只读该年记账和已启用的概览规则。趋势「记账以来」按已有年份的月历拼接，不另定并发指标。

**Constraints**: 账本之间不可见，调用者必须是该账本成员。登记和盘点金额必须大于 0。币种保存后不可改。汇率必须大于 0，改汇率不改原币盘点。总资产不含负债。对账不得写入记账，也不得改写概览自己的分摊结果。养老推算不套用对账的拆分。用户手册用中文说明用法，不写接口。

**Scale/Scope**: 仍是一个资产页。页签为总览、四笔钱、资产组成、月历、资产趋势、养老计划。弹窗增加汇率；登记和编辑增加币种；总览增加日期选择器、缩短金额和年度对账。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 设计前 | 设计后 |
|------|--------|--------|
| I. 存量优先，增量规格化 | 通过。规格只交付家庭资产相对现行用法的变化，并写明记账、概览、预算、计划和小程序的入口与分摊结果不动。 | 通过。设计落在已有资产模块和 `frontend/src/views/asset`。对账只读记账和概览规则。手册按 FR-037 改家庭资产一章。 |
| II. 多端边界不可混用 | 通过。规格点名电脑网页。小程序不新增入口，不恢复手机网页。 | 通过。计算留在 `server/routes/asset` 与现有服务。展示只改 `frontend/src/views/asset`。 |
| III. 账本隔离与记账权限 | 通过。资产属于当前账本。资产成员与记账成员按姓名对应，不新增绑定，不改记账人和归属人。 | 通过。沿用 `billAccess` 的成员检查。对账调用 `buildSettlement` 时成员顺序与概览相同。隐藏资产成员不改写资产。 |
| IV. 公开契约向后兼容 | 通过。前缀仍是 `/api/v1`。新增路径和可选字段，不删除已有字段。 | 通过。见 [contracts/asset-api.md](./contracts/asset-api.md)。未传 `asOf`、`page` 时，旧的合计和盘点列表行为保持可用。新表可按 [data-model.md](./data-model.md) 回滚。 |
| V. 密钥与部署约束 | 通过。不新增密钥，不改部署。 | 通过。汇率存在数据库，不进环境变量。 |

无未通过的门禁。Phase 1 契约和数据模型写完后复检，结论不变。

## Project Structure

### Documentation (this feature)

```text
specs/009-family-asset-prototype/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── asset-api.md
└── tasks.md              # 由 /speckit-tasks 生成，本命令不创建
```

### Source Code (repository root)

```text
server/database/models/index.ts                 # 资产币种、汇率表、养老计划表
server/database/services/overviewSettlement.ts  # 只读复用 buildSettlement，不改分摊结果
server/database/services/assetRecordService.ts  # 截至某日最近一条盘点
server/routes/asset/assetController.ts          # 币种只在创建时写入，编辑拒绝修改
server/routes/asset/recordController.ts         # 盘点金额大于 0，分页
server/routes/asset/statisticsController.ts     # 人民币折算、截至日、最早盘点月、对账、养老
server/routes/asset/index.ts                    # 汇率、对账、养老计划路由

frontend/src/views/asset/Asset.vue              # 日期选择器、缩短金额、对账、养老、页签更名
frontend/src/views/asset/shared.ts              # 超过 100 才换成「万」
frontend/src/views/asset/api.ts
frontend/src/views/asset/type.d.ts
frontend/src/views/asset/hooks/use-overview.ts
frontend/src/views/asset/hooks/use-trend.ts     # 记账以来、按年、ECharts 图例
frontend/src/views/asset/hooks/use-records.ts   # 每页 10 条
docs/用户手册.md                                # 改写家庭资产一章

# 明确不改
miniapp/
mobile/
server/routes/overview/                         # 概览查询和结算建议保持原样
```

**Structure Decision**: 沿用 007 已经落地的「一个资产页 + `/api/v1/asset`」。统计和折算放在服务端。对账的个人份额不新写公式，调用概览结算里这个人的应承担金额。原型 `prototype/family-asset.html` 只作版式和口径参照，不把演示脚本拷进页面。

## Complexity Tracking

无违反原则，不填表。
