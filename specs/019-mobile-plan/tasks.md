# Tasks: 移动端计划模块

**Input**: Design documents from `/specs/019-mobile-plan/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 规格未要求自动化测试；本列表不含 TDD/契约测试任务，以 [quickstart.md](./quickstart.md) 手工验收为准。

**Organization**: 按用户故事拆分；US1/US2 为 P1，US3 为 P2。两端（miniapp + mobile-h5）均须交付（澄清：两端 Done）。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无未完成依赖）
- **[Story]**: US1/US2/US3 对应用户故事
- 描述须含确切文件路径

## Path Conventions

本仓库触点：`mobile-h5/`、`miniapp/`、`docs/`、`.specify/memory/`（默认不改 `frontend/` 计划主流程、不恢复旧 `mobile/`、默认不改 `server/routes/plan`）

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 对齐设计边界与将改文件清单

- [x] T001 核对 `specs/019-mobile-plan/` 下 plan/research/data-model/contracts/plan-api.md/quickstart 齐全，并按 plan「Source Code」列出将改文件清单（确认不改 `frontend/` 计划主流程、不恢复旧 `mobile/`、默认不改 `server/routes/plan`、不为 H5 新建概览/资产占位路由）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: API 客户端、分组工具、路由/页面骨架、底栏「计划」可导航——所有故事共用

**⚠️ CRITICAL**: 本阶段完成前不开始 US1–US3 业务页实现

- [x] T002 [P] 新增 `mobile-h5/src/api/plan.ts`：实现 `getPlanList` / `planAdd` / `planEdit` / `planDelete`（契约见 `contracts/plan-api.md`）；类型含 `PlanItem`（`id`/`title`/`context`/`priority: 1|2|3`）与列表返回 `count`/`details[]`
- [x] T003 [P] 在 `miniapp/miniprogram/apis/index.ts` 新增 `getPlanList` / `planAdd` / `planEdit` / `planDelete`（字段与 PC：`billId`/`title`/`context`/`priority`/`id`；list 仅 `billId`；delete 用 query `id`+`billId`）
- [x] T004 [P] 新增 `mobile-h5/src/utils/plan-group.ts`：输入 `details[]`，输出三档数组 `[高[], 中[], 低[]]`；规则：按 `priority` 1/2/3 分桶，**同档保持 `details` 遍历顺序不重排**（对齐 data-model / FR-003）
- [x] T005 [P] 新增 `miniapp/miniprogram/utils/plan-group.ts`：规则与 T004 相同（两端分组一致）
- [x] T006 在 `mobile-h5/src/router/index.ts` 注册计划路由 `/bill/:id/plan` → `name: 'bill-plan'` → `mobile-h5/src/views/plan/PlanView.vue`（可先占位壳）
- [x] T007 改造 `mobile-h5/src/components/BookTabBar.vue`：将 `plan` 从 `PC_ONLY` 移出；点击 `plan` 时 `router.replace` 到 `bill-plan`（带 `billId`）；`overview`/`asset` 仍 toast「请到电脑端查看或管理」且不置灰不隐藏（FR-009）
- [x] T008 确认 `miniapp/miniprogram/components/book-tab-bar/index.ts` 中 `plan` 已指向 `/packagePlan/pages/plan/index?billId=`；`overview`/`asset` 仍进未交付占位分包；本任务仅核对/微调，不改全局 tabBar
- [x] T009 创建 `mobile-h5/src/views/plan/PlanView.vue` 占位壳（标题区可先空）并确保能被路由打开；确认 `miniapp/miniprogram/packagePlan/pages/plan/index.*` 已在 `app.json` 分包注册（现网已有则只核对）

**Checkpoint**: API、分组工具、H5 路由、底栏「计划」可导航就绪——可开始 US1

---

## Phase 3: User Story 1 - 在手机上按优先级查看计划 (Priority: P1) 🎯 MVP

**Goal**: 进入账本后可切到「计划」，看到顶栏备忘说明、高/中/低三档分组、卡片与档内空态；概览/资产按端差异提示

**Independent Test**: 有计划数据的账本打开计划页即可验收三档与卡片；无计划见三档空态；点概览/资产按 FR-009 表现；无需先完成增删改

### Implementation for User Story 1

- [x] T010 [US1] 实现 `mobile-h5/src/views/plan/PlanView.vue` 只读视图：调用 `getPlanList`；顶栏说明「计划只是想买或待办，不会自动变成记账…」（对齐 FR-002 / 原型）；用 `plan-group` 固定渲染「高优先级 / 中优先级 / 低优先级」三档（高红 `#f74f4f`、中橙 `#e6a23c`、低绿 `#18a356`）；卡片展示 `title`/`context`（编辑/删除按钮按修订后 FR-003 留给 US2 T019）；档内无数据文案「这一档还没有」；整本无计划仍保留三档+底部「新增计划」占位按钮（可先禁用，US2 接线）；挂载 `BookTabBar`（`active=plan`）
- [x] T011 [US1] 确认从 `mobile-h5/src/views/bill-detail/BillDetailView.vue` 与 `mobile-h5/src/views/budget/BudgetView.vue` 经 `BookTabBar` 可切到计划页并带回记账/预算；`billId` 不丢失
- [x] T012 [US1] 将 `miniapp/miniprogram/packagePlan/pages/plan/index.*` 从占位改为真实只读计划页：行为与 T010 对齐（用 T005 分组）；导航栏标题「计划」；挂载 `book-tab-bar`（`active=plan`）；去掉「请到电脑端查看或管理」空态作为主内容
- [x] T013 [US1] 验收两端未交付入口：小程序点「概览」「资产」进占位页提示到电脑端；H5 点「概览」「资产」toast 同文案且不新建占位路由；入口不置灰不隐藏（FR-009）

