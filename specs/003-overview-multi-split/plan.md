# Implementation Plan: 概览统计支持多人分账

**Branch**: `003-overview-multi-split` | **Date**: 2026-10-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-overview-multi-split/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

电脑端概览在查询后，按全体当前成员的有效收入分摊归属为「全部」的公共支出，并给出一组「谁转给谁」。两人、双方有效收入都非负时，手册里的整元例子方向和金额不变。报销进度不减少记账金额。手机网页和小程序不增加这套分账。

做法见 [research.md](./research.md)：新增一个只给电脑端用的结算接口，在服务端按每一笔支出轧差。现有收支汇总和近三年趋势的响应不改。数量规则的单价仍以账本里保存的为准，浏览器只提交数量和归属人。

## Technical Context

**Language/Version**: 服务端 Node.js + Koa 2（`server/`）。电脑端 Vue 3 + Vite + TypeScript（`frontend/`）。

**Primary Dependencies**: 继续用 Sequelize、现有概览路由和 ECharts。不新增 npm 依赖，不新增测试框架。

**Storage**: 不改表，不加列。读取已有的 `transactions`、`bill_users`、`bill_overview_rules`。

**Testing**: `server` 的 test 仍是占位，仓库没有可用的自动化测试脚本。按 [quickstart.md](./quickstart.md) 在电脑端手工验收规格中的金额例子。不为分账单独引入测试框架。

**Target Platform**: 电脑网页「概览」。手机网页和小程序只做回归，确认没有新的分账入口，已有汇总数字仍来自原来的接口。

**Performance Goals**: 一个家庭账本、一次查询一年区间，点查询后能在同一次结果里读完结算建议。不追求并发指标。

**Constraints**: 金额用「分」做整数，避免浮点。公共支出先加总再只分一次，除最后一名外四舍五入到分，最后一名拿剩余，且不能分出负数。建议转账不超过参与人数减 1，同一人不同时收付。不改 `/api/v1/overview/balance` 与 `/api/v1/overview/threeYearCost` 的路径和已有字段。单价不信任浏览器。明细不返回分账后的金额。

**Scale/Scope**: 家庭账本，成员可以是 1、2、3 或更多，不设上限。只改电脑端概览的分摊、个人支出结构和结算建议，以及用户手册里对应的段落。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 设计前 | 设计后 |
|------|--------|--------|
| I. 存量优先，增量规格化 | 通过。只补「全体成员分账」，并写明两人整元例子、汇总数字、近三年趋势、规则配置方式不动。 | 通过。设计没有扩到按人头以外的新比例、为每人加数量框、或改手机端。 |
| II. 多端边界不可混用 | 通过。规格点名电脑端。手机网页和小程序不提供这套分账。 | 通过。计算放在 `server/routes/overview` 与 `server/database/services`，展示只改 `frontend/src/views/overview`。 |
| III. 账本隔离与记账权限 | 通过。分账不改记账人、归属人，也不让看结算的人因此能改别人的账。 | 通过。新接口要求当前用户是该账本成员。规则仍只有创建者能配置，本次不改配置入口。 |
| IV. 公开契约向后兼容 | 通过。汇总接口继续给手机端用，不能改已有字段的含义。 | 通过。见 [contracts/overview-settlement.md](./contracts/overview-settlement.md)。新接口是新增路径。无表结构变更，回滚时去掉该路径即可。 |
| V. 密钥与部署约束 | 通过。不新增密钥，不改部署。 | 通过。结算不读 `.env` 里的新项。 |

无未通过的门禁。设计结束后复检，结论不变。

## Project Structure

### Documentation (this feature)

```text
specs/003-overview-multi-split/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── overview-settlement.md
└── tasks.md              # 由 /speckit-tasks 生成，本命令不创建
```

### Source Code (repository root)

```text
server/database/services/overviewSettlement.js    # 纯计算：有效收入、公共支出合计分摊、净额、转账建议
server/routes/overview/controller.js              # 读取区间明细与规则，调用上面的计算
server/routes/overview/index.js                   # 新增 POST /settlement；原有两个 GET 不动

frontend/src/views/overview/api.ts                # 调用结算接口
frontend/src/views/overview/type.d.ts             # 结算结果的类型
frontend/src/views/overview/hooks/use-type-chart.ts
frontend/src/views/overview/Overview.vue          # 结算文案、每人一张支出结构；查询前不刷新

docs/用户手册.md                                   # 3.6、7.1、7.3、12.2、12.3

# 明确不改
server/routes/overview 的 GET /balance、GET /threeYearCost
mobile/                                                # 手机网页不增加分账
miniapp/                                               # 小程序不增加分账
frontend 的预算、计划、记账、类型管理                    # 规则配置方式不动
```

**Structure Decision**: 沿用现有概览模块。分账不是新页面。垫付和归属必须看每一笔支出，不能只用今天汇总接口里按人加总的金额；公共支出的分摊则对区间合计只做一次。计算放在服务端，电脑端只展示。业务计算放在 `server/database/services`，路由只做校验和取数。手机端继续只读原来的汇总接口。

## Complexity Tracking

无宪章违规，不填本表。
