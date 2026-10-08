---
description: "小程序编辑记账回填原日期的任务列表"
---

# Tasks: 小程序编辑记账回填原日期

**Input**: Design documents from `/specs/001-fix-edit-record-date/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: 规格未要求自动化测试。不要新增测试框架。验证放在最后一阶段，按 quickstart.md 手工执行。

**Organization**: 按用户故事分阶段。故事 1、2 都改 `record-form/index.ts`，必须按阶段顺序做，不能并行改同一个文件。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件，且不依赖尚未完成的任务）
- **[Story]**: 用户故事标签（US1、US2、US3）
- 描述里必须有具体文件路径

## Path Conventions

- 小程序：`miniapp/miniprogram/`
- 用户手册：`docs/用户手册.md`
- 不改：`server/`、`frontend/`、`mobile/`、`miniapp/miniprogram/pages/bill-detail/`、`miniapp/miniprogram/pages/record-search/`、`miniapp/miniprogram/pages/record-create/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 确认这是存量缺陷修复，不新建工程、不新增依赖

- [X] T001 保持 `miniapp/package.json` 的 dependencies、devDependencies、scripts 不变，日期继续使用已有 dayjs，不引入测试框架

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 提供唯一的日历日解析，供编辑回填、编辑保存、新增默认今天共用

**⚠️ CRITICAL**: 用户故事开始前必须完成本阶段

- [X] T002 在 `miniapp/miniprogram/utils/date.ts` 新增函数，把毫秒时间戳或已是 `YYYY-MM-DD` 的文本转成合法 `YYYY-MM-DD`，否则返回空字符串。约束原文：「不是这个格式的文本不能当作原日期。」失败时不得返回 `Invalid Date`，也不得调用 `today()` 填补。保留现有 `formatDay`、`formatDayLabel`、`today`、`dayStartTs` 的行为

**Checkpoint**: 日历日解析可用，用户故事可以开始

---

## Phase 3: User Story 1 - 编辑时看到这笔账原来的日期 (Priority: P1) 🎯 MVP

**Goal**: 从账本流水或搜索打开编辑时，日期格一开始就是该笔已保存的自然日，不是打开页面的当天

**Independent Test**: 准备一笔日期不是今天、且记账人是当前用户的收支。从流水和从搜索分别打开编辑，日期都与流水里该笔日期一致。原日期就是今天时，日期格显示今天。

### Implementation for User Story 1

- [X] T003 [P] [US1] 在 `miniapp/miniprogram/pages/record-edit/index.ts` 用 T002 的函数生成 `dateText`，只把合法 `YYYY-MM-DD` 交给表单。不要修改 `miniapp/miniprogram/pages/bill-detail/index.ts` 和 `miniapp/miniprogram/pages/record-search/index.ts` 的跳转，两条入口继续把原记录交给编辑页
- [X] T004 [P] [US1] 在 `miniapp/miniprogram/components/record-form/index.ts` 删除 `attached` 里无条件 `setData({ date: today() })`。存在 `initial.id` 时，日期只用合法的 `initial.dateText` 或由 `initial.date` 解析出的 `YYYY-MM-DD`。约束原文：「编辑打开后必须等于明细 `date` 的日历日。不是这个格式的文本不能当作原日期。」「`edit` 不使用这个默认值。」解析失败时日期留空，不得写成今天。金额、收支类型、分类、归属人、内容、报销进度继续回填原值。`miniapp/miniprogram/components/record-form/index.wxml` 的日期格继续绑定 `date`，不要改结构
- [X] T005 [P] [US1] 在 `docs/用户手册.md` 第 10 章之后新增只有一两句的小节，写明：小程序编辑自己的记账时，日期一开始就是这笔账原来的日期，不是打开页面的当天。不要改第 10 章手机网页端的步骤，不要补写整章小程序指南

**Checkpoint**: 用户故事 1 可独立验证。打开编辑能看到原日期；此时尚未要求堵住「空日期保存成今天」

---

## Phase 4: User Story 2 - 不改日期保存仍留在原来的那一天 (Priority: P1)

**Goal**: 编辑时不改日期就保存，该笔仍在原来的自然日；用户改了日期并保存，才改到新的一天。保存失败或未保存离开，服务端日期不变

**Independent Test**: 编辑一笔非今日记录，不碰日期，只改金额或内容后保存，流水里该笔仍在原日期分组。另开一笔把日期改成另一天后保存，只出现在新日期下。

### Implementation for User Story 2

- [X] T006 [US2] 在 `miniapp/miniprogram/components/record-form/index.ts` 的 `buildPayload` 中，存在 `recordId` 时只把合法 `YYYY-MM-DD` 交给现有 `dayStartTs`，提交该自然日 00:00 的毫秒时间戳。约束原文：「用户未改日期就保存时，写回的自然日必须与打开前相同。」「编辑时禁止在日期为空时改用今天。」契约原文：「不得提交今天。保存前提示，不发出编辑请求。」日期为空或非法时用现有 `wx.showToast` 提示并返回 null，不触发 `submit`。未改日期时提交原自然日的时间戳，不省略 `date` 字段，也不改 `server/` 的编辑接口
- [X] T007 [P] [US2] 保持 `miniapp/miniprogram/pages/record-edit/index.ts` 只在用户点击保存且 `editTransaction` 成功时返回上一页。约束原文：「保存失败，或未保存离开：明细日期保持打开前的值。」不要在页面隐藏或卸载时自动提交；`retCode !== 0` 时不要导航离开