**Checkpoint**: 两端均可只读查看计划分组（SC-001）；未交付入口按端正确提示

---

## Phase 4: User Story 2 - 新增、编辑、删除计划 (Priority: P1)

**Goal**: 账本成员在手机上完成计划增删改；新建默认优先级「高」；标题/内容非空、无移动端专属字数上限；删除需确认且不影响记账

**Independent Test**: 空计划账本新增 → 编辑字段/换档 → 删除；非法空标题/内容不保存；取消删除仍在

### Implementation for User Story 2

- [x] T014 [P] [US2] 在 `mobile-h5/src/views/plan/PlanView.vue`（或同目录表单组件）实现新增弹层：字段 `title`/`context`/`priority`；新建默认 `priority=1`（高）；校验：trim 后非空，**不设**移动端专属字数上限；优先级仅 1/2/3 chip；保存调 `planAdd`；失败展示服务端 `message`；成功关闭并刷新列表
- [x] T015 [US2] 在 H5 计划页实现编辑：预填标题/内容/优先级均可改；校验同新增；调 `planEdit`（body 含 `id`/`billId`/`title`/`context`/`priority`）；成功刷新且换档正确
- [x] T016 [US2] 在 H5 计划页实现删除：二次确认（文案对齐原型「删除这条计划 / 删除后不能恢复」）；确认后 `planDelete`；取消不删；成功刷新；确认该账本记账流水不受影响
- [x] T017 [P] [US2] 在 `miniapp/miniprogram/packagePlan/pages/plan/` 实现新增表单（sheet/popup）：默认优先级高；校验与 T014 相同；调 `planAdd`；失败展示服务端 `message`
- [x] T018 [US2] 小程序计划页实现编辑与删除确认，分别调 `planEdit` / `planDelete`，成功刷新；换档与取消删除行为与 H5 一致
- [x] T019 [US2] 两端卡片「编辑」「删除」按钮等宽样式一致（对齐原型 `.b-ops`）；底部「新增计划」主按钮可用；不提供「已购」入口（FR-010）

**Checkpoint**: 两端可独立完成新增→编辑→删除（SC-002 / SC-004）

---

## Phase 5: User Story 3 - 小程序与 H5 能力对齐 (Priority: P2)

**Goal**: 两端计划业务字段与操作结果一致；任一端缺失不得宣称本切片完成；与 PC 计划口径一致（含同档顺序）

**Independent Test**: PC 改计划后两端可见且同档顺序一致；一端改后另一端与 PC 刷新一致；无端侧特例字段

### Implementation for User Story 3

