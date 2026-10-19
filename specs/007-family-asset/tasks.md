---

description: "家庭资产"
---

# Tasks: 家庭资产

**Input**: Design documents from `/specs/007-family-asset/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: 规格未要求自动化测试。不要新增测试框架，也不要改 `server/package.json` 或仓库根目录的 `test` 脚本。验证放在最后一阶段，按 quickstart.md 手工执行。服务端改完后只跑已有的 `npm run typecheck --prefix server`。

**Organization**: 按用户故事分阶段。用户故事 1 到 4 都是 P1，按规格中的先后实现。`frontend/src/views/asset/Asset.vue` 每个故事只改自己的那一块，不能并行改这一个文件。统计口径分属 `statisticsController.ts` 的不同函数，按故事顺序改这一个文件。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件，且不依赖尚未完成的任务）
- **[Story]**: 用户故事标签（US1–US9）
- 描述里必须有具体文件路径

## Path Conventions

- 服务端：`server/routes/asset/`、`server/database/services/`
- 电脑端：`frontend/src/views/asset/`、`frontend/src/components/layout/hooks/use-layout.ts`、`frontend/src/utils/api-services/index.ts`
- 手册：`docs/用户手册.md`（第 10 章已有草稿，最后核对用词）
- 小程序 `miniapp/` 本次不新增资产入口

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 接上现有资产网关，并放好空的资产页。不新增依赖，不改表

- [X] T001 [P] 在 `frontend/src/utils/api-services/index.ts` 增加 `ASSET`，前缀为 `` `/api/${version}/asset` ``，写法与现有 `OVERVIEW` 相同。不要改其它网关
- [X] T002 [P] 新建 `frontend/src/views/asset/router.ts`，路由为 `/layout/asset`，名称为 `Asset`，组件指向 `./Asset.vue`。不要新增第二种路由收集方式
- [X] T003 [P] 新建 `frontend/src/views/asset/api.ts`，用 `ASSET` 封装契约 `specs/007-family-asset/contracts/asset-api.md` 里的现有路径：成员、资产、盘点、`list`、`list-stats`、`overview`、`four-money`、`sankey`、`monthly-report`。不要新造路径
- [X] T004 [P] 新建 `frontend/src/views/asset/type.d.ts`，类型与 `specs/007-family-asset/data-model.md`、`contracts/asset-api.md` 一致。资产类型存储值为 `living`、`steady`、`longterm`、`receivable`、`debt`；四笔钱存储值为 `living`、`steady`、`longterm`、`insurance`。页面展示中文名
- [X] T005 [P] 在 `frontend/src/components/layout/hooks/use-layout.ts` 的账本菜单末尾增加「资产」，路由 `/layout/asset`。未进入账本时不要出现这项。不要改记账、概览、预算、计划的菜单项
- [X] T006 [P] 新建 `frontend/src/views/asset/Asset.vue` 空页面：进入账本后能打开，预留页签「总览、四笔钱、构成、月历、资产趋势」和成员筛选「全部」。弹窗先不实现。版式参照 `prototypes/family-asset.html`，不要把原型脚本拷进页面

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 账本成员校验、当前金额重算、负债标记回填。所有用户故事都依赖这些规则

**⚠️ CRITICAL**: 用户故事开始前必须完成本阶段

- [X] T007 [P] 在 `server/routes/asset/index.ts` 为每条 `/api/v1/asset` 路由确认当前登录用户属于目标账本的 `bill_users`。账本 id 来自请求；盘点只带资产 id 时，先读出资产的 `bill_id` 再检查。不是成员时失败，message 为「无权查看该账本」，`data` 为空。未登录仍走现有登录校验。不要改路径
- [X] T008 [P] 在 `server/database/services/assetRecordService.ts` 增加两个纯能力，供创建、修改、删除盘点后调用。约束原文：「新增、修改、删除盘点之后，都按未删除盘点的日期从新到旧重算当前金额和最近更新日期。新增一条更早的盘点，不得把当前金额改成那条更早的金额。同一资产、同一自然日有多条时，不新增列：保存时把本次记录的时间放在该自然日已有时间戳之后 1 毫秒，并且仍落在这一天之内。」不要给 `asset_records` 加列
- [X] T009 [P] 新建 `server/database/services/assetDebtBackfill.ts`，提供可重复执行的回填，不改表结构。约束原文：「`type = debt` 且 `is_debt` 仍为假的未隐藏资产，把 `is_debt` 改为真。重复执行结果相同。」不要在服务启动时自动跑

**Checkpoint**: 非成员调用资产接口会被拒绝。回填函数可单独执行。电脑端还只有空的资产页

---

## Phase 3: User Story 1 - 维护家庭资产成员 (Priority: P1) 🎯 MVP

**Goal**: 在当前账本维护只有名字的资产成员。删除只隐藏名字，不改写其名下资产

**Independent Test**: 新增一名没有记账账号的家人，把一笔资产记在他名下（可用已有创建接口），再隐藏这名成员。名单里看不到他，这笔资产还在，家庭合计金额不变

### Implementation for User Story 1

- [X] T010 [P] [US1] 在 `server/routes/asset/memberController.ts` 保持现有路径。名单只返回 `is_del` 为假的成员。`name` 为空时不得创建或改名。删除只把该成员 `is_del` 设为真，不得删除或改写 `assets` 里引用该 `member_id` 的行，也不得改这些资产的金额。改名后仍引用该成员的资产显示新名字
- [X] T011 [P] [US1] 新建 `frontend/src/views/asset/hooks/use-members.ts`，调用 `frontend/src/views/asset/api.ts` 完成名单、新增、改名、隐藏。不要把资产成员写成记账成员，也不要调用账本成员接口
- [X] T012 [US1] 在 `frontend/src/views/asset/Asset.vue` 增加「成员」弹窗：可新增、改名、删除。删除前写明「只隐藏该成员，名下资产仍计入家庭合计」。已隐藏的名字不再出现在名单里

**Checkpoint**: 用户故事 1 可独立验证。资产登记表单可以还没有

---

## Phase 4: User Story 2 - 登记并维护一笔资产 (Priority: P1)

**Goal**: 登记一笔资产并自动留下当天盘点。只有金额变化才再添盘点。负债不计入总资产

**Independent Test**: 登记一笔大于 0 的非负债资产，列表里能看到它，并带有一条盘点。再把类型改成负债，它从总资产挪到总负债，盘点条数不因只改类型而增加

### Implementation for User Story 2

- [X] T013 [P] [US2] 在 `server/routes/asset/assetController.ts` 的创建和编辑中落实数据模型。约束原文：「当前金额必须是大于 0 的数字。任一不满足时，登记必须失败并说明原因，且不得产生资产或盘点。」「类型为 `debt` 时 `is_debt` 为真，否则为假。类型为 `debt` 时 `fourMoneyType` 为空字符串，不要求四笔钱。」「四笔钱不是 `insurance` 或类型为负债时，保存把险种和年交保费清空。」「只有当前金额的数值发生变化时，保存才新增一条盘点。只修改名称、成员、分类或保险信息时，不得新增盘点。」创建成功时自动写一条盘点，日期为登记当时，金额为当前金额。金额比较使用数值，避免 `100` 与 `100.00` 被当成两次盘点。删除资产时同时隐藏其盘点。`GET /list` 继续支持按 `memberId`、`type`、`fourMoneyType` 筛选，且只返回未隐藏资产
- [X] T014 [P] [US2] 新建 `frontend/src/views/asset/hooks/use-asset-form.ts`。类型为负债时不提交四笔钱。四笔钱不是保险时不提交险种和年交保费。类型为负债时表单状态能区分「计入负债」。编辑时若金额数值未变，向页面提供「本次不会新增盘点」
- [X] T015 [US2] 在 `frontend/src/views/asset/Asset.vue` 完成登记和编辑弹窗，并先用 `GET /list` 列出当前筛选下的资产。字段为名称、成员、资产类型、当前金额。资产类型不是负债时再填四笔钱；类型为负债时不展示四笔钱。四笔钱选「保险」时才展示险种和年交保费；选活钱、稳健或长期时不展示。类型选「负债」时说明计入负债、不计入总资产。金额为空、不是数字或不大于 0 时不提交。成员下拉只用来自用户故事 1 的未隐藏资产成员

**Checkpoint**: 用户故事 2 可独立验证。平铺列表还不是按类型分组的总览，分组留到用户故事 4

---

## Phase 5: User Story 3 - 盘点并改正历史记录 (Priority: P1)

**Goal**: 可以追加盘点，也可以改任意一条历史盘点。当前金额等于日期最新的一条。只剩一条时不能删除

**Independent Test**: 一笔资产有两条盘点。把较早那条的金额改掉，当前金额不变。再把最新那条的金额改掉，当前金额变成新金额。只剩一条时删除不可用，修改可用

### Implementation for User Story 3

- [X] T016 [P] [US3] 在 `server/routes/asset/recordController.ts` 的新增、修改、删除都调用 `server/database/services/assetRecordService.ts` 的重算，不得再把当前金额无条件写成刚提交的那条。约束原文：「用户必须能修改任意一条已有盘点的金额和日期。保存后改的是这一条，不得因此另增一条盘点。」「只剩一条盘点时，系统必须拒绝删除并说明原因」，message 为「只剩一条记录时不能删除」。「金额必须是大于 0 的数字」，否则 message 说明盘点金额必须大于 0；日期为空时不得保存。同一自然日的时间戳按基础阶段的 1 毫秒规则写入
- [X] T017 [P] [US3] 新建 `frontend/src/views/asset/hooks/use-records.ts`，支持按起止日期读取盘点、新增、修改这一条、多于一条时删除。修改请求打到已有的 `PUT /record`，不要改成再新增一条
- [X] T018 [US3] 在 `frontend/src/views/asset/Asset.vue` 的盘点弹窗列出日期和金额，可改任意一条并保存，可按起止日期筛选。只剩一条时删除不可用，并说明原因。未保存就关闭时不得提交。保存成功后刷新该资产的当前金额

**Checkpoint**: 用户故事 3 可独立验证。总览分组、上月末、四笔钱、构成、月历、趋势可以还没有

---

## Phase 6: User Story 4 - 看家庭或某个人的资产负债 (Priority: P1)

**Goal**: 成员选全部时看家庭合计；选一名成员时只看这个人。总资产不含负债，净资产等于总资产减总负债

**Independent Test**: 不选成员时，净资产等于全部非负债当前金额之和减去全部负债当前金额之和。改选一名成员后，合计里不再出现其他人的资产

### Implementation for User Story 4

- [X] T019 [P] [US4] 在 `server/routes/asset/assetController.ts` 的 `getAssetListWithStats` 按负债标记汇总。约束原文：「总资产等于非负债当前金额之和，总负债等于负债当前金额之和，净资产等于总资产减去总负债。」每组给出合计、占对应总额的比例、相对上一次盘点的变化额和变化率。只有一条盘点时变化率为空，不得返回 0 冒充。每笔包含成员名、四笔钱、当前金额、上一次金额、变化额、变化率和占本组比例。成员已隐藏时，资产仍返回，并仍带原来的名字。`memberId` 为空表示整个账本
- [X] T020 [P] [US4] 新建 `frontend/src/views/asset/hooks/use-overview.ts`，用 `list-stats` 读取家庭或单个成员的合计与分组。成员筛选的值供后面的页签共用，不要在每个页签各存一份
- [X] T021 [US4] 在 `frontend/src/views/asset/Asset.vue` 的「总览」用分组列表替换用户故事 2 的平铺列表，保留登记和成员入口。展示总资产、总负债、净资产，并提供默认关闭的「排除固定资产」。每个类型组内再按成员小计。选「全部」或某一成员时，这一选择同时留给四笔钱、构成、月历、资产趋势。点一行打开用户故事 3 的盘点弹窗。没有资产时三个合计显示 0

**Checkpoint**: 用户故事 4 可独立验证。这是第一版能看家庭净资产的页面。上月末变化留到用户故事 5

---

## Phase 7: User Story 5 - 看相对上月末的变化 (Priority: P2)

**Goal**: 总览写明对比日，总资产变化只比较非负债。负债增加不会让总资产变化变大

**Independent Test**: 总资产变化等于当前非负债合计减去上月末非负债合计。其间负债增加、非负债合计不变时，总资产变化为 0

### Implementation for User Story 5

- [X] T022 [P] [US5] 在 `server/routes/asset/statisticsController.ts` 的 `getAssetOverview` 改正总资产变化。约束原文：「总资产变化只比较非负债合计。负债单独比较，不得并进总资产变化。」对比日是上一个自然月的最后一天，格式 `YYYY-MM-DD`。各类型返回当前值、上月末值、变化额。没有任何资产时，总资产、总负债、净资产和总资产变化均为 0。`billId` 为空时仍返回「账本id不能为空」
- [X] T023 [P] [US5] 新建 `frontend/src/views/asset/hooks/use-month-bars.ts`，读取各类型当前值与上月末。总览用横向色条展示，每类按自己的最大值拉伸，数字是实际金额。不要新增图表库
- [X] T024 [US5] 在 `frontend/src/views/asset/Asset.vue` 总览展示对比日、总资产变化和柱状对比。负债的变化单独显示，不得加进总资产变化的数字里

**Checkpoint**: 用户故事 5 可独立验证。四笔钱及之后的页签可以仍是空的

---

## Phase 8: User Story 6 - 按四笔钱查看 (Priority: P2)

**Goal**: 活钱、稳健、长期、保险各有金额、笔数和明细。活钱、稳健、长期的比例合计为 100%。明细按成员小计。负债不进入四笔钱

**Independent Test**: 一笔非负债的长期资产出现在长期卡片里。一笔负债保存后不出现在四笔钱卡片里，同时仍只计入总负债、不计入总资产

### Implementation for User Story 6

- [X] T025 [P] [US6] 在 `server/routes/asset/statisticsController.ts` 的 `getFourMoneySummary` 强制要求 `billId`，缺少时 message 为「账本id不能为空」，不得统计全部账本。活钱、稳健、长期、保险各返回金额、笔数和明细。没有四笔钱取值的资产不进入任何卡片。保险另有年交保费合计；`insurance_category` 为空时归入「其他」
- [X] T026 [P] [US6] 新建 `frontend/src/views/asset/hooks/use-four-money.ts`，请求带当前账本和用户故事 4 的成员筛选
- [X] T027 [US6] 在 `frontend/src/views/asset/Asset.vue` 完成「四笔钱」页签：四张卡显示金额和笔数，明细按成员小计后再列出资产。活钱、稳健、长期显示占这三类总额的比例，三者之和为 100%，保险不计入。保险卡显示年交保费，未填险种显示为「其他」

**Checkpoint**: 用户故事 6 可独立验证

---

## Phase 9: User Story 7 - 看资产构成 (Priority: P2)

**Goal**: 净资产和负债汇入总资产，再拆到四类非负债和每一笔。负债不在右侧出现第二次

**Independent Test**: 住房在右侧，房贷只在左侧。类型名是「固定资产」。比例下净资产份额与负债份额之和为 100%

### Implementation for User Story 7

- [X] T028 [P] [US7] 在 `server/routes/asset/statisticsController.ts` 的 `getSankeyData` 强制要求 `billId`，缺少时 message 为「账本id不能为空」。约束原文：「净资产与负债汇入总资产，总资产再拆到流动资金、固定资产、投资理财、应收款，然后拆到每一笔非负债资产。负债只从左侧进入。」类型节点使用中文名，不得使用「固定资金」或英文类型标识。金额为 0 的连线不返回。`value` 是实际金额。资产节点带成员名；左侧负债节点带明细名称，这些负债属于同一成员时带上该成员名
- [X] T029 [P] [US7] 新建 `frontend/src/views/asset/hooks/use-sankey.ts`，用现有 ECharts 桑基图按接口的节点和实际金额画色带，不按开方。标注数字仍是实际金额。支持「金额」「比例」「隐藏金额」。比例的分母是总资产。成员为全部时画归属色块；已选单一成员时不画
- [X] T030 [US7] 在 `frontend/src/views/asset/Asset.vue` 完成「构成」页签和三种标注切换。使用现有 ECharts，不要新增图表库

**Checkpoint**: 用户故事 7 可独立验证

---

## Phase 10: User Story 8 - 按年查看月历 (Priority: P2)

**Goal**: 按年看每月盘点。今年只到本月，过去的年份画满 12 个月。没有盘点的月份不是 0

**Independent Test**: 选今年，图只到本月。选一个已结束的年份，12 个月都有柱。该年有数月份的总资产等于该月非负债之和

### Implementation for User Story 8

- [X] T031 [P] [US8] 在 `server/routes/asset/statisticsController.ts` 的 `getMonthlyReport` 强制要求 `billId`，缺少时 message 为「账本id不能为空」。先把类型标识映射成流动资金、投资理财、固定资产、应收款再累加。总资产、总负债、总净资产按负债标记计算。`monthlyData` 长度仍为 12；尚未到来的月份，以及该月该分类在月末前没有盘点时，值为 `null`，不得填 0。`year` 缺省为今年。`current`：今年为本月，过去的年份为 12 月。`yearChange` 是较年初：所看月份减去该年 1 月；1 月为 `null` 时按 0。所看月份没有金额时变化为空。每类带 `lastUpdate`，没有则为空
- [X] T032 [P] [US8] 新建 `frontend/src/views/asset/hooks/use-month-chart.ts`，用 ECharts 为每一类画柱。`null` 不画柱。今年标出本月，过去的年份标出 12 月
- [X] T033 [US8] 在 `frontend/src/views/asset/Asset.vue` 完成「月历」页签：可切换年份，默认今年。每类显示所看月份的金额、较年初和最后一次盘点日期

**Checkpoint**: 用户故事 8 可独立验证。趋势还没有，但月历数据已经可供趋势拼接

---

## Phase 11: User Story 9 - 看资产趋势 (Priority: P2)

**Goal**: 用面积图看今年、近 1 年、近 3 年、近 5 年或自定义月份。全部口径中四类资产向上堆叠、负债为负数，净资产只有一层。图铺满剩余高度

**Independent Test**: 选今年，图从 1 月画到本月。近 1 年、近 3 年、近 5 年的月份数是 12、36、60，且都结束于本月。全部口径中负债为负数，净资产只有一层

### Implementation for User Story 9

- [X] T034 [US9] 新建 `frontend/src/views/asset/hooks/use-trend.ts`，只调用已修正的月历接口，按年拼接，不要新增趋势路径。今年为当年 1 月到当前月。近 1 年、近 3 年、近 5 年以当前月结束，长度分别为 12、36、60 个月。自定义按开始日期和结束日期所在月份；结束月晚于当前月时只取到当前月。开始月晚于结束月时不请求绘图。`null` 不画成 0。全部口径中流动资金、投资理财、固定资产、应收款从零轴向上堆叠，负债（用月历的总负债）按负数画在零轴下方。净资产只用月历的总净资产，画一层。图例给出最后一个月的金额，以及从区间内第一个有数的月份到最后一个月的变化。图表容器铺满资产页剩余高度，尺寸变化时重绘
- [X] T035 [US9] 在 `frontend/src/views/asset/Asset.vue` 完成「资产趋势」页签：时间范围、全部/净资产、自定义起止和确定。结束日期晚于本月、开始日期晚于结束日期、该区间没有盘点时，按规格显示对应说明。面积图使用现有 ECharts，并铺满剩余高度

**Checkpoint**: 用户故事 9 可独立验证。九个故事的页面能力齐全

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: 类型检查、手册用词和 quickstart 验收

- [X] T036 [P] 运行 `npm run typecheck --prefix server`。类型错误只改本次动过的 `server/routes/asset/` 与 `server/database/services/assetRecordService.ts`、`server/database/services/assetDebtBackfill.ts`
- [X] T037 [P] 对照做好的页面核对 `docs/用户手册.md` 第 10 章和目录、菜单、小程序对照、权限表、常见问题。页面上的按钮和口径与手册不一致时，改手册中的用词，不要改回错误口径。不要把接口路径或类型存储值写进手册
- [X] T038 按 `specs/007-family-asset/quickstart.md` 做完手工验收，并执行一次 `server/database/services/assetDebtBackfill.ts` 的回填。确认 `miniapp/` 没有新增资产入口，记账、概览、预算、计划页面没有被改成资产页

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖，可立即开始
- **Foundational (Phase 2)**: 依赖 Setup 完成，挡住全部用户故事
- **User Stories (Phase 3+)**: 都依赖 Foundational。页面都写在 `Asset.vue`，按 P1 再 P2 的顺序做，避免同一个文件并行修改
- **Polish (Phase 12)**: 依赖要交付的用户故事都完成

### User Story Dependencies

- **User Story 1 (P1)**: Foundational 之后即可开始，不依赖其它故事
- **User Story 2 (P1)**: 依赖用户故事 1 的成员名单才能在页面上选择归属人。创建接口本身只要求已有 `memberId`
- **User Story 3 (P1)**: 依赖用户故事 2 已经有资产和第一条盘点
- **User Story 4 (P1)**: 依赖用户故事 2 的资产数据。它替换总览里的平铺列表，不替换登记和盘点
- **User Story 5 (P2)**: 依赖用户故事 4 的总览版面，把上月末对比加进去
- **User Story 6 (P2)**: 依赖用户故事 4 的成员筛选。接口可单独验收
- **User Story 7 (P2)**: 依赖用户故事 4 的成员筛选。接口可单独验收
- **User Story 8 (P2)**: 依赖用户故事 4 的成员筛选。接口可单独验收
- **User Story 9 (P2)**: 依赖用户故事 8 的月历口径。不新增接口

### Within Each User Story

- 同一故事里，接口文件和 hook 文件标了 [P] 的可以同时做
- `Asset.vue` 的任务放在该故事最后，依赖本故事的接口和 hook
- 不要为本次功能写自动化测试

### Parallel Opportunities

- Phase 1 的 T001–T006 可同时进行
- Phase 2 的 T007–T009 可同时进行
- 每个用户故事中标 [P] 的接口任务和 hook 任务可同时进行
- `statisticsController.ts` 上的 T022、T025、T028、T031 必须按阶段顺序做，不能并行
- `assetController.ts` 上的 T013 与 T019 必须按阶段顺序做，不能并行
- `Asset.vue` 上的 T012、T015、T018、T021、T024、T027、T030、T033、T035 必须按阶段顺序做，不能并行

---

## Parallel Example: User Story 1

```text
同时做：
- T010 成员接口 server/routes/asset/memberController.ts
- T011 成员 hook frontend/src/views/asset/hooks/use-members.ts