**Checkpoint**: 用户故事 1 和 2 同时成立。正常编辑不改日期保存不会串日

---

## Phase 5: User Story 3 - 新增记账仍默认今天 (Priority: P2)

**Goal**: 小程序新记一笔时，日期仍默认打开录入页的当天；用户改过的日期按用户的选择保存

**Independent Test**: 打开新增记账，日期为今天。改成另一天后保存，该笔归在所选那一天。

### Implementation for User Story 3

- [X] T008 [US3] 在 `miniapp/miniprogram/components/record-form/index.ts` 的新增分支保留空日期时填今天。约束原文：「`add` 且日期尚空时，默认今天。`edit` 不使用这个默认值。」没有 `recordId` 时，`buildPayload` 仍用 `dayStartTs(this.data.date || today())`。`resetForAgain` 继续保留已选日期，只清空金额和内容。不要修改 `miniapp/miniprogram/pages/record-create/index.ts` 和 `miniapp/miniprogram/pages/record-create/index.wxml`

**Checkpoint**: 三条用户故事都可独立验证。新增默认今天没有被编辑修复带掉

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 按快速验证清单做一次完整手工回归

- [X] T009 按 `specs/001-fix-edit-record-date/quickstart.md` 在微信开发者工具中手工验证流水编辑、搜索编辑、跨月、跨年、未保存离开、保存失败、他人记录不可编辑、新增默认今天，以及 `docs/用户手册.md` 中的那一句说明

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无前置，可立即开始
- **Foundational (Phase 2)**: 依赖 Setup，并挡住全部用户故事
- **User Stories (Phase 3+)**: 都依赖 Foundational
  - 用户故事 2 依赖用户故事 1：保存用的是表单上已经回填的日期，且两段都改 `record-form/index.ts`
  - 用户故事 3 依赖用户故事 1：新增默认今天必须在删掉挂载时写死今天之后仍然成立；与故事 2 无行为依赖，但为避免同时改同一文件，排在故事 2 之后
- **Polish (Phase 6)**: 依赖希望交付的用户故事全部完成

### User Story Dependencies

- **User Story 1 (P1)**: Foundational 完成后即可开始，不依赖其他故事
- **User Story 2 (P1)**: 依赖用户故事 1。只做保存兜底、不先回填原日期时，日期格仍是今天，不改就保存还会写成今天
- **User Story 3 (P2)**: 依赖用户故事 1 对 `attached` 的修改。不依赖故事 2 的保存兜底，但实现顺序放在故事 2 之后

### Within Each User Story

- 先做 T002 的日历日解析，再改编辑页和表单
- 同一文件内的任务按 T004 → T006 → T008 顺序改 `miniapp/miniprogram/components/record-form/index.ts`
- 不写自动化测试，不用「先写失败测试」

### Parallel Opportunities

- T003、T004、T005 位于不同文件，Foundational 完成后可以并行
- T007 与 T006 位于不同文件，可以并行；T007 须在 T003 之后，因为都改编辑页
- T006、T008 与 T004 同文件，不可并行
- 用户故事 2、3 不要和用户故事 1 同时改 `record-form/index.ts`

---

## Parallel Example: User Story 1

```bash
# Foundational 完成后可同时进行：
Task: "在 miniapp/miniprogram/pages/record-edit/index.ts 生成合法 dateText"
Task: "在 miniapp/miniprogram/components/record-form/index.ts 去掉挂载时写成今天，编辑分支回填原日期"
Task: "在 docs/用户手册.md 第 10 章后补一句小程序编辑日期说明"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational
3. 完成 Phase 3: User Story 1
4. **停下来验证**：从流水和搜索打开一笔非今日记录，日期格是原日期
5. 这只证明「看得到原日期」。用户报告的「不改就保存被挪到今天」要等 User Story 2 才算堵住空日期误提交

### Incremental Delivery

1. Setup + Foundational → 日历日解析就绪
2. User Story 1 → 打开编辑看到原日期（MVP）
3. User Story 2 → 不改日期保存仍在原日，改了才换日
4. User Story 3 → 新增仍默认今天
5. Polish → 按 quickstart.md 做完整手工回归

### Parallel Team Strategy

人力有限时按顺序做。若两人并行，只能拆开不同文件：

1. 一起完成 T001、T002
2. 之后一人改 `miniapp/miniprogram/components/record-form/index.ts`（T004 → T006 → T008），另一人改 `miniapp/miniprogram/pages/record-edit/index.ts`（T003 → T007）并写 `docs/用户手册.md`（T005）
3. 不要两人同时改记账表单

---

## Notes

- [P] 表示不同文件且不依赖未完成任务
- 故事标签只出现在用户故事阶段
- 编辑接口路径、字段名 `date`、毫秒时间戳单位都不改
- 搜索筛选的开始日和结束日、预算年度、计划日期都不在本次任务里
- 每完成一个阶段就可以按该故事的 Independent Test 停下来检查

---

## Phase 7: Convergence

- [X] T010 复核并处理规格、计划和既有任务都未要求的忽略文件：根目录 `.gitignore` 里新增的 `dist/`、`build/`、`*.log`、`.env`、`.env.*`，以及 `frontend/.prettierignore`、`mobile/.prettierignore`。与本次编辑日期修复无关则撤掉，有独立理由则在任务旁注明后保留 per plan: Project Structure (unrequested)。已撤掉：这些规则只来自通用忽略文件检查，不服务于编辑日期回填。
