# Tasks: 资产趋势专用接口

**Input**: Design documents from `/specs/010-asset-trend/`

**Prerequisites**: plan.md, spec.md, contracts/asset-trend-api.md

**Tests**: 手工验收见 quickstart；无强制新增自动化测试框架。

## Phase 1: Spec Kit artifacts

- [x] T001 Create `specs/010-asset-trend/spec.md` from Spec Kit flow
- [x] T002 [P] Write `checklists/requirements.md` and mark validation
- [x] T003 Update `.specify/feature.json` → `specs/010-asset-trend`
- [x] T004 [P] Write plan.md / research.md / contracts / quickstart.md

## Phase 2: Shared kernel (blocking)

- [x] T005 Implement `server/database/services/monthEndTotals.ts`（盘点池 + 单月汇总）
- [x] T006 Refactor `getMonthlyReport` in `statisticsController.ts` to call kernel; external shape unchanged

## Phase 3: Trend API (US1/US2)

- [x] T007 [US1] Implement `getAssetTrend` in `statisticsController.ts`
- [x] T008 [US1] Register `GET /trend` in `server/routes/asset/index.ts`

## Phase 4: Frontend (US1/US3)

- [x] T009 [P] [US1] Add `getAssetTrend` + types in `api.ts` / `type.d.ts`
- [x] T010 [US1] Rewrite `use-trend.ts` to one trend call; overview only for earliest
- [x] T011 [P] Optional: brief note in `docs/用户手册.md` §10.8

## Phase 5: Verify

- [x] T012 typecheck server; smoke per quickstart
- [x] T013 Confirm no edits under specs/001–009

## Notes

- 任务清单**不得**包含「修订 specs/007」类项。