做完后再做：
- T012 成员弹窗 frontend/src/views/asset/Asset.vue
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Phase 1：空的资产页和网关
2. 完成 Phase 2：成员校验、盘点重算、负债回填
3. 完成 Phase 3：用户故事 1
4. **停下来验证**：新增、改名、隐藏成员，隐藏后资产还在
5. 可以演示成员名单。还不能算家庭净资产

### Incremental Delivery

1. Setup + Foundational
2. 用户故事 1：资产成员
3. 用户故事 2：登记和编辑
4. 用户故事 3：盘点可改
5. 用户故事 4：家庭净资产。到这里是第一版能看家里有多少钱的页面
6. 用户故事 5 到 9：上月末、四笔钱、构成、月历、趋势
7. 每个故事做完都按该阶段的 Independent Test 看一遍，再进入下一个

### Parallel Team Strategy

1. 一起做完 Setup 和 Foundational
2. 之后可以一人改某个故事的接口、另一人写该故事的 hook
3. `Asset.vue`、`assetController.ts`、`statisticsController.ts` 仍由一个人按任务顺序改

---

## Notes

- [P] 表示不同文件、且不依赖未完成任务
- 用户故事标签用来对照 spec.md
- 规格里的口径以 spec.md 为准；字段和失败文案以 contracts/asset-api.md、data-model.md 为准
- 不要把原型 `prototypes/family-asset.html` 当成运行代码
- 做完一个故事就可以停下来验收

