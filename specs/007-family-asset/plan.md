# Implementation Plan: 家庭资产

**Branch**: `007-family-asset` | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-family-asset/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

在电脑网页进入账本后提供「资产」：成员、登记与编辑、盘点、家庭或个人合计、相对上月末的变化、四笔钱、构成、月历和资产趋势。资产成员与记账成员分开。总资产不含负债，净资产等于总资产减总负债。

做法见 [research.md](./research.md)。不新增接口路径，修正现有 `/api/v1/asset` 的负债标记、月历分类、桑基类型名、总资产变化、账本必填和「只有金额变化才记盘点」。电脑端按现有页面方式新增一个资产页，趋势用修正后的月历按年拼接。小程序不增加入口。用户手册同步写上这一章。

## Technical Context

**Language/Version**: 服务端 TypeScript，运行时 Node.js + Koa 2（`server/`）。电脑端 Vue 3 + Vite + TypeScript（`frontend/`）。

**Primary Dependencies**: 继续用 Sequelize、Element Plus、ECharts、现有 `/api/v1/asset` 路由。不新增 npm 依赖，不新增测试框架。构成用现有 ECharts 桑基图，色带按实际金额。总览相对上月末用横向色条。趋势的负债按负数画在零轴下方，图铺满资产页剩余高度。

**Storage**: 不改表结构。继续使用 `members`、`assets`、`asset_records`。上线时对已有「类型为负债但未标记」的行做一次幂等更新。

**Testing**: `npm test` 仍是占位。按 [quickstart.md](./quickstart.md) 在电脑网页手工验收。服务端改完后执行已有的 `npm run typecheck --prefix server`。

**Target Platform**: 电脑网页、进入账本之后的「资产」。微信小程序不新增资产页面。手机网页保持退出，不恢复。

**Performance Goals**: 一个家庭账本、资产在百笔以内，打开资产页就能看完总览。趋势近 5 年最多拼 6 次年历，不另定并发指标。

**Constraints**: 账本之间不可见，调用者必须是该账本成员。金额必须大于 0。当前金额始终来自日期最新的未隐藏盘点。总资产变化只比较非负债。缺少账本时，四笔钱、桑基、月历不得扫全库。不把资产写入记账、预算、概览分账。用户手册用一章说明家庭资产的用法，不写接口。

**Scale/Scope**: 一个资产页，五个页签（总览、四笔钱、构成、月历、资产趋势）和四个弹窗（登记、编辑、盘点、成员）。顶栏在记账、概览、预算、计划之后增加「资产」。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 设计前 | 设计后 |
|------|--------|--------|
| I. 存量优先，增量规格化 | 通过。规格只交付家庭资产这一次行为，并写明记账、概览、预算、计划和小程序不动。 | 通过。设计落在已有资产模块和电脑端新页面，没有重写记账或概览。 |
| II. 多端边界不可混用 | 通过。规格点名电脑网页。小程序不新增资产入口，不恢复手机网页。 | 通过。计算留在 `server/routes/asset` 与现有 `server/database/services/assetRecordService`。展示只新增 `frontend/src/views/asset`，并在账本菜单加一项。 |
| III. 账本隔离与记账权限 | 通过。资产属于当前账本。资产成员不是记账成员。不改记账人、归属人。 | 通过。每条资产接口用 `bill_users` 确认当前用户是该账本成员，与概览结算同一做法。隐藏资产成员不改写其资产。 |
| IV. 公开契约向后兼容 | 通过。前缀仍是 `/api/v1`。规格要求改正错误口径；今天没有已发布页面在读这些资产结果。 | 通过。见 [contracts/asset-api.md](./contracts/asset-api.md)。不新增、不删除路径。错误结果按规格改正，并在契约里写明。不改表结构，回滚代码即可停用新页面；负债标记回填的回退方式写在数据模型里。 |
| V. 密钥与部署约束 | 通过。不新增密钥，不改部署。 | 通过。资产页面不读新的环境变量。 |

无未通过的门禁。Phase 1 契约和数据模型写完后复检，结论不变。

## Project Structure

### Documentation (this feature)

```text
specs/007-family-asset/
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
server/routes/asset/assetController.ts           # 负债标记、金额大于 0、仅金额变化才新增盘点、非保险清空险种
server/routes/asset/recordController.ts          # 新增、修改、删除后都按日期最新的一条重算当前金额
server/routes/asset/statisticsController.ts      # 总资产变化、月历中文分类、桑基、账本必填、未来月为 null
server/routes/asset/memberController.ts          # 隐藏成员时不改写资产
server/routes/asset/index.ts                     # 进入控制器前确认账本成员
server/database/services/assetRecordService.ts   # 已有的「某时刻之前最近一次盘点」，月历和上月末继续用它

frontend/src/utils/api-services/index.ts         # 增加 ASSET 网关，前缀 /api/v1/asset
frontend/src/views/asset/router.ts               # /layout/asset
frontend/src/views/asset/api.ts
frontend/src/views/asset/type.d.ts
frontend/src/views/asset/Asset.vue               # 五个页签和四个弹窗
frontend/src/components/layout/hooks/use-layout.ts  # 账本菜单增加「资产」
docs/用户手册.md                                 # 新增家庭资产一章，并改目录、菜单、对照和常见问题

# 明确不改
miniapp/
frontend 的记账、概览、预算、计划页面
```

**Structure Decision**: 沿用现有资产路由和电脑端「一个页面一个目录」的约定。统计口径放在服务端，避免页面再算一遍总资产。趋势不新开接口，用月历拼年份。构成的金额来自桑基接口，用 ECharts 按实际金额画色带，三种标注放在页面。总览的上月末对比用横向色条。类型为负债时不保存四笔钱。月历「较年初」在 1 月没有盘点时按 0。原型 `prototypes/family-asset.html` 只作版式参照。

## Complexity Tracking

无宪章违规，不填本表。
