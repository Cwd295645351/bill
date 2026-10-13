---

## description: "概览统计支持多人分账"

# Tasks: 概览统计支持多人分账

**Input**: Design documents from `/specs/003-overview-multi-split/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: 规格未要求自动化测试。不要新增测试框架，也不要改 `server/package.json` 的 test 脚本。验证放在最后一阶段，按 quickstart.md 手工执行。

**Organization**: 按用户故事分阶段。用户故事 1 和 2 都是 P1，按规格中的先后实现。`server/database/services/overviewSettlement.js` 在基础阶段写完；`frontend/src/views/overview/hooks/use-type-chart.ts` 与 `frontend/src/views/overview/Overview.vue` 按故事顺序改，不能并行改同一个文件。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件，且不依赖尚未完成的任务）
- **[Story]**: 用户故事标签（US1、US2、US3）
- 描述里必须有具体文件路径



## Path Conventions

- 服务端：`server/routes/overview/`、`server/database/services/`
- 电脑端：`frontend/src/views/overview/`
- 手册：`docs/用户手册.md`
- 手机网页 `mobile/` 与小程序 `miniapp/` 本次不调用结算接口



## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 加上结算结果的类型和调用入口。不新增依赖，不改表

- [x] T001 [P] 在 `frontend/src/views/overview/type.d.ts` 增加结算响应类型，字段与 `specs/003-overview-multi-split/contracts/overview-settlement.md` 一致：`members`（仅当前成员，含 `userId`、`name`、`effectiveIncome`、`weight`、`paid`、`borne`、`net`）、`lines`、`transfers`（`fromUserId`、`fromName`、`toUserId`、`toName`、`amount`）、`pies.all`、`pies.members`。响应里不要 `publicAllocations`。不要改 `BelongUser` 里总支出、总收入、总投资、总消费的含义
- [x] T002 [P] 在 `frontend/src/views/overview/api.ts` 增加 `getSettlement`，用现有 `OVERVIEW.post('/settlement')`。不要改 `getBalance` 与 `getThreeYearCost`

---



## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 服务端按每一笔支出算出分摊、净额、转账文案、支出结构份额。所有用户故事都读这个结果

**⚠️ CRITICAL**: 用户故事开始前必须完成本阶段

- [x] T003 在 `server/database/services/overviewSettlement.js` 实现纯函数 `buildSettlement`，不访问数据库、不写表。约束原文照此实现：「金额先换成整数分；当前成员按调用方给出的 `bill_users.id` 升序；`type` 为 1 的支出参与垫付和承担，`type` 为 2 的收入只参与有效收入，其它值忽略；`reimbursement` 不作为过滤条件，也不改变金额；`belong_user_id` 空或未填视为全部；有效收入 = 归属到本人的收入 − 已启用规则扣减，可以为负；权重为有效收入小于 0 时的 0，否则等于有效收入；全体权重都是 0 时本次改为每人权重 1；数量扣减 = 数量 × 规则上的 `unit_price`，四舍五入到分，单价不采用请求里的值；指定支出类型只扣归属人就是该成员的该类支出；归属为全部的公共支出先加总，再按权重只分一次，除最后一名外四舍五入到分且不超过尚未分出的金额，最后一名拿剩余，每人份额不小于 0，合计等于公共支出总额；不要把逐笔四舍五入的结果相加当作总账；个人饼图按类型使用与这次合计一致的份额；不返回 `publicAllocations`；净额 = 垫付 − 承担；转账按 research.md 第 5 节匹配，0 元不出现，笔数不超过参与人数减 1，同一人不同时收付；支出类型基金 `1015` 照常进入分账；局外人不进入 `members` 和 `pies.members`，但净额非 0 时进入 `transfers`；一名当前成员且没有非零净额时 `lines` 为「无需分账」；恰好两名当前成员且没有局外人时，结清为「双方结清，无需转账」，否则一行「甲 → 乙 转 N.NN 元」；三名及以上或有局外人时，结清为「各方结清，无需转账」，否则逐行「付款人 → 收款人 转 N.NN 元」；一名当前成员时 `pies.members` 为空数组。」不要在此文件重算总支出、总投资、总消费、总收入
- [x] T004 在 `server/routes/overview/index.js` 增加 `POST /api/v1/overview/settlement`，在 `server/routes/overview/controller.js` 取数并调用 `buildSettlement`。缺少账本或起止时间时，message 与现有 `GET /balance` 一致，原文是「账本id不能未空」「开始时间不能为空」「结束时间不能为空」，不要改这两个 GET 的路径、参数和响应字段。当前用户不是 `bill_users` 中的成员时拒绝，message 为「不是该账本成员」，且 `data` 为空。数量小于 0 时拒绝，message 含「数量不能为负」和该规则名称。`ruleId` 不是本账本已启用的数量规则时拒绝，message 含「数量规则不存在或未启用」。数量大于 0 但 `belongUserId` 不是当前成员时拒绝，message 含「归属人不是该账本成员」。成员查询 `order: [['id', 'ASC']]`。区间与 `isDel: false` 的过滤和 `GET /balance` 相同。未提交的已启用数量规则按数量 0。不要改 `GET /threeYearCost`

**Checkpoint**: 用结算接口能拿到三人平摊的 `lines`。响应不含 `publicAllocations`。电脑端尚未展示

---



## Phase 3: User Story 1 - 三名及以上成员能按全体分摊并知道该转给谁 (Priority: P1) 🎯 MVP

**Goal**: 电脑端点查询后，看到全体当前成员的转账建议，而不是只在前两名之间结算。未再点查询时建议不变

**Independent Test**: 按 `specs/003-overview-multi-split/quickstart.md` 第 1 到第 4 节以及第 7 节。三人平摊 300 元时文案为「乙 → 甲 转 100.00 元」和「丙 → 甲 转 100.00 元」。只改日期或数量、不点查询时，文案保持上一次

### Implementation for User Story 1

- [x] T005 [US1] 在 `frontend/src/views/overview/hooks/use-type-chart.ts` 的查询函数里，在现有 `getBalance` 之后调用 `getSettlement`。请求体只含 `billId`、`beginDate`、`endDate` 和 `quantityInputs`（`ruleId`、`quantity`、`belongUserId`），不传单价。总支出、总投资、总收入仍用 `getBalance` 的返回值，总消费仍为总支出减去总投资。把 `lines` 存下来供页面显示。结算失败时保留上一次成功的 `lines`，并用现有方式提示错误。修改日期或数量规则的输入不得触发查询。不要用成员列表前两名在浏览器里重算应退。不要改左侧明细目前「只列出收入行」的筛选，分账不读取这些行
- [x] T006 [US1] 在 `frontend/src/views/overview/Overview.vue` 用 `lines` 逐行显示结算建议，替换现在只显示一条 `refundText` 的位置。三行及以上都必须可见，不能只渲染第一条。查询按钮仍是唯一的刷新入口

**Checkpoint**: 用户故事 1 可独立验证。三人、四人的转账建议已出现在概览上。个人支出结构仍可能是旧的前两名算法，留到用户故事 3

---



## Phase 4: User Story 2 - 两人账本的应退结果和读法保持不变 (Priority: P1)

**Goal**: 两人账本继续看到「甲 → 乙 转 N 元」或「双方结清，无需转账」。浏览器里不再残留只按前两名轧差的旧计算

**Independent Test**: 按 `specs/003-overview-multi-split/quickstart.md` 第 5 节。例 1 为乙转甲 100 元；例 2 为乙转甲 300 元；收入 6000 与 4000、公共支出 1000 时为乙转甲 400 元；有效收入都是 0 时仍按 1:1；结清时没有 0 元转账。该笔改为已报销、待报销或已提交时，应退仍是乙转甲 100 元

### Implementation for User Story 2

- [x] T007 [US2] 在 `frontend/src/views/overview/hooks/use-type-chart.ts` 删除 `calculateMoney`，以及只用 `users[0]` 与 `users[1]` 拼出的 `refundText`（包括「应退金额：甲 → 乙 转 N 元」和「双方结清，无需转账」的浏览器拼句）。两人、多人和一名成员的文案都只显示服务端 `lines`。不要在这个文件里按收入比例再乘一遍公共支出

**Checkpoint**: 用户故事 1 和 2 的文案都来自结算接口。支出结构饼图可以仍是旧图

---



## Phase 5: User Story 3 - 每人都能看到自己该承担的支出结构 (Priority: P2)

**Goal**: 「全部」仍是未拆分的整体。两名及以上成员时每人一张图，含本人支出和分到的公共支出。明细只显示记账金额，不再展示分账后的金额

**Independent Test**: 按 `specs/003-overview-multi-split/quickstart.md` 第 1、2、4、6、8 节里关于支出结构的预期。三人时甲的图里公共 300 元只显示 100。点开明细时金额列是记账原金额，没有分账后的金额。一名成员时只有「全部」，文案为「无需分账」

### Implementation for User Story 3

- [x] T008 [US3] 在 `frontend/src/views/overview/hooks/use-type-chart.ts` 用结算结果的 `pies.all` 与 `pies.members` 画支出结构，删除把「全部」只分给前两名的 `setTypeData` 比例分摊。一名当前成员时图表数量为 1，只画「全部」。两名及以上时图表数量为当前成员人数加 1，顺序为「全部」然后 `members` 的顺序。点「全部」或某一成员时，明细金额都用记账原金额，不要用份额替换，也不要读取 `publicAllocations`。点某一成员时，只保留归属该成员或归属「全部」的记录。归属其他成员的记录不出现
- [x] T009 [US3] 在 `frontend/src/views/overview/Overview.vue` 用 `el-scrollbar` 滚动右侧图表区。`.belong-type-container` 用三列 grid，不限制总高度，单行高度 `393px`，间距 `10px`。每张图保持可点。弹窗只保留一列金额，列名是「金额」，显示记账原金额，不要「原金额」和分账后的金额两列

**Checkpoint**: 三名及以上成员能逐张看到自己的支出结构。饼图上的份额来自公共支出加总后只分一次的结果。明细金额是记账原金额

---



## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 手册与手工验收。不改手机网页和小程序

- [x] T010 [P] 更新 `docs/用户手册.md` 的 3.6、7.1、7.3、12.2、12.3。删掉「三人及以上只按成员列表中的前两名来计算」以及「饼图只显示前两名」。写明公共支出和应退按全体当前成员计算；两人仍是「甲 → 乙 转 N 元」或「双方结清，无需转账」。补一个三人例子：甲付 300 元且归属全部、有效收入相同，乙和丙各转甲 100 元。不要重写其它章节
- [ ] T011 按 `specs/003-overview-multi-split/quickstart.md` 从头到尾做一遍。第 9 节确认 `mobile/` 与 `miniapp/` 没有结算入口，且 `GET /api/v1/overview/balance`、`GET /api/v1/overview/threeYearCost` 的字段与改动前一致

---



## Dependencies & Execution Order



### Phase Dependencies

- **Setup (Phase 1)**: 无依赖，可立即开始
- **Foundational (Phase 2)**: 依赖 Setup 完成 — 挡住全部用户故事
- **User Stories (Phase 3+)**: 都依赖 Foundational。本功能的故事要按顺序做，因为后一个故事会改前一个故事动过的文件
- **Polish (Phase 6)**: 依赖希望交付的用户故事都已完成



### User Story Dependencies

- **User Story 1 (P1)**: Foundational 完成后即可开始。不依赖故事 2、3
- **User Story 2 (P1)**: 依赖故事 1 已把 `lines` 接到页面。只删除浏览器里的旧轧差，不改结算公式
- **User Story 3 (P2)**: 依赖故事 1 的查询结果。饼图和下钻改的是同一对前端文件，排在故事 2 之后



### Within Each User Story

- 先有服务端结果，再接到查询，再改页面
- 本功能没有先写失败测试的任务
- 一个故事验收通过再进入下一个



### Parallel Opportunities

- T001 与 T002 可以并行（类型文件和 api 文件互不依赖）
- T010 只改手册，可与故事 3 的页面任务并行；若只派一个人，放在故事完成之后
- T003 与 T004 不能并行。T005、T006、T007、T008、T009 不能并行，它们依次改同一条前端调用链
- 用户故事 1、2、3 不要分给不同的人同时改 `use-type-chart.ts`

---



## Parallel Example: Phase 1

```bash
# 类型和请求可以同时做：
Task: "在 frontend/src/views/overview/type.d.ts 增加结算响应类型"
Task: "在 frontend/src/views/overview/api.ts 增加 getSettlement"
```

---



## Implementation Strategy



### MVP First (User Story 1 Only)

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational（结算接口已能返回正确 `lines`）
3. 完成 Phase 3: User Story 1
4. **停下来验收**: quickstart 第 1 到第 4 节和第 7 节
5. 三人家庭此时已能按文案转账。两人文案的旧浏览器计算要等故事 2 删掉



### Incremental Delivery

1. Setup + Foundational → 接口可单独调用
2. 用户故事 1 → 多人转账建议出现在概览上（MVP）
3. 用户故事 2 → 两人读法锁定为服务端文案
4. 用户故事 3 → 每人一张支出结构。明细只显示记账金额
5. 手册与 quickstart 全文验收



### Parallel Team Strategy

本功能不适合多人同时改概览页面。可以一人做 T001，另一人做 T002；Foundational 之后由同一人按故事 1 → 2 → 3 顺序改 `use-type-chart.ts` 和 `Overview.vue`。手册 T010 可另派人。

---



## Notes

- [P] 只表示不同文件且不依赖未完成任务
- 不要把总支出、总投资、总消费、总收入挪到结算接口
- 不要修改 `mobile/` 与 `miniapp/`
- 左侧明细行是否展示支出不在本次任务里
- 每个任务或每一组逻辑完整的任务结束后再提交

---

## Phase 7: Convergence

- [x] T012 不改 `frontend/src/views/overview/Overview.vue`。饼图三列网格、单行 `393px`、间距 `10px` 即为当前实现，T009 已按此写明 per T009 (contradicts)