---

## Phase 13: Convergence

**Purpose**: 上一轮收敛指出的差异已经确认为需要保留的行为。规格、计划、数据模型、契约和本文件中的对应任务已改成与实现一致，代码不回退

- [X] T039 规格改为：负债不选择、不保存四笔钱，也不进入四笔钱卡片。`frontend/src/views/asset/Asset.vue`、`frontend/src/views/asset/hooks/use-asset-form.ts`、`server/routes/asset/assetController.ts` 保持现有实现 per FR-004, FR-005, FR-027 (contradicts)
- [X] T040 规格改为：月历变化称「较年初」，1 月没有盘点时按 0。`server/routes/asset/statisticsController.ts` 与 `frontend/src/views/asset/Asset.vue` 保持现有实现 per FR-035, US8/AC5 (contradicts)
- [X] T041 规格改为：趋势里负债按负数画在零轴下方。`frontend/src/views/asset/hooks/use-trend.ts` 保持现有实现 per FR-038, US9/AC7, SC-010 (contradicts)
- [X] T042 规格改为：构成使用 ECharts 桑基图，色带按实际金额，不开方。`frontend/src/views/asset/hooks/use-sankey.ts` 保持现有实现 per plan: 构成色带, T029 (partial)
- [X] T043 规格改为：总览相对上月末使用横向色条。`frontend/src/views/asset/hooks/use-month-bars.ts` 与 `frontend/src/views/asset/Asset.vue` 保持现有实现 per T023 (partial)
- [X] T044 规格补上总览「排除固定资产」，默认关闭。打开后净资产、总资产和较上月末不含固定资产，总负债不变。`frontend/src/views/asset/Asset.vue` 保持现有实现 per FR-020 (unrequested)
- [X] T045 规格补上总览每个类型内按成员小计。`frontend/src/views/asset/Asset.vue` 保持现有实现 per FR-021, FR-022 (unrequested)
- [X] T046 规格补上四笔钱的类型占比（活钱、稳健、长期合计 100%）和明细按成员分组。`frontend/src/views/asset/Asset.vue` 保持现有实现 per FR-025 (unrequested)
- [X] T047 规格补上资产趋势图铺满剩余视口高度。`frontend/src/views/asset/Asset.vue` 与 `frontend/src/views/asset/hooks/use-trend.ts` 保持现有实现 per US9 (unrequested)

