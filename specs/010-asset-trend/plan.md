# Implementation Plan: 资产趋势专用接口

**Branch**: `010-asset-trend` | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-asset-trend/spec.md`

## Summary

为电脑端「资产趋势」新增 `GET /api/v1/asset/trend`：一次请求覆盖任意起止月，按月末最近盘点汇总后按粒度/口径投影为 chart-ready 序列。从现有月历实现抽出共享 `buildMonthEndTotals`（及窗内盘点一次加载的内存切片），`monthly-report` 改调该内核且对外行为不变。PC `use-trend.ts` 去掉按年串行拼月历。规格只落本目录；禁止改 001–009 归档文。

## Technical Context

**Language/Version**: 服务端 TypeScript（`server/`）。电脑端 Vue 3 + Vite + TypeScript（`frontend/`）。

**Primary Dependencies**: Sequelize、dayjs、ECharts、现有 `/api/v1/asset` 路由与 `getLatestSnapshotsBefore` / `assetFx`。不新增 npm 依赖。

**Storage**: 不改表结构。继续读 `assets`、`asset_records` 与账本汇率。

**Testing**: 服务端 `npm run typecheck --prefix server`。手工：同月交叉校验趋势 vs 月历；跨年窗；结束截断；成员筛选；grain=year；窗长上限。见 [quickstart.md](./quickstart.md)。

**Target Platform**: 电脑网页资产趋势页。小程序不改。月历契约保留。

**Performance Goals**: 默认一次加载窗内相关盘点到内存，再按月末 cutoff 切片（策略 B）；单窗最多 240 月。家庭账 >7 年「记账以来」1 次 trend RTT。

**Constraints**: 调用者须为账本成员。月末口径与月历同源。不改归档 specs。错误提示沿用现有 ResModel 中文 message。

**Scale/Scope**: 新增 1 个 GET；重构统计控制器/抽出服务；改 `use-trend` / `api.ts` / 类型；可选用户手册一句。

## Constitution Check

| 原则 | 设计前 | 设计后 |
|------|--------|--------|
| I. 存量优先，增量规格化 | 通过。只交付趋势一次请求与同口径。 | 通过。新目录规格；月历对外不变。 |
| II. 多端边界不可混用 | 通过。仅 PC + API。 | 通过。改 `server/routes/asset` 与 `frontend/src/views/asset`。 |
| III. 账本隔离与记账权限 | 通过。bill 成员校验与现资产接口相同。 | 通过。`index.ts` guard 不变模式。 |
| IV. 公开契约向后兼容 | 通过。只新增路径，不删改 monthly-report 字段。 | 通过。见 contracts。 |
| V. 密钥与部署约束 | 通过。无新密钥。 | 通过。 |

## Project Structure

### Documentation (this feature)

```text
specs/010-asset-trend/
├── plan.md
├── research.md
├── quickstart.md
├── contracts/
│   └── asset-trend-api.md
├── checklists/requirements.md
├── spec.md
└── tasks.md
```

### Source Code

```text
server/database/services/monthEndTotals.ts   # 共享月末汇总 + 窗内盘点池
server/routes/asset/statisticsController.ts  # monthly-report 改调内核；新增 getAssetTrend
server/routes/asset/index.ts                 # 注册 GET /trend

frontend/src/views/asset/api.ts
frontend/src/views/asset/type.d.ts
frontend/src/views/asset/hooks/use-trend.ts  # 一次 trend；overview 仅取 earliest

docs/用户手册.md                             # 可选：趋势与月历同口径一句
```

## Phase 0 / Phase 1

见 [research.md](./research.md)、[contracts/asset-trend-api.md](./contracts/asset-trend-api.md)、[quickstart.md](./quickstart.md)。
