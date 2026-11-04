# Tasks: 排除固定资产

**Input**: Design documents from `/specs/012-exclude-fixed-assets/`

**Prerequisites**: plan.md, spec.md

**Tests**: 手工验证（规格未要求自动化测试）

**Organization**: 按用户故事分组

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [x] T001 创建 `specs/012-exclude-fixed-assets/` 并写入 spec/plan/tasks/checklist；更新 `.specify/feature.json`

## Phase 2: Foundational

- [x] T002 确认固定资产金额可从 `AssetOverview` 现有 `summary.categoryChanges` / `stats.assetGroups` 取得，无需改 API

## Phase 3: User Story 1 - 排除固定资产开关 (P1)

**Goal**: 卡片可开关；开启后净资产与总资产扣固定资产；总负债不变；开启态可见

**Independent Test**: 有固定资产样本上开关切换并核对三数

- [x] T003 [US1] 在 `frontend/src/views/asset/components/AssetOverview.vue` 增加 `excludeFixedAssets` 与 `fixedAssetAmount` / 展示用净额、总资产计算
- [x] T004 [US1] 在家庭资产卡片 actions 增加「排除固定资产」按钮，`:class="{ active: ... }"`，默认关闭
- [x] T005 [US1] 净资产/总资产绑定展示计算值；总负债保持原值；必要时 `actions` 加 `flex-wrap`

## Phase 4: User Story 2 - 零固定资产边界 (P2)

- [x] T006 [US2] 确认固定资产为 0/缺失时开启开关数字不变（与 T003 同一公式，手工验）

## Phase 5: Polish

- [x] T007 自测清单写入完成报告；确认未改 package.json/.gitignore 与归档 specs
- [x] T008 更新 `docs/用户手册.md` 与 `docs/用户手册.html`：§10.2 排除固定资产开关说明 + FAQ

## Dependencies

- US1 → US2（同一组件公式覆盖）
- T001 → T002 → T003 → T004/T005 → T006 → T007

## Parallel Opportunities

- T004 与 T005 可同文件一次完成
