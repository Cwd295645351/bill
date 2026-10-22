---

## description: "按原型补齐家庭资产"

# Tasks: 按原型补齐家庭资产

**Input**: Design documents from `/specs/009-family-asset-prototype/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: 规格未要求自动化测试。不要新增测试框架，也不要改 `server/package.json` 或仓库根目录的 `test` 脚本。验证放在最后一阶段，按 quickstart.md 手工执行。服务端改完后只跑已有的 `npm run typecheck --prefix server`。

**Organization**: 按用户故事分阶段。用户故事 1、2、3 都是 P1，按规格中的先后实现。`frontend/src/views/asset/Asset.vue`、`server/routes/asset/index.ts`、`server/routes/asset/statisticsController.ts`、`server/routes/asset/assetController.ts` 每个故事只改自己的那一块，不能并行改同一个文件。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件，且不依赖尚未完成的任务）
- **[Story]**: 用户故事标签（US1–US8）
- 描述里必须有具体文件路径



## Path Conventions

- 服务端：`server/routes/asset/`、`server/database/models/index.ts`、`server/database/services/`
- 电脑端：`frontend/src/views/asset/`
- 手册：`docs/用户手册.md` 第 10 章
- 小程序 `miniapp/`、手机网页 `mobile/`、概览路由 `server/routes/overview/` 本次不改



## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 在现有资产页上补上契约里的类型和请求函数。不新增依赖，不改表

- [x] T001 [P] 在 `frontend/src/views/asset/type.d.ts` 补上契约 `specs/009-family-asset-prototype/contracts/asset-api.md` 的类型：币种只允许 `CNY`、`HKD`、`USD`；汇率 `{ hkdRate, usdRate, saved }`；总览增加 `defaultAsOf`、`earliestRecordMonth`、`hkdRate`、`usdRate`，以及每笔资产的 `currency`、`rawAmount`；盘点分页 `{ list, total, page, pageSize }`；对账请求 `billId`、`year`、`memberId`、`quantityInputs`，响应含 `income`、`expense`、`surplus`、`assetChange`、`netChange`、`diff`、`exclusive`、`sharedShare`、`publicShare`、`effectiveIncome`；养老计划含 `amount`、`startMonth`、`targetMonth`、`monthlyIncome`、`monthlyExpense`。不要改已有存储值 `living`、`steady`、`longterm`、`receivable`、`debt` 和四笔钱 `living`、`steady`、`longterm`、`insurance`
- [x] T002 [P] 在 `frontend/src/views/asset/api.ts` 增加 `getExchangeRate`、`saveExchangeRate`、`getLedger`、`getRetirePlan`、`saveRetirePlan`。`getOverview` 能传 `asOf`。`getRecords` 能传 `page`、`pageSize`。路径分别是 `/exchange-rate`、`POST /ledger`、`/retire-plan`，前缀仍是现有 `ASSET`。不要新造第二套网关

---



## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 币种列、汇率表、养老计划表，以及把原币乘成人民币的共用算法。后面每个故事的合计都依赖它

**⚠️ CRITICAL**: 用户故事开始前必须完成本阶段

- [x] T003 在 `server/database/models/index.ts` 增加模型，并在 `server/database/index.ts` 导出。`assets.currency` 为 `CNY`、`HKD`、`USD`，新建默认 `CNY`。`assets.four_money_type` 改为允许空。新建 `bill_exchange_rates`：`bill_id` 主键，`hkd_rate`、`usd_rate` 必须大于 0。新建 `asset_retire_plans`：`bill_id`，`member_id` 可空表示「全部」，`amount` 必须大于 0，`start_month` 为 `YYYY-MM`，`target_month` 可空。同一账本、同一 `member_id`（含空）只有一行。不要改 `asset_records` 的列
- [x] T004 新建 `server/database/ensureAssetSchema.ts`，并在 `server/database/index.ts` 的 `sequelize.sync()` 之后调用。`sync()` 不会给已有的 `assets` 加列。该函数必须可重复执行：没有 `currency` 时增加，已有行回填 `CNY`；把 `four_money_type` 改为可空。不要在这里清空历史上仍带着四笔钱的负债。新表由模型同步创建
- [x] T005 新建 `server/database/services/assetFx.ts`。读取某账本汇率；没有 `bill_exchange_rates` 行时返回大于 0 的初始值且 `saved` 为假，不要插入。折算规则原文：「人民币乘 1，港币乘 `hkd_rate`，美元乘 `usd_rate`」。不要把折算结果写回 `assets.latest_amount` 或 `asset_records.amount`

**Checkpoint**: 重启服务后旧资产仍是人民币。折算函数不改盘点。电脑端还没有新的币种界面

---



## Phase 3: User Story 1 - 用人民币看待外币资产 (Priority: P1) 🎯 MVP

**Goal**: 登记时可选人民币、港币、美元。合计和图表用当前账本汇率折成人民币。改汇率不改原币盘点

**Independent Test**: 登记 100 港币的存款。在汇率为「1 港币 = 0.91 元」时，它给总资产增加 91 元，并标出港币 100。把汇率改成 1 后，总资产里它变成 100 元，盘点历史仍是 100 港币

### Implementation for User Story 1

- [x] T006 [P] [US1] 在 `server/routes/asset/assetController.ts` 落实币种。创建时 `currency` 缺省 `CNY`，不是 `CNY`、`HKD`、`USD` 之一则失败。`latestAmount` 按该币种保存，必须大于 0。编辑时正文里的 `currency` 与库中不同则失败，文案说明要换币种需删除后重新登记。`GET /list` 与 `GET /list-stats` 的合计、分组金额改为人民币，并带每笔的 `currency`、`rawAmount`。折算调用 `server/database/services/assetFx.ts`。改汇率不得新增盘点
- [x] T007 [P] [US1] 新建 `server/routes/asset/exchangeController.ts`。`GET /exchange-rate` 返回 `{ hkdRate, usdRate, saved }`，尚未保存时 `saved` 为假且两个汇率仍大于 0。`PUT /exchange-rate` 在任一汇率不是大于 0 的数字时失败，文案说明汇率必须大于 0，已保存的值不变。成功后只更新 `bill_exchange_rates`，不写盘点
- [x] T008 [US1] 在 `server/routes/asset/index.ts` 挂上 T007 的两条路由，成员检查与现有资产路由相同，不是成员时文案说明无权查看该账本。在 `server/routes/asset/statisticsController.ts` 的 `GET /overview`、`/four-money`、`/sankey`、`/monthly-report` 把金额改为人民币，明细带 `currency` 与 `rawAmount`。没有盘点的月份仍是 `null`。不改 `server/routes/overview/`
- [x] T009 [P] [US1] 在 `frontend/src/views/asset/hooks/use-asset-form.ts` 增加币种，默认人民币。港币或美元时，当前金额和年交保费的提示标明该币种。编辑时币种不可改，并说明要换币种必须删除后重新登记。提交仍走现有 `POST /` 与 `PUT /`
- [x] T010 [US1] 在 `frontend/src/views/asset/Asset.vue` 的登记和编辑弹窗接上 T009。增加汇率入口，写明当前使用的港币和美元汇率。外币在人民币金额下标出原币；人民币资产不显示这条附注。保存汇率失败时保留原汇率

**Checkpoint**: 用户故事 1 可独立验证。日期选择器、缩短金额、对账和养老可以还没有

---



## Phase 4: User Story 2 - 用日期选择器对比截至某一天的资产 (Priority: P1)

**Goal**: 总览用任意一天对比截至该日的资产。打开和切换成员时默认上一个盘点日。不再提供「排除固定资产」

**Independent Test**: 盘点日有 10 月 1 日和 10 月 20 日。打开总览时日期选择器是 10 月 1 日。改成 10 月 10 日后，对比金额等于 10 月 1 日那条盘点折成的人民币，而不是 10 月 20 日。总资产变化等于现在的非负债合计减去截至所选日的非负债合计

### Implementation for User Story 2

- [x] T011 [P] [US2] 在 `server/routes/asset/statisticsController.ts` 的 `GET /overview` 增加可选 `asOf`（`YYYY-MM-DD`）。传入时，每笔资产取该日及以前日期最新的一条原币盘点再折人民币；该日及以前没有盘点则按 0。不传时合计仍用当前金额。响应增加 `defaultAsOf`：盘点日期去重后，比最晚一天更早且最靠近它的那一天，没有则为空字符串。同时返回 `earliestRecordMonth`。总资产变化只比较非负债；总资产变化为 0 时由页面显示 0.00 元；总负债变化不到半分钱时由页面显示「没有变化」。接口不接受「排除固定资产」。当前金额仍是全部盘点里日期最新的一条
- [x] T012 [P] [US2] 在 `frontend/src/views/asset/hooks/use-overview.ts` 用 `GET /overview` 读取三个合计和变化，分组仍用 `list-stats`。打开总览和切换成员时，先取 `defaultAsOf` 填日期，再带 `asOf` 请求。成员切换不得保留上一个筛选里手选的日期。日期可以是没有盘点的日子
- [x] T013 [US2] 在 `frontend/src/views/asset/Asset.vue` 用日期选择器替换上月末对比。没有 `defaultAsOf` 时选择器留空，说明还没有上一次登记，总资产变化和总负债变化为 0。删掉「排除固定资产」。类型对照始终列出流动资金、投资理财、固定资产、应收款、负债；固定资产计入净资产和总资产

**Checkpoint**: 用户故事 2 可独立验证。分组仍可按现有变化率显示，缩短金额留到用户故事 3

---



## Phase 5: User Story 3 - 从总览定位到每一类资产 (Priority: P1)

**Goal**: 总览两张图能点进分类或四笔钱页。分组默认收起，行上是占本组、人民币、缩短金额和较上次盘点的变化额，没有变化率

**Independent Test**: 点资产类型图里的「固定资产」，该类分组展开并出现在视野中。一笔只有一次盘点的资产，变化为空，不显示变化率

### Implementation for User Story 3

- [x] T014 [P] [US3] 在 `frontend/src/views/asset/shared.ts` 增加缩短金额。约束原文：「缩短金额在人民币绝对值不大于 100 时显示原金额；超过 100 时用万表示，整万不带小数，否则保留两位。」100 元显示为 100.00，20000 元显示为 2 万，25000 元显示为 2.50 万
- [x] T015 [P] [US3] 在 `server/routes/asset/assetController.ts` 的 `GET /list-stats` 中，较上次盘点使用该资产自己的上一条盘点，不得改用 `asOf`。只有一条盘点时变化为空，不得返回 0。组的变化额只累加有上一条盘点的资产。组标题比例是占全部资产或占全部负债；成员小计和每一笔的比例是占本组。不要返回变化率
- [x] T016 [US3] 在 `frontend/src/views/asset/Asset.vue` 把页签「构成」改成「资产组成」。分组默认收起。四笔钱图只统计活钱、稳健、长期中的非负债资产，说明写明不含保险、也不含负债；没有金额时显示暂无；点这张图进入四笔钱页且成员筛选不变。点资产类型图或类型对照中的某一类时，展开该类并滚到该组；该类没有资产时不新增空组。组内先按成员姓名排序小计，再列出资产。点资产行打开盘点，点「编辑」只打开编辑。缩短金额使用 T014

**Checkpoint**: 用户故事 3 可独立验证。四笔钱卡片里直接改分类留到用户故事 4

---



## Phase 6: User Story 4 - 在四笔钱里调整分类 (Priority: P2)

**Goal**: 四笔钱页能看到含负债的三类对比，并在卡片里改分类。离开保险立即清掉险种和年交保费，且不新增盘点

**Independent Test**: 把一笔保险改成活钱。保险卡里不再有它，险种和年交保费消失，盘点条数不变。再登记一笔负债，四张卡里都没有它

### Implementation for User Story 4

- [x] T017 [P] [US4] 在 `server/routes/asset/assetController.ts` 确认编辑资产时：只改四笔钱不新增盘点；四笔钱不是保险时清空险种和年交保费；年交保费若填写必须不小于 0，否则失败。类型为负债时 `four_money_type` 存空，并清空险种和年交保费。不要批量清掉历史上仍带着四笔钱的旧负债。`GET /four-money` 已在 T008 折成人民币，这里不要再改口径
- [x] T018 [P] [US4] 在 `frontend/src/views/asset/hooks/use-four-money.ts` 支持在卡片里把一笔资产改到另一类四笔钱，只提交四笔钱变更。从保险改走后再改回时，险种按「其他」，年交保费按未填，不得把刚清除的值填回去
- [x] T019 [US4] 在 `frontend/src/views/asset/Asset.vue` 的四笔钱页：页顶对比含已归入活钱、稳健、长期的负债，不含保险，三类比例之和为 100%，说明写明负债计入。四张卡给出人民币合计、笔数和按成员的明细。外币标出原币。仍带着四笔钱的负债标明「负债」。保险卡给出年交保费的人民币合计，未填险种归入「其他」。空卡金额为 0 并说明暂无。新登记或编辑保存的负债不出现在任何卡里，但计入总负债

**Checkpoint**: 用户故事 4 可独立验证。对账可以还没有

---



## Phase 7: User Story 5 - 对照一年的记账和资产变化 (Priority: P2)

**Goal**: 总览分组下面给出年度对账。单人支出与概览分账使用同一套有效收入。不提供按月明细，也不改记账和概览

**Independent Test**: 甲当年收入 6000、乙 4000。一笔 100 元支出归属甲和乙，一笔 200 元归属「全部」，一笔 50 元只归属甲。看全部时支出是 350。看甲时支出是 230，也就是 50 加上 100 里的 60、再加上 200 里的 120。对账页上没有按月明细

### Implementation for User Story 5

- [x] T020 [P] [US5] 新建 `server/database/services/assetLedgerService.ts`。读取该年未删除记账和已启用的 `bill_overview_rules`，调用现有 `server/database/services/overviewSettlement.ts` 的 `buildSettlement`，不要复制分摊公式。看全部时每一笔收入和支出各算一次。看某一资产成员时按姓名精确对应记账成员：收入只计这个人的收入；支出等于结算结果里这个人的应承担金额。对不上名字时收入和支出为 0，并说明没有找到同名记账成员，且不把他加入结算成员。数量输入不能为负。有效收入小于 0 时按 0。成员顺序与概览相同，按 `bill_users.id` 升序，最后一名拿剩余。验收数必须成立：未扣减时 100 元共同支出甲得 60；200 元公共支出甲得 120；甲的支出合计 230，全部为 350。甲收入 6000、社保扣 1000、香港天数 10 且单价 200、乙收入 4000、公共支出 200 时，甲有效收入 3000、乙 4000，甲分到 85.71、乙分到 114.29。本服务不写 `transactions`，不写 `bill_overview_rules`
- [x] T021 [US5] 新建 `server/routes/asset/ledgerController.ts`，并在 `server/routes/asset/index.ts` 增加 `POST /ledger`。正文为 `billId`、`year`、`memberId`、`quantityInputs`。今年统计到本月，已结束的年份统计到 12 月。响应含人民币的 `income`、`expense`、`surplus`、`assetChange`、`netChange`、`diff`、期初月份说明、是否相等，以及单人时的 `exclusive`、`sharedShare`、`publicShare` 和各记账成员的 `effectiveIncome`。期初优先为上一年 12 月底，否则为本年第一个有总资产的月底。差额绝对值小于 0.01 元标为相等。没有盘点时 `assetChange` 与 `diff` 为空。没有记账时收入和支出为 0
- [x] T022 [P] [US5] 新建 `frontend/src/views/asset/hooks/use-ledger.ts`。年份只列出有记账的年份，默认今年。切换资产成员时年份不变，数字按新筛选重算。数量规则的输入与概览相同，随请求提交，不另存一套规则。不得请求按月明细
- [x] T023 [US5] 在 `frontend/src/views/asset/Asset.vue` 的总览分组下面放入年度对账，放在分组之后。展示总收入、总支出、收支结余、总资产变化、同期净资产变化和差额。看单人时说明支出含只归属他的金额，以及按有效收入从共同支出和公共支出拆给他的金额，并写明各人有效收入。说明里提示差额常见于投资或房产估值、漏记或重复、没有及时盘点、还贷本金没有记成支出。页面上没有「按月明细」或展开月份的入口

**Checkpoint**: 用户故事 5 可独立验证。打开对账前后，概览结算建议的数字不变

---



## Phase 8: User Story 6 - 为家庭或某个人设置养老计划 (Priority: P2)

**Goal**: 「全部」和每一名资产成员各存一份养老计划。推算只读记账。单人月均支出不拆入共同支出和公共支出

**Independent Test**: 为「全部」设置目标 100 万、开始月份为本月。当前净资产为 40 万时，金额进度是 40%。再只给某一名成员设置另一份计划，切回「全部」时仍是 100 万那一份

### Implementation for User Story 6

- [x] T024 [P] [US6] 新建 `server/database/services/assetRetireService.ts` 与 `server/routes/asset/retireController.ts`。`GET /retire-plan` 没有计划时返回空数据，不报错，并附上 `monthlyIncome`、`monthlyExpense`。`PUT /retire-plan` 按账本和成员范围覆盖一行。`member_id` 空表示「全部」。目标金额必须大于 0。开始月份必填且不得晚于本月。目标月份为空，或晚于本月。任一不满足则失败并说明原因，原计划不变。选中单个资产成员时，月均只统计只归属该同名记账成员的收入和支出，不得调用 `buildSettlement`。看全部时每一笔收入和支出各算一次，月均先按每个人平均再相加。隐藏成员不删除他的计划行
- [x] T025 [US6] 在 `server/routes/asset/index.ts` 挂上 `GET /retire-plan` 与 `PUT /retire-plan`，成员检查与现有资产路由相同
- [x] T026 [P] [US6] 新建 `frontend/src/views/asset/hooks/use-retire.ts`。收入和支出窗口可分别选近 3 年或近 5 年，默认都是近 3 年。默认剔除没有收入的月份，且只从收入平均中剔除；取消剔除后，收入为 0 的月份按 0 计入。没有记账时月均为 0。当前净资产用折算后的人民币
- [x] T027 [US6] 在 `frontend/src/views/asset/Asset.vue` 增加「养老计划」页签。没有计划时说明还没有计划，并可以设置。展示目标金额、目标时间、当前净资产、金额进度和剩余时间。进度条不得超过 100%。已超过目标时写出超过的金额。尚未达标且月均结余大于 0 时给出预计月份，并在有目标时间时说明早于、晚于或正好落在目标月。月均结余不大于 0 时说明按当前收支达不到目标。对比图从开始月画到本月；没有盘点的月份留空，不画成 0。有目标时间时，目标线从第一个有数的净资产匀速到达目标月的目标金额；没有目标时间时，目标线是目标金额的水平线。页面写明不计投资收益和通胀、结果只作参考。切换「全部」和某一成员时各自显示自己的计划

**Checkpoint**: 用户故事 6 可独立验证。同一成员的对账支出可以含公共支出份额，养老月均支出不含这份

---



## Phase 9: User Story 7 - 按记账以来或按年看趋势 (Priority: P2)

**Goal**: 趋势默认「记账以来、按月、全部口径」。可以收成每年一个点。图例能看出期末和区间变化

**Independent Test**: 最早的盘点在三年前的 4 月。选择记账以来和月份后，图从那个 4 月画到本月。改成按年后，每年只有一个点，取值是该年在区间内最后一次有数的月份

### Implementation for User Story 7

- [x] T028 [P] [US7] 在 `frontend/src/views/asset/hooks/use-trend.ts` 增加区间「记账以来」，并作为默认；粒度增加「年份」，默认仍是月份；口径默认全部。起点用总览返回的 `earliestRecordMonth`，按年请求已有 `GET /monthly-report` 再拼接，不要新增趋势接口。按年时每一年只保留区间内最后一个有数的月份。没有盘点的月份不得画成 0。图例改用 ECharts 自带图例，文字仍能看出期末金额和从第一个有数点到最后一个有数点的变化；缩短金额使用 `frontend/src/views/asset/shared.ts`。全部口径下四类资产向上堆叠、负债按负数画在零轴下方；净资产口径只画一层
- [x] T029 [US7] 在 `frontend/src/views/asset/Asset.vue` 的趋势工具栏提供记账以来、今年、近 1 年、近 3 年、近 5 年和自定义。自定义开始晚于结束时不画，并说明开始日期不能晚于结束日期。结束月晚于本月时只画到本月并说明。区间内没有盘点时说明该区间没有盘点。图铺满工具栏和图例之外的剩余高度

**Checkpoint**: 用户故事 7 可独立验证。今年、近 1 年、近 3 年、近 5 年的终点仍是本月

---



## Phase 10: User Story 8 - 按页查看盘点 (Priority: P3)

**Goal**: 盘点按日期从新到旧、每页 10 条。金额必须大于 0。盘点页不能改四笔钱、资产属性和币种

**Independent Test**: 准备 11 条盘点。第一页 10 条，第二页 1 条。把最早一条的金额改掉后，若它不是日期最新，当前金额不变。只剩一条时删除不可用

### Implementation for User Story 8

- [x] T030 [P] [US8] 在 `server/routes/asset/recordController.ts` 落实分页和校验。`GET /records` 传入 `page`、`pageSize` 时按日期从新到旧返回 `{ list, total, page, pageSize }`，`pageSize` 缺省为 10。不传时仍返回该资产全部未删除盘点。`POST /record` 与 `PUT /record` 在金额不是大于 0 的数字或日期为空时失败并说明原因，不写入。只剩一条时拒绝删除，message 为「只剩一条记录时不能删除」。同一天多条时，当前金额和截至某日都取最后保存的那条。金额仍是原币
- [x] T031 [P] [US8] 在 `frontend/src/views/asset/hooks/use-records.ts` 按页读取，每页 10 条，并保留总条数。去掉按起止日期筛选。新记成功后回到第 1 页。修改请求仍打到 `PUT /record`，不要改成再新增一条。未保存就关闭时不得提交
- [x] T032 [US8] 在 `frontend/src/views/asset/Asset.vue` 的盘点弹窗只展示四笔钱、资产属性和币种，这三项不能在这里修改。列表显示第几页和总条数。金额为空、不是数字或不大于 0，或日期为空时不提交

**Checkpoint**: 用户故事 8 可独立验证。不传分页参数时，已有的全量读取仍然可用

---



## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: 手册与规格对齐，并确认没有改到别的端

- [x] T033 [P] 按 FR-037 改写 `docs/用户手册.md` 第 10 章，并核对目录、菜单对照和常见问题里仍写「上月末」或「排除固定资产」的句子。至少写明：只在电脑网页提供；币种和汇率；汇总用人民币；总览用日期选择器对比截至某一天，默认是上一个盘点日；没有「排除固定资产」；分组不再显示变化率；四笔钱可以直接改分类；盘点按页查看且金额必须大于 0；趋势可以看记账以来并按年；年度对账和养老计划只读记账，单人对账与概览分账一致，养老不按这个比例拆支出；资产成员与记账成员不是同一份名单；小程序不能管理这些内容。手册不写接口和内部代号
- [x] T034 [P] 确认 `miniapp/`、`mobile/`、`server/routes/overview/` 没有本次改动。资产页的成员筛选在总览、四笔钱、资产组成、月历、资产趋势、养老计划之间仍是同一份
- [x] T035 在 `server/` 执行已有的 `npm run typecheck --prefix server`
- [x] T036 按 `specs/009-family-asset-prototype/quickstart.md` 在电脑网页从头走到尾。小程序里不应出现新的资产、汇率、对账或养老入口

---



## Dependencies & Execution Order



### Phase Dependencies

- **Setup (Phase 1)**: 无依赖，可立即开始
- **Foundational (Phase 2)**: 依赖 Setup。未完成前不要开始用户故事
- **User Stories (Phase 3+)**: 都依赖 Foundational。建议按 P1 → P2 → P3 顺序做，因为总览页是同一个 `Asset.vue`
- **Polish (Phase 11)**: 依赖要交付的用户故事都已完成



### User Story Dependencies

- **User Story 1 (P1)**: Foundational 之后即可开始。后面的合计都依赖这里的人民币折算
- **User Story 2 (P1)**: 依赖用户故事 1 的汇率折算。日期对比可以单独验收
- **User Story 3 (P1)**: 依赖用户故事 1 的人民币金额。分组的「较上次盘点」不依赖用户故事 2 的截至日
- **User Story 4 (P2)**: 依赖用户故事 1 的四笔钱人民币金额。改分类本身不依赖对账
- **User Story 5 (P2)**: 依赖用户故事 1 的资产人民币变化。不依赖养老计划
- **User Story 6 (P2)**: 依赖用户故事 1 的净资产折算和 Foundational 的养老计划表。不得复用用户故事 5 的应承担金额
- **User Story 7 (P2)**: 依赖用户故事 2 返回的 `earliestRecordMonth`，以及用户故事 1 的月历人民币金额
- **User Story 8 (P3)**: Foundational 之后即可开始。盘点金额仍是原币，展示原币不依赖汇率界面



### Within Each User Story

- 先改服务端口径，再改对应 hook，最后改 `Asset.vue`
- 同一文件的任务按编号顺序做
- 一个故事验收通过后再做下一个优先级



### Parallel Opportunities

- T001 与 T002 可并行
- T006、T007、T009 可并行；T008 等 T007，T010 等 T009
- T011 与 T012 可并行
- T014 与 T015 可并行
- T017 与 T018 可并行
- T020 与 T022 可并行
- T024 与 T026 可并行
- T028 可与 T030、T031 并行（不同文件）
- T033 与 T034 可并行
- `Asset.vue`、`index.ts`、`statisticsController.ts`、`assetController.ts` 不要并行改

---



## Parallel Example: User Story 1

```bash
# 服务端币种、汇率接口、登记表单可以同时做：
Task: "在 server/routes/asset/assetController.ts 落实币种与人民币合计"
Task: "新建 server/routes/asset/exchangeController.ts"
Task: "在 frontend/src/views/asset/hooks/use-asset-form.ts 增加币种"

