# Tasks: 移动端预算模块

**Input**: Design documents from `/specs/017-mobile-budget/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 规格未要求自动化测试；本列表不含 TDD/契约测试任务，以 [quickstart.md](./quickstart.md) 手工验收为准。

**Organization**: 按用户故事拆分；US1/US2 为 P1，US3/US4 为 P2。两端（miniapp + mobile-h5）均须交付（澄清：两端 Done）。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无未完成依赖）
- **[Story]**: US1/US2/US3/US4 对应用户故事
- 描述须含确切文件路径

## Path Conventions

本仓库触点：`mobile-h5/`、`miniapp/`、`docs/`、`.specify/memory/`（默认不改 `server/`、不改 `frontend/` 功能、不碰旧 `mobile/`）

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 对齐设计边界；引入 echarts 依赖

- [x] T001 核对 `specs/017-mobile-budget/` 下 plan/research/data-model/contracts/budget-api.md/quickstart 齐全，并按 plan「Source Code」列出将改文件清单（确认不改 `frontend/` 预算主流程、不恢复旧 `mobile/`、默认不改 `server/routes/budget`）
- [x] T002 [P] 在 `mobile-h5/package.json` 增加 `echarts`（版本对齐 PC `frontend/package.json` 的 `^5.4.2`），安装依赖
- [x] T003 [P] 在 `miniapp/` 引入 echarts 微信适配（`echarts` + `echarts-for-weixin` / `ec-canvas` 等，按 research），更新 `miniapp/package.json` 并执行「构建 npm」，确认 `miniprogram_npm` 可用

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: API 客户端、进度文案工具、账本内底栏、路由/页面骨架——所有故事共用

**⚠️ CRITICAL**: 本阶段完成前不开始 US1–US4 业务页实现

- [x] T004 [P] 在 `mobile-h5/src/api/budget.ts` 实现 `getBudgetList` / `budgetAdd` / `budgetEdit` / `budgetDelete`（契约见 `contracts/budget-api.md`）；将 `mobile-h5/src/api/transaction.ts` 中既有 `getBudget` 迁出或改为 re-export，并补全返回类型含 `details[]`（`id`/`costTypeId`/`costTypeName`/`budget`/`cost`）
- [x] T005 [P] 在 `miniapp/miniprogram/apis/index.ts` 保留/扩展 `getBudget`，新增 `budgetAdd` / `budgetEdit` / `budgetDelete`（字段与 PC：`date`/`billId`/`costTypeId`/`money`/`id`）
- [x] T006 [P] 新增 `mobile-h5/src/utils/budget-tone.ts`：输入 `cost/budget`，输出状态文案与色值，区间须与 FR-004 一致（&lt;25% 较宽裕；25%～50% 正常；50%～75% 注意节奏；75%～90% 接近上限；≥90% 即将或已经超支）；进度宽度 `min(ratio,1)*100`
- [x] T007 [P] 新增 `miniapp/miniprogram/utils/budget-tone.ts`：规则与 T006 相同（两端文案/色阶一致）
- [x] T008 [P] 新增 `mobile-h5/src/components/BookTabBar.vue`：五项「记账 / 概览 / 预算 / 计划 / 资产」；`active` 高亮；概览/计划/资产点击 `showToast` 文案固定为「请到电脑端查看或管理」，不路由、不置灰、不隐藏
- [x] T009 [P] 新增 `miniapp/miniprogram/components/book-tab-bar/`（`index.ts/wxml/wxss/json`）：行为与 T008 相同（`wx.showToast`，文案同 FR-009）
- [x] T010 [P] 新增 `mobile-h5/src/components/charts/BudgetPieChart.vue`（或等价）：基于 echarts 渲染预算占比饼图+图例；无数据时不渲染
- [x] T011 [P] 新增 `miniapp/miniprogram/components/ec-canvas/`（或 `charts/`）封装 + 可被预算页调用的饼图初始化辅助；无数据时不渲染
- [x] T012 在 `mobile-h5/src/router/index.ts` 注册预算路由（如 `/bill/:id/budget` → `BudgetView.vue` 占位页即可）；约定搜索下钻 query 键名：`billId`、`type`、`costTypeId`、`beginDate`、`endDate`、`autoSearch`（`1` 表示自动搜）；`beginDate`/`endDate` 格式与现网搜索页一致，使用 `YYYY-MM-DD`（当年 `YYYY-01-01`～`YYYY-12-31`）
- [x] T013 在 `miniapp/miniprogram/app.json` 的 `pages` 注册 `pages/budget/index`（非全局 tabBar）；创建 `pages/budget/index.{ts,wxml,wxss,json}` 占位；搜索 query 键名与日期格式与 T012 一致

**Checkpoint**: API、tone、底栏、echarts 封装、路由/页面注册就绪——可开始 US1

---

## Phase 3: User Story 1 - 在手机上查看当年预算进度 (Priority: P1) 🎯 MVP

**Goal**: 进入账本后可切到「预算」，看到当年汇总、饼图、进度卡片与空态；未交付入口 toast

**Independent Test**: 有预算数据的账本打开预算页即可验收汇总/饼图/卡片；无预算见空态；点概览/计划/资产 toast；无需先完成增删改

### Implementation for User Story 1

- [x] T014 [US1] 实现 `mobile-h5/src/views/budget/BudgetView.vue`：固定当前自然年；调用 `getBudgetList`；展示年标、年度预算 `totalBudget`、年度支出 `currCost`；有 `details` 时挂载 `BudgetPieChart`；空态文案「今年还没有预算」且无饼图；卡片：类型名左、状态右、预算与花费同行、进度条封顶 100%、超支花费强调；底部预留「新增预算」按钮（可先禁用或仅占位，US2 接线）
- [x] T015 [US1] 在 `mobile-h5/src/views/bill-detail/BillDetailView.vue` 挂载 `BookTabBar`（`active=记账`）；从记账切到预算走 T012 路由并带 `billId`
- [x] T016 [US1] 预算页挂载 `BookTabBar`（`active=预算`）；从预算回记账进明细页
- [x] T017 [US1] 实现 `miniapp/miniprogram/pages/budget/index.*`：行为与 T014 对齐（用 T007 tone + T011 饼图）；导航栏标题「预算」
- [x] T018 [US1] 在 `miniapp/miniprogram/pages/bill-detail/` 挂载 `book-tab-bar`（记账高亮）；切换预算 `wx.navigateTo`/`redirectTo` 到 `pages/budget/index?billId=`
- [x] T019 [US1] 小程序预算页挂载 `book-tab-bar`（预算高亮），回记账进明细

**Checkpoint**: 两端均可只读查看当年预算进度（SC-001）；未交付三入口 toast（FR-009）

---

## Phase 4: User Story 2 - 新增、编辑、删除当年预算 (Priority: P1)

**Goal**: 账本成员在手机上完成当年预算增删改；类型不可在编辑时修改；删除需确认且不影响记账

**Independent Test**: 空预算账本新增 → 编辑金额 → 删除；可选类型仅未隐藏且未占用；非法金额不保存

### Implementation for User Story 2

- [x] T020 [P] [US2] 在 `mobile-h5/src/views/budget/BudgetView.vue`（或同目录表单组件）实现新增弹层：加载账本详情 `costTypes`，过滤规则对齐 PC 新增预算（排除已隐藏类型，字段名以实现时对照 PC/`getBillDetail` 为准），并排除当年已占用 `costTypeId`；金额必须 > 0；提示「同一类型一年只设一条、删除不影响已有记账」；保存调 `budgetAdd`；失败直接展示服务端 `message`（重复新增现网为「已存在相关预算」）
- [x] T021 [US2] 在 H5 预算页实现编辑：金额可改、类型只读；调 `budgetEdit`（body 含 `id`/`billId`/`date`/`money`）；成功刷新列表/饼图
- [x] T022 [US2] 在 H5 预算页实现删除：二次确认；确认后 `budgetDelete`；取消不删；成功刷新；确认记账流水仍在
- [x] T023 [P] [US2] 在 `miniapp/miniprogram/pages/budget/` 实现新增表单（sheet/popup）：可选类型规则与 T020 相同；调 `budgetAdd`；失败展示服务端 `message`
- [x] T024 [US2] 小程序预算页实现编辑（类型只读）与删除确认，分别调 `budgetEdit` / `budgetDelete`，成功刷新
- [x] T025 [US2] 两端卡片「编辑」「删除」按钮等宽样式一致（对齐原型 `.b-ops`），点击操作区不触发下钻（为 US3 预留空白区点击）

**Checkpoint**: 两端可独立完成新增→编辑→删除（SC-002）；无需依赖下钻

---

## Phase 5: User Story 3 - 从预算卡片下钻到当年该类型记账 (Priority: P2)

**Goal**: 点卡片空白处打开搜索页，预填支出+类型+当年起止，并自动搜索；无匹配空态；可返回账本上下文

**Independent Test**: 有支出类型点卡片 → 搜索页已出结果；无支出类型 → 空态；返回不丢账本

### Implementation for User Story 3

- [x] T026 [US3] 改造 `mobile-h5/src/views/record-search/RecordSearchView.vue`：`onMounted` 读取 query（`type`/`costTypeId`/`beginDate`/`endDate`/`autoSearch`）；应用预填（收支、分类名/id、日期）；当 `autoSearch=1` 时立即调用既有搜索逻辑；无结果用既有空态
- [x] T027 [US3] 在 `mobile-h5/src/views/budget/BudgetView.vue`：卡片空白区点击 → `router.push` 搜索页，带上 `billId`、`type=1`、`costTypeId`、当年首末日 `beginDate`/`endDate`、`autoSearch=1`；编辑/删除 `stopPropagation`
- [x] T028 [US3] 改造 `miniapp/miniprogram/pages/record-search/index.ts`：`onLoad` 解析同名 query；预填后若 `autoSearch=1` 自动搜索；无结果空态
- [x] T029 [US3] 在 `miniapp/miniprogram/pages/budget/index.ts`：卡片空白区跳转 `record-search` 并带齐 query；操作按钮不触发跳转
- [x] T030 [US3] 两端验证从搜索返回可回到预算/账本导航，`billId` 上下文不丢失

**Checkpoint**: SC-004 可验收（预填+自动搜，无需再点搜索）

---

## Phase 6: User Story 4 - 小程序与 H5 能力对齐 (Priority: P2)

**Goal**: 两端预算业务字段与操作结果一致；任一端缺失不得宣称本切片完成；与 PC 当年口径一致

**Independent Test**: PC 改预算后两端可见；一端改后另一端与 PC 刷新一致；无端侧特例字段

### Implementation for User Story 4

- [x] T031 [US4] 对照 `contracts/budget-api.md` 与 PC 预算页，检查 H5/小程序展示字段（`totalBudget`/`currCost`/`details`/`tone`）无端侧特例；修齐不一致处（优先改移动端，不改 PC 主流程）
- [x] T032 [US4] 按 `quickstart.md` 第 4 节做多端一致抽测：PC 增改 → 两端可见；H5 或小程序改删 → 另一端与 PC 刷新一致（SC-003）
- [x] T033 [US4] 确认交付清单：预算查看/增删改/下钻/底栏 toast 在 **miniapp 与 mobile-h5 均已完成**；缺一端则 tasks 不得全部勾完（FR-001 / US4-AC4）

**Checkpoint**: 两端对齐验收通过

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 手册与宪章；回归；quickstart 全量

- [x] T034 [P] 更新 `docs/用户手册.md`：能力表与正文改为小程序/H5 可查看与管理当年预算；删除「预算仅 PC / 移动端不能编辑」等过时句；仍标明类型配置、概览、计划、资产仅 PC（FR-011 手册部分 / SC-005）
- [x] T035 [P] 修订 `.specify/memory/constitution.md` 原则 II：预算可在 PC + mobile-h5 + 小程序管理；概览/计划/类型配置/资产仍以 PC 为准；按治理 bump 版本并写 SYNC IMPACT REPORT（FR-011 宪章部分；交付硬门禁，未完成不得宣称 Done）
- [x] T036 按 `specs/017-mobile-budget/quickstart.md` 全量手工验收（含回归：明细剩余预算、手动搜索、全局三 tab、PC 预算主流程）
- [x] T037 若联调发现既有 `server/routes/budget` 阻塞缺陷，仅做最小兼容修复并在 PR 说明；禁止借机重构（本切片未改后端）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup** → **Phase 2 Foundational**（阻塞所有故事）
- **US1 (Phase 3)**：依赖 Foundational；MVP
- **US2 (Phase 4)**：依赖 US1 预算页壳（同文件延伸）；可与 US3 部分并行但建议先完成增删改
- **US3 (Phase 5)**：依赖 US1 卡片；与 US2 的操作区互斥点击在 T025 已预留
- **US4 (Phase 6)**：依赖 US1–US3 两端实现后的对齐验收
- **Polish (Phase 7)**：依赖故事完成（文档可与 US4 并行起草，但宪章/手册合并前应功能已齐）

### User Story Dependencies

- **US1**：仅依赖 Foundational
- **US2**：依赖 US1 页面
- **US3**：依赖 US1 卡片；搜索页改造可与 US2 并行（不同文件）
- **US4**：依赖 US1–US3 两端均具备

### Parallel Opportunities

- T002 ∥ T003；T004–T011 多组 [P]（注意 H5/小程序分文件）
- US2：T020 ∥ T023；US3：T026 与 T028 可并行
- Polish：T034 ∥ T035

---

## Parallel Example: Foundational

```bash
Task: "mobile-h5/src/api/budget.ts CRUD"
Task: "miniapp/miniprogram/apis/index.ts budgetAdd/Edit/Delete"
Task: "mobile-h5/src/utils/budget-tone.ts"
Task: "miniapp/miniprogram/utils/budget-tone.ts"
Task: "BookTabBar.vue + book-tab-bar 组件"
Task: "BudgetPieChart.vue + 小程序 ec-canvas 封装"
```

## Parallel Example: User Story 3

```bash
Task: "RecordSearchView.vue 预填+autoSearch"
Task: "miniapp record-search onLoad 预填+自动搜"
```

---

## Implementation Strategy

### MVP First（仅 US1）

1. Phase 1–2 → 2. Phase 3 US1（两端只读预算）→ 3. STOP：按 quickstart §1 验收

### Incremental Delivery

1. US1 只读 → 2. US2 增删改 → 3. US3 下钻 → 4. US4 对齐抽测 → 5. 手册+宪章+quickstart 全量

### 双端约束

本切片 **Done = miniapp 与 mobile-h5 均完成**；不可只上线一端宣称交付。

---

## Notes

- [P] = 不同文件且无未完成依赖
- 搜索下钻 query 键名以 T012 为准，两端必须一致
- 进度文案/色阶以 FR-004 / T006–T007 为准，禁止两端各写一套区间
- 柱状图/折线图本切片不实现，仅饼图与可复用封装位
- 提交建议：每完成一故事或逻辑组提交一次

---

## Phase 8: Convergence

**Purpose**: 收敛实现与规格偏差（`/speckit-converge` 2026-11-10）；F1/F2 经确认保留占位页+分包，已回写 FR-009

- [x] T038 ~~改回仅 toast、禁止占位页~~ — **取消**：产品确认小程序概览/计划/资产占位页 + 独立分包为预期（FR-009 已修订）
- [x] T039 ~~移除 packageOverview/Plan/Asset~~ — **取消**：同上，保留分包占位实现
- [x] T040 修订 `docs/用户手册.md` FAQ「H5 和小程序有什么差别？」及账本底栏说明：当年预算可在小程序/H5 管理；类型/概览/计划/资产/导出仍仅电脑；未交付入口提示到电脑端 per FR-011 / SC-005 / FR-009 (`partial`)