---

## Phase 14: Convergence

**Purpose**: 对照更新后的规格，补上总览口径和趋势说明里仍未对齐的部分

- [X] T048 在 `server/routes/asset/assetController.ts` 的类型组合计里，变化额只累加有上一次盘点的资产；该组全部没有上一次盘点时变化额为空，不得返回 0。变化率在缺少上一次盘点时保持为空。`frontend/src/views/asset/Asset.vue` 对空变化显示「—」 per FR-021, US4/AC3 (contradicts)
- [X] T049 在 `frontend/src/views/asset/Asset.vue` 把每一笔资产和成员小计的「占本组」改为该金额除以所属类型的当前合计。组头「占资产 / 占负债」仍是占对应总额，排除固定资产后按剩余总资产重算。排除固定资产不改变组内「占本组」的分母 per FR-022, US4/AC5, US4/AC9 (contradicts)
- [X] T050 在 `frontend/src/views/asset/hooks/use-trend.ts` 使用规格中的说明：开始日期晚于结束日期时提示「开始日期不能晚于结束日期」；区间没有盘点时提示「该区间没有盘点」；结束日期晚于当前月时说明只画到当前月 per FR-037, US9/AC4, US9/AC5, US9/AC6 (partial)

---

## Phase 15: Convergence

**Purpose**: 总览已经能看到变化额，但规格还要求看到上一次盘点金额和变化率

- [X] T051 在 `frontend/src/views/asset/Asset.vue` 的总览中，每一笔资产展示上一次盘点金额和变化率；没有上一次盘点时变化率为空。每个类型组同时展示变化率，整组没有上一次盘点时变化率为空 per FR-021, FR-022, US4/AC3, US4/AC5 (partial)