# 上面完成后，再串行：
Task: "在 server/routes/asset/index.ts 挂汇率路由，并让统计接口返回人民币"
Task: "在 frontend/src/views/asset/Asset.vue 接上币种和汇率"
```

---



## Implementation Strategy



### MVP First (User Story 1 Only)

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational
3. 完成 Phase 3: User Story 1
4. **停下来验收**：100 港币在汇率 0.91 时增加 91 元，改成 1 后变成 100 元，盘点历史仍是 100 港币
5. 通过后再做日期选择器和分组



### Incremental Delivery

1. Setup + Foundational
2. 用户故事 1：外币折人民币（MVP）
3. 用户故事 2：日期选择器
4. 用户故事 3：分组、缩短金额、点图定位
5. 用户故事 4：四笔钱改分类
6. 用户故事 5：年度对账
7. 用户故事 6：养老计划
8. 用户故事 7：记账以来和按年
9. 用户故事 8：盘点分页
10. 手册和 quickstart



### Parallel Team Strategy

Foundational 完成之后：

- 开发 A 按顺序改 `Asset.vue`（用户故事 1 到 8 的界面）
- 开发 B 改 `assetController.ts` 与 `recordController.ts`
- 开发 C 改 `statisticsController.ts`、对账服务和养老服务

同一文件仍由一个人顺序改。对账和养老不要共用一个支出函数。

---

