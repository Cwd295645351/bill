# Tasks: PC 端新增记账支持附图

**Input**: Design documents from `/specs/020-pc-add-record-images/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 规格未要求自动化测试；本列表不含 TDD/契约测试任务，以 [quickstart.md](./quickstart.md) 手工验收为准。

**Organization**: 按用户故事拆分。US1/US2 为 P1，US3 为 P2。PC 新增与编辑均为「保存时再传」。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无未完成依赖）
- **[Story]**: US1/US2/US3 对应用户故事
- 描述须含确切文件路径

## Path Conventions

本仓库触点：`frontend/src/views/record/`、`docs/用户手册.md`（默认不改 `server/`、`miniapp/`、`mobile-h5/`）

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 对齐设计边界与将改文件清单

- [x] T001 核对 `specs/020-pc-add-record-images/` 下 plan/research/data-model/contracts/pc-add-images.md/quickstart 齐全，并按 plan「Source Code」列出将改文件：`frontend/src/views/record/Record.vue`、`hooks/use-add-edit.ts`、`type.d.ts`（按需）、`docs/用户手册.md`；确认默认不改 `server/`、`miniapp/`、`mobile-h5/`，且 `batchAdd` 不传 `imageIds`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 草稿类型与「保存时再传」共用能力——编辑侧先改掉选图即传，供 US1 新增复用

**⚠️ CRITICAL**: 本阶段完成前不开始 US1–US3 业务增量

- [x] T002 在 `frontend/src/views/record/type.d.ts` 扩展照片草稿类型（如 `PhotoDraft`）：`id?`（已挂接原图才有）、`file?`（新选本地文件）、`sort`、`viewUrl`；约束对齐 data-model：每笔总数 ≤9；单张本地校验 jpeg/png/gif/webp 且 ≤10MB（10485760）
- [x] T003 重构 `frontend/src/views/record/hooks/use-add-edit.ts` 中编辑照片流程：`addEditImages` / 选图只追加本地草稿（blob 预览），**禁止**在选图事件中调用 `uploadTransactionImage`；`removeEditImage` 可删原图或本地新图并 revoke 预览 URL
- [x] T004 在 `frontend/src/views/record/hooks/use-add-edit.ts` 的 `submitEditTransaction` 中改为：先按序上传仅含 `file` 的新图 → 拼完整 `imageIds`（保留原图 id + 新 id，顺序与展示一致）→ 再 `editTransaction`；任一张上传失败则中止、不提交编辑、保留弹窗内容；上传/保存中防重复点击
- [x] T005 确认 `frontend/src/views/record/hooks/use-add-edit.ts`：关闭编辑弹窗（取消）只丢弃本地新选文件、**不调**上传（`batchAdd` 不传 `imageIds` 的核对放到 T011）

**Checkpoint**: 编辑侧已是保存时再传；可开始 US1 新增附图

---

## Phase 3: User Story 1 - 电脑上新记一笔时可附照片 (Priority: P1) 🎯 MVP

**Goal**: PC 单条新增可选附图；保存时上传并挂接；取消无脏数据；收支切换保留已选；保存前可单张删除

**Independent Test**: 新增附 1～多张保存后时间线可查看；不附图与现行为一致；选图后取消网络无 `POST /transaction/image`；切换收支后照片仍在

### Implementation for User Story 1

- [x] T006 [US1] 在 `frontend/src/views/record/hooks/use-add-edit.ts` 增加独立 `addImages`（`PhotoDraft[]`）：打开新增时初始化为空；`changeAddContainer` 取消/关闭时清空并 revoke 预览；支出/收入切换（`type` 变化）**不清空** `addImages`
- [x] T007 [US1] 在 `frontend/src/views/record/hooks/use-add-edit.ts` 实现新增侧选图/删图：本地校验（类型、≤10MB、总数≤9，提示「无法当作照片打开」/「单张照片不能超过 10MB」/「最多 9 张」）；选图不上传；可单张删除
- [x] T008 [US1] 改写 `frontend/src/views/record/hooks/use-add-edit.ts` 的 `addInfo`：有本地图时先按序 `uploadTransactionImage`，再 `addTransaction` 显式传 `imageIds`；无图时**不传** `imageIds`；上传或新增失败保留已填字段与本地已选图；保存中防重复提交
- [x] T009 [US1] 在 `frontend/src/views/record/Record.vue` 新增表单（`showAdd` 区域）增加照片区 UI：缩略图、删除按钮、多选 file input（accept jpeg/png/gif/webp）、上传/保存 loading；样式可复用编辑区 `.edit-photos` / `.photo-tip`
- [x] T010 [US1] 将 `Record.vue` 新增照片区接到 `addImages` / 选图 / 删图 / `addInfo`；保存按钮在 `saveLoading` 或照片上传中禁用；取消走清空草稿逻辑

**Checkpoint**: PC 单条新增可附图且保存时再传（SC-001 / SC-003 / SC-005 主路径）

---

## Phase 4: User Story 2 - 与现有看图、改图、权限规则对齐 (Priority: P1)

**Goal**: 新增附图不削弱权限、隔离与统计；批量解析仍不附图；他端只读一致

**Independent Test**: 同账本成员可看不可改；他账本不可见；概览金额不变；批量解析写入无照片

### Implementation for User Story 2

- [x] T011 [US2] 确认 `frontend/src/views/record/hooks/use-add-edit.ts` 的 `batchAdd` 与批量解析保存路径仍不传 `imageIds`；`Record.vue` 批量解析表格无照片列（FR-014 / SC-007）
- [x] T012 [US2] 确认时间线「查看照片」入口在 `frontend/src/views/record/Record.vue` 仍对同账本成员可用，且非记账人无编辑/删除；密钥不出现在前端源码或可复制配置中；抽查概览合计不因附图变化，导出明细仍无照片列（FR-009～FR-013）
- [x] T013 [US2] 按 `specs/020-pc-add-record-images/quickstart.md` V5/V7 做回归记录：成员只读、跨账本不可见、批量解析无图；小程序/H5 仅只读抽查、不改其源码

**Checkpoint**: 权限与批量边界无回退

---

## Phase 5: User Story 3 - 新增后仍可编辑增删，手册与界面说法同步更新 (Priority: P2)

**Goal**: 编辑增删在新上传时机下可用；界面 tip 与用户手册去掉「新记一笔不能附照片」

**Independent Test**: 新增带图账后编辑删一张补一张保存成功；界面与手册无旧限制句

### Implementation for User Story 3

- [x] T014 [US3] 更新 `frontend/src/views/record/Record.vue` 编辑区（及新增区）`photo-tip`：删除「新记一笔不能附照片」；改为与本次行为一致的限度说明（如「最多 9 张，单张不超过 10MB」或注明单条新增与编辑均可附图）
- [x] T015 [P] [US3] 更新 `docs/用户手册.md` §6.5 单条新增：补充可附照片（最多 9 张、单张不超过 10MB）；§6.6 删除「电脑上新记一笔不能附照片」，改为单条新增与编辑均可附图、同账本可看、仅记账人可增删、AI 批量解析写入不附照片（FR-015 / SC-006）
- [x] T016 [US3] 手工验收编辑路径：对 US1 新增的带图账执行删一张+补一张并保存；确认保存时才出现新文件 `POST /transaction/image`，取消编辑无上传；再删除该整笔带图账，确认同账本成员不可再打开这些照片（quickstart V6 + US3-AC3）

**Checkpoint**: 文案与编辑体验对齐规格

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 端到端对照 quickstart 收口

- [x] T017 按 `specs/020-pc-add-record-images/quickstart.md` 跑完 V1–V7 勾选清单：取消路径网络无选图即传；抽查概览/导出无回退；删整笔后不可再看图；MVP 与回归项通过
- [x] T018 全文检索 `frontend/` 与 `docs/用户手册.md`，确认无残留「新记一笔不能附照片」或「电脑上新记一笔不能附照片」

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖，可立即开始
- **Foundational (Phase 2)**: 依赖 Setup；**阻塞**所有用户故事
- **US1 (Phase 3)**: 依赖 Foundational
- **US2 (Phase 4)**: 依赖 US1 主路径可测（需有带图新账做权限抽查）；与 US3 可部分并行
- **US3 (Phase 5)**: 依赖 Foundational（编辑时机）+ US1（有带图账可测编辑）；手册/tip 可与 US2 并行
- **Polish (Phase 6)**: 依赖 US1–US3 完成

### User Story Dependencies

- **US1 (P1)**: Foundational 完成后即可；MVP
- **US2 (P1)**: 依赖 US1 产出可查看的带图明细；主要为回归确认，少改代码
- **US3 (P2)**: 编辑时机已在 Foundational；本阶段补文案与编辑验收

### Parallel Opportunities

- T014（界面 tip）与 T015（手册）可并行
- T011 与 T012 可在不同关注点上并行核对
- US2 回归与 US3 文案在 US1 完成后可由不同人并行

---

## Parallel Example: User Story 3

```bash
# 文案可并行：
Task: "更新 Record.vue photo-tip"
Task: "更新 docs/用户手册.md §6.5/§6.6"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Phase 1–2（含编辑改为保存时再传）
2. 完成 Phase 3: US1 新增附图
3. **STOP**：按 quickstart V1–V4 验收
4. 再做 US2 回归与 US3 文案

### Incremental Delivery

1. Setup + Foundational → 编辑无脏数据
2. US1 → PC 新增可附图（MVP）
3. US2 → 权限/批量回归
4. US3 → 手册与 tip
5. Polish → 全量 quickstart

---

## Notes

- [P] = 不同文件、无未完成依赖
- 不引入自动化测试框架
- 不改 `server/` 契约；上传仍用 `POST /transaction/image`，挂接仍用可选 `imageIds`
- 实现时注释用中文；标识符用英文