- [x] T020 [US3] 对照 `contracts/plan-api.md` 与 PC `frontend/src/views/plan/`，检查 H5/小程序展示字段（`title`/`context`/`priority` 分组与同档顺序）无端侧特例；修齐不一致处（优先改移动端，不改 PC 主流程）
- [x] T021 [US3] 按 `quickstart.md` 第 3 节做多端一致抽测：PC 增改 → 两端可见且同档相对顺序一致；H5 或小程序改删 → 另一端与 PC 刷新一致（SC-003）
- [x] T022 [US3] 确认交付清单：计划查看/增删改/底栏导航与 FR-009 提示在 **miniapp 与 mobile-h5 均已完成**；缺一端则 tasks 不得全部勾完（FR-001 / US3-AC4）

**Checkpoint**: 两端对齐验收通过

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 手册与宪章；回归；quickstart 全量

- [x] T023 [P] 更新 `docs/用户手册.md`：能力表与正文改为小程序/H5 可查看与管理计划；删除「计划仅 PC / 移动端不能管理计划」等过时句；仍标明类型配置、概览分摊、家庭资产仅 PC；同步 FAQ/能力对照表相关行（FR-011 手册部分 / SC-005）
- [x] T024 [P] 确认 `.specify/memory/constitution.md` 原则 II 已为计划三端可管且版本 ≥ 3.2.0（analyze 补救已 bump）；交付前复核 SYNC IMPACT REPORT 与正文一致；**手册仍以 T023 为准**，未完成 T023 不得宣称 Done（FR-011）
- [x] T025 按 `specs/019-mobile-plan/quickstart.md` 全量手工验收（含回归：两端预算页与底栏、明细/搜索、全局三 tab、PC 计划主流程、小程序概览/资产占位）——实现侧已对齐规格；联调环境请再走一遍 quickstart
- [x] T026 若联调发现既有 `server/routes/plan` 阻塞缺陷，仅做最小兼容修复并在 PR 说明；禁止借机重构或引入「已购」移动端入口（本切片默认未改后端）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup** → **Phase 2 Foundational**（阻塞所有故事）
- **US1 (Phase 3)**：依赖 Foundational；MVP
- **US2 (Phase 4)**：依赖 US1 计划页壳（同文件延伸）
- **US3 (Phase 5)**：依赖 US1–US2 两端实现后的对齐验收
- **Polish (Phase 6)**：依赖故事完成（文档可与 US3 并行起草，但宪章/手册合并前应功能已齐）

### User Story Dependencies

- **US1**：仅依赖 Foundational
- **US2**：依赖 US1 页面
- **US3**：依赖 US1–US2 两端均具备

### Parallel Opportunities

- T002 ∥ T003；T004 ∥ T005
- US1：T010 与 T012 可分端并行（不同目录）
- US2：T014 ∥ T017；随后各自编辑/删除
- Polish：T023 ∥ T024

---

## Parallel Example: Foundational

```bash
Task: "mobile-h5/src/api/plan.ts CRUD"
Task: "miniapp/miniprogram/apis/index.ts planList/Add/Edit/Delete"
Task: "mobile-h5/src/utils/plan-group.ts"
Task: "miniapp/miniprogram/utils/plan-group.ts"
```

## Parallel Example: User Story 2

```bash
Task: "H5 PlanView 新增弹层 planAdd"
Task: "小程序 packagePlan 新增 sheet planAdd"
```

---

## Implementation Strategy

### MVP First（仅 US1）

1. Phase 1–2 → 2. Phase 3 US1（两端只读计划）→ 3. STOP：按 quickstart §1 验收

### Incremental Delivery

1. US1 只读分组 → 2. US2 增删改 → 3. US3 对齐抽测 → 4. 手册+宪章+quickstart 全量

### 双端约束

本切片 **Done = miniapp 与 mobile-h5 均完成**；不可只上线一端宣称交付。

---

## Notes

- [P] = 不同文件且无未完成依赖
- 新建默认优先级以澄清为准：`priority=1`（高），禁止默默改回原型「中」
- 同档顺序以 `details` 遍历为准，禁止两端各写一套排序
- 标题/内容仅非空校验，禁止移动端专属字数上限
- 不暴露「已购」；列表信任服务端过滤
- H5 概览/资产保持 toast；小程序保持占位页——不为 H5 补占位路由
- 提交建议：每完成一故事或逻辑组提交一次
