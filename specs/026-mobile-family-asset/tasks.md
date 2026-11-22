---
description: "移动端家庭资产的实现任务列表"
---

# 任务列表：移动端家庭资产

**输入**: `/specs/026-mobile-family-asset/` 下的设计文档

**前置条件**: plan.md（必须）、spec.md（用户故事必须）、research.md、data-model.md、contracts/、quickstart.md

**测试**: 规格未要求自动化测试。本列表不写单测或契约测。H5 改动后在 `mobile-h5` 执行 `pnpm typecheck`。交付前按 [quickstart.md](./quickstart.md) 手工验收，并与电脑端对数字。

**组织方式**: 按用户故事分组，以便每个故事可独立实现与验收。`prototype/miniapp.html` 只决定有哪些页面和入口。对比日、每一笔涨跌，以及「移除固定资产」只改总览卡片，都以规格为准，不照搬原型脚本。金额口径调用现有 `/api/v1/asset`，见 [contracts/asset-mobile.md](./contracts/asset-mobile.md)。不改 `server/modules/asset`，不改 `frontend/src/views/asset/`，不恢复旧 `mobile/`。

## 格式：`[ID] [P?] [Story] 描述`

- **[P]**: 可并行（不同文件、无未完成依赖）
- **[Story]**: 所属用户故事（US1、US2、US3、US4、US5、US6）
- 描述中须含确切文件路径

## 路径约定

- 移动端 H5：`mobile-h5/src/`
- 微信小程序：`miniapp/miniprogram/`
- 契约：`specs/026-mobile-family-asset/contracts/asset-mobile.md`
- 电脑端资产页保持原样，资产组成仍只在电脑端

---

## 阶段 1：准备（共享基础设施）

**目的**: 落下两端的请求声明和页面空壳，尚不展示资产数字

- [x] T001 新建 `mobile-h5/src/api/asset.ts`，按 `specs/026-mobile-family-asset/contracts/asset-mobile.md` 声明现有路径的请求函数，暂不被页面调用。前缀为 `/asset`。包含成员、列表统计、登记与编辑、盘点、总览、四笔钱、月历、趋势、汇率、对账、养老。不得声明 `GET /sankey`，不得声明恢复成员，不得给 `GET /members` 增加 `includeHidden`
- [x] T002 [P] 在 `miniapp/miniprogram/apis/index.ts` 增加与 T001 相同的一组方法，暂不被页面调用。同样不得包含桑基、恢复成员和 `includeHidden`
- [x] T003 [P] 在 `miniapp/miniprogram/app.json` 的 `packageAsset` 分包中登记 `pages/four/index`、`pages/month/index`、`pages/trend/index`、`pages/retire/index`、`pages/form/index`、`pages/records/index`、`pages/members/index`，并为每一页建立 `index.ts`、`index.wxml`、`index.wxss`、`index.json` 空壳。现有 `packageAsset/pages/asset/index` 仍保留，本阶段不替换占位文案

---

## 阶段 2：基础能力（阻塞性前置）

**目的**: 本次查看状态、路由和涨跌颜色就位。本阶段完成前不得开始各端业务页

**⚠️ 重要**: 本阶段完成前，不得开始用户故事实现

- [x] T004 新建 `mobile-h5/src/stores/asset-view.ts`。只保存在本次查看中，不入库：成员筛选（只有「全部」和未隐藏成员 id）、移除固定资产、隐藏金额、手选对比日、对账年份。离开资产或换账本后，成员筛选回到「全部」，两个开关关闭，对比日和对账年份回到默认。不得写入「已隐藏」这一档
- [x] T005 [P] 新建 `miniapp/miniprogram/utils/asset-view.ts`，状态和重置规则与 T004 相同。换账本用页面收到的 `billId` 判断
- [x] T006 在 `mobile-h5/src/router/index.ts` 增加 `/bill/:id/asset`、`/four`、`/month`、`/trend`、`/retire`、`/form`、`/records`、`/members`，分别指向 `mobile-h5/src/views/asset/` 下的空页面。此阶段 `mobile-h5/src/components/BookTabBar.vue` 的「资产」仍 toast「请到电脑端查看或管理」（依赖 T004）
- [x] T007 [P] 新建 `mobile-h5/src/utils/asset-tone.ts` 与 `miniapp/miniprogram/utils/asset-tone.ts`。资产增加与负债减少用 `#18a356`，资产减少与负债增加用 `#f74f4f`。变化不到半分钱、原币金额、以及没有变化，保持中性灰。两个文件各自独立，色值相同
- [x] T008 复核 `server/modules/asset/router.ts` 与 `server/modules/asset/member-service.ts`：不新增路径，不增加 `includeHidden`，不增加 `PUT /member/restore`。隐藏仍只是现有 `DELETE /member` 的软删除。本任务不改这些文件

**检查点**: 请求函数和空页面都在，查看状态能随离开资产或换账本重置。服务端资产模块没有新接口

---

## 阶段 3：用户故事 1 - 在手机上看见家庭净资产（优先级：P1）🎯 MVP

**目标**: 两端点「资产」看到该账本的净资产、总资产、总负债，并能按成员和类型查看每一笔

**独立测试**: 用已有多类资产的账本打开总览，切换成员、展开一组、核对一笔外币。不必先登记新资产，也不必打开月历或养老

### 用户故事 1 的实现

- [x] T009 [P] [US1] 在 `mobile-h5/src/api/asset.ts` 实现 `GET /members`、`GET /overview`、`GET /list-stats`。`memberId` 空表示「全部」。总览可带 `asOf`。不是该账本成员时展示接口返回的无权文案，响应不带金额
- [x] T010 [P] [US1] 在 `miniapp/miniprogram/apis/index.ts` 实现与 T009 相同的三个只读方法
- [x] T011 [US1] 在 `mobile-h5/src/components/BookTabBar.vue` 去掉「资产」的电脑端提示，`router.replace` 到 `/bill/:id/asset`。记账、概览、预算、计划的跳转不变。底部五个入口仍在，进入后「资产」为当前项（依赖 T006、T009）
- [x] T012 [US1] 在 `mobile-h5/src/views/asset/OverviewView.vue` 做总览。标题体现家庭资产。成员栏只有「全部」和 `GET /members` 返回的未隐藏成员，加上进入成员页的入口；不得出现「已隐藏」。筛选写入 `mobile-h5/src/stores/asset-view.ts`，供以后的子页复用。卡片展示净资产、总资产、总负债。总资产不含负债，净资产等于总资产减总负债，金额为接口按当前汇率折算的人民币。打开时用响应 `defaultAsOf` 作为对比日；没有 `defaultAsOf` 时卡片变化显示没有变化并说明原因，不得改用上一个自然月末。每一笔用 `GET /list-stats` 相对上一次盘点的变化，不得改用对比日。分组按流动资金、固定资产、投资理财、应收款、负债的顺序，只显示有数据的组，默认收起。展开后先按成员小计，再列名称、人民币金额和变化。分组变化等于组内各笔之和。外币在人民币旁标原币，原币不用涨跌色。没有资产时说明这个账本还没有资产，并给出登记入口，不得只显示 0。名称很长时须完整可读。本任务不画年度收支对账，不放「移除固定资产」和「隐藏金额」（依赖 T007、T011）
- [x] T013 [US1] 用 `miniapp/miniprogram/packageAsset/pages/asset/index.ts`、`index.wxml`、`index.wxss`、`index.json` 替换「请到电脑端查看或管理」。交互和口径与 T012 相同。进入页继续调用 `miniapp/miniprogram/utils/auth` 的 `guardPage`。底部 `book-tab-bar` 的 `active` 为 `asset`。成员状态用 `miniapp/miniprogram/utils/asset-view.ts`（依赖 T010）

**检查点**: 已有资产时，两端能在正常网络下 10 秒内看到净资产、总资产和总负债，且不用先填日期。不再出现请到电脑端的占位或提示

---

## 阶段 4：用户故事 2 - 登记资产、盘点并维护成员与汇率（优先级：P1）

**目标**: 手机可以新增和编辑资产、记盘点、管理未隐藏成员，并保存港币和美元汇率

**独立测试**: 在空账本先添加一名资产成员，登记一笔人民币资产，再记一笔盘点、改盘点日、尝试删到只剩一条；然后改汇率并核对总览重算。不必打开月历或养老

### 用户故事 2 的实现

- [x] T014 [P] [US2] 在 `mobile-h5/src/api/asset.ts` 实现 `POST /member`、`PUT /member`、`DELETE /member`、`POST /`、`PUT /`、`DELETE /`、`GET /records`、`POST /record`、`PUT /record`、`DELETE /record`、`GET /exchange-rate`、`PUT /exchange-rate`。盘点查询的 `pageSize` 固定为 10
- [x] T015 [P] [US2] 在 `miniapp/miniprogram/apis/index.ts` 实现与 T014 相同的方法
- [x] T016 [US2] 在 `mobile-h5/src/views/asset/FormView.vue` 做登记和编辑。没有未隐藏成员时先要求去添加，不能保存没有归属的资产。名称必填。资产成员必须是本账本未隐藏成员。资产类型为流动资金、固定资产、投资理财、应收款、负债之一。非负债的四笔钱必填：活钱、稳健、长期、保险。负债不保存四笔钱，计入总负债、不计入总资产。币种为人民币、港币或美元，默认人民币，保存后不能改。当前金额不小于 0，不能空。新建须填盘点日。四笔钱为保险时才保留险种和年交保费，年交保费不小于 0；不填险种则归入其他；改离保险后清空这两项。表单不展示渠道和周转周期，也不提供「计入净资产」。新建不传这两项。编辑必须把读到的渠道和周转周期原样送回。编辑时当前金额与最新盘点不同才由服务端新增一条，日期为保存当时；金额未变时说明这次不会新增盘点。删除前可取消，确认后该笔及其盘点不再出现。取消后数据与操作前一致（依赖 T014、T012）
- [x] T017 [P] [US2] 在 `miniapp/miniprogram/packageAsset/pages/form/index.ts`、`index.wxml`、`index.wxss`、`index.json` 实现与 T016 相同的登记和编辑（依赖 T015、T013）
- [x] T018 [US2] 在 `mobile-h5/src/views/asset/RecordsView.vue` 做盘点。只列出实际盘点，按日期从新到旧，每页 10 条，能翻到全部。日期最新的一条标为当前金额。同一天多条以最后保存的为准。新增金额不小于 0 且日期必填，成为新的一条。修改写回选中的这一条，不另起一条。只剩一条时不能删除，仍可改日期或金额。删除前可取消（依赖 T014）
- [x] T019 [P] [US2] 在 `miniapp/miniprogram/packageAsset/pages/records/index.ts`、`index.wxml`、`index.wxss`、`index.json` 实现与 T018 相同的盘点列表（依赖 T015）
- [x] T020 [US2] 在 `mobile-h5/src/views/asset/MembersView.vue` 做成员与汇率。可以新增没有登录账号的名字、改名、隐藏。与当前未隐藏成员同名时不能再添加。改名后名下资产和该成员自己的养老计划一起改名，金额不变。隐藏调用 `DELETE /member`，确认前可取消。隐藏后名字离开名单，页面不列出已隐藏成员，没有恢复按钮。名下资产仍出现在「全部」里。当时正在看这名成员时，`mobile-h5/src/stores/asset-view.ts` 的筛选回到「全部」。资产成员和记账成员不是同一份名单。汇率必须大于 0；未保存过时展示大于 0 的初始值并说明正在使用。保存后人民币汇总重算，原币和盘点条数不变。填 0 或留空不能保存（依赖 T014、T004）
- [x] T021 [P] [US2] 在 `miniapp/miniprogram/packageAsset/pages/members/index.ts`、`index.wxml`、`index.wxss`、`index.json` 实现与 T020 相同的成员和汇率。筛选重置走 `miniapp/miniprogram/utils/asset-view.ts`（依赖 T015、T005）

**检查点**: 改金额会多一条盘点且旧记录还在；只改名称时条数不变。隐藏后没有「已隐藏」和「恢复」。非法金额、空名称、非正汇率都被拒绝

---

## 阶段 5：用户故事 3 - 查看四笔钱、月历和趋势（优先级：P1）

**目标**: 从总览进入四笔钱、月历和趋势，口径与电脑端一致，图在页面内绘制

**独立测试**: 打开已有多年盘点的账本，分别进入这三页，切换成员、年份、区间和口径。不必修改养老计划

### 用户故事 3 的实现

- [x] T022 [P] [US3] 在 `mobile-h5/src/api/asset.ts` 实现 `GET /four-money`、`GET /monthly-report`、`GET /trend`。成员沿用 `mobile-h5/src/stores/asset-view.ts` 的筛选，空成员表示「全部」
- [x] T023 [P] [US3] 在 `miniapp/miniprogram/apis/index.ts` 实现与 T022 相同的三个查询
- [x] T024 [P] [US3] 在 `mobile-h5/src/views/asset/FourView.vue` 展示活钱、稳健、长期和保险。前三类比例之和为 100%，保险不参与该比例，并展示年交保费。没有数据的一类说明暂无。负债不进入这四类，除非接口仍返回历史上已归入这三类的负债。成员筛选与总览保持一致。不引入图表库，不复制 `mobile-h5/src/components/charts/BudgetPieChart.vue`（依赖 T022、T012）
- [x] T025 [P] [US3] 在 `miniapp/miniprogram/packageAsset/pages/four/index.ts`、`index.wxml`、`index.wxss`、`index.json` 实现与 T024 相同的四笔钱。四笔钱本身不用 echarts（依赖 T023、T013）
- [x] T026 [P] [US3] 在 `mobile-h5/src/views/asset/MonthView.vue` 做月历。可切换年份。今年只统计到本月并标出本月，已结束年份画满 12 个月并标出 12 月。类别为流动资金、投资理财、固定资产、应收款、总资产、总负债、总净资产。没有盘点的月份留空，不画成 0；金额为 0 的盘点必须显示为 0。较年初用接口结果：所看月份减去该年 1 月 1 日之前最近一次盘点，没有该基准时按 0；所看月份没有金额时显示「—」。颜色用 `mobile-h5/src/utils/asset-tone.ts`，总负债增加为负向、减少为正向。月历用 echarts 柱状图（依赖 T022、T007）
- [x] T027 [P] [US3] 在 `miniapp/miniprogram/packageAsset/pages/month/index.ts`、`index.wxml`、`index.wxss`、`index.json` 实现与 T026 相同的月历，颜色用 `miniapp/miniprogram/utils/asset-tone.ts`（依赖 T023）
- [x] T028 [P] [US3] 在 `mobile-h5/src/views/asset/TrendView.vue` 做趋势。默认记账以来、按月、全部。范围还有今年、近 1 年、近 3 年、近 5 年和自定义。自定义结束月晚于本月时只画到本月并说明。开始月晚于结束月时不画图并说明原因。没有盘点时说明没有盘点。口径为全部时，流动资金、投资理财、固定资产、应收款向上堆叠，负债按负数画在下方；口径为净资产时只画总净资产。没有盘点的月份留空。按年时每一年取该区间内最后一个有数的月份。「区间变化」带正负号和涨跌色，负债减少为正、增加为负。趋势用 echarts 面积堆叠图（依赖 T022、T007）
- [x] T029 [P] [US3] 在 `miniapp/miniprogram/packageAsset/pages/trend/index.ts`、`index.wxml`、`index.wxss`、`index.json` 实现与 T028 相同的趋势（依赖 T023）

**检查点**: 三页都能随成员筛选变化。没有盘点的月份是空，不是 0。月历和趋势使用 echarts，四笔钱不用图表库

---

## 阶段 6：用户故事 4 - 查看并设置养老计划（优先级：P2）

**目标**: 「全部」和每一名未隐藏成员可以各有一份养老计划，并看到收支推算和目标对比

**独立测试**: 为「全部」设置一份有目标时间的计划，核对进度、切换近 3 年与近 5 年、勾选或取消剔除无收入月份，并看到对比图。再切到没有计划的成员，确认是空态

### 用户故事 4 的实现

- [x] T030 [US4] 在 `mobile-h5/src/api/asset.ts` 与 `miniapp/miniprogram/apis/index.ts` 实现 `GET /retire-plan` 和 `PUT /retire-plan`。查询参数为 `billId`、可选 `memberId`、`incomeYears`、`expenseYears`、`skipIdle`（`1` 或 `0`）。路径已经在 T001、T002 声明过
- [x] T031 [US4] 在 `mobile-h5/src/views/asset/RetireView.vue` 做养老计划。没有计划时说明还没有，并可以设置。目标金额必须大于 0。开始月份不得晚于本月。目标月份可以不填；填写时必须晚于本月。不合格时不保存并说明原因。计划卡展示目标金额、当前净资产、目标时间、金额进度；有目标时间时还展示剩余时间和时间进度，并说明领先还是落后。进度最多到 100%。已超过目标时写出超过的金额。当前净资产始终含固定资产。收入和支出可分别选近 3 年或近 5 年，默认都是近 3 年。默认剔除没有收入的月份，且只影响收入平均；页面列出被剔除或仍按 0 计入的月份。展示月均收入、月均支出和月均结余。结余大于 0 且未达目标时写出大约还需多久和预计月份；有目标时间时说明早晚，以及按目标时间每月需要多少结余。结余不大于 0 时说明达不到。已达目标时说明超过多少。结论正文深色可辨，时长和到达月份更醒目。对比图从开始月画到本月；目标月更早则画到目标月。实线是每月月底净资产，没有盘点的月份断开。有目标时间时目标线匀速涨到目标金额，否则是目标金额的水平线。看单人时月均支出不拆入共同支出和公共支出；「全部」先按人平均再相加。写明不计投资收益和通胀、只作参考。没有任何收支时月均为 0，不得报错。隐藏后的成员不在筛选里，不能打开他的计划。图在页面内绘制（依赖 T030、T012）
- [x] T032 [P] [US4] 在 `miniapp/miniprogram/packageAsset/pages/retire/index.ts`、`index.wxml`、`index.wxss`、`index.json` 实现与 T031 相同的养老计划（依赖 T030、T013）

**检查点**: 空态可设置。不合格目标被拒绝且已保存计划不变。结论文字看得清。没有盘点的月份在对比图上断开

---

## 阶段 7：用户故事 5 - 临时查看口径，且两端一致（优先级：P2）

**目标**: 总览可以暂时移除固定资产、隐藏金额、更换对比日。这些选择不改已保存数据，也不影响其他页面的口径

**独立测试**: 在总览打开和关闭「移除固定资产」、隐藏金额，把对比日改到一个已有盘点日再恢复。四笔钱、月历、趋势和养老的数字不随「移除固定资产」变化。电脑端资产组成仍可打开

### 用户故事 5 的实现

- [x] T033 [US5] 在 `mobile-h5/src/views/asset/OverviewView.vue` 增加「移除固定资产」和「隐藏金额」，状态放在 `mobile-h5/src/stores/asset-view.ts`。打开「移除固定资产」时只从卡片总资产和净资产减去当前固定资产合计，总负债不变，且不把该开关传给接口。分组仍含固定资产。隐藏金额只把资产各页金额显示为不可读掩码，再次点击恢复数字。对比日可选今天或更早；晚于今天的日期拒绝，已保存数据不变。手选对比日只重算卡片总变化，每一笔仍较上一次盘点。可以恢复为 `defaultAsOf`。离开资产或换账本后两个开关关闭，对比日回到默认。资产各页读取同一份隐藏金额状态，包括 `OverviewView.vue`、`FourView.vue`、`MonthView.vue`、`TrendView.vue`、`RetireView.vue`、`FormView.vue`、`RecordsView.vue`、`MembersView.vue`。后来加在总览上的年度收支对账也用这份状态（依赖 T012、T004）
- [x] T034 [P] [US5] 在 `miniapp/miniprogram/packageAsset/pages/asset/index.ts`、`index.wxml` 以及 `four`、`month`、`trend`、`retire`、`form`、`records`、`members` 各页实现与 T033 相同的开关、掩码和对比日。总览上后来加上的对账金额也用同一份掩码。状态用 `miniapp/miniprogram/utils/asset-view.ts`（依赖 T013、T005）
- [x] T035 [US5] 复核 `frontend/src/views/asset/` 未被本切片改版，资产组成入口仍在。复核手机页面没有 `GET /sankey`，也没有「计入净资产」。只完成 H5 或只完成小程序时，不得把本故事标成完成（依赖 T033、T034）

**检查点**: 开关只改总览卡片上的总资产和净资产。重新进入资产后开关为关闭。电脑端资产组成仍可打开

---

## 阶段 8：用户故事 6 - 对照一年的记账和资产变化（优先级：P2）

**目标**: 总览分组下面提供年度收支对账，年份用底部弹层选择，不提供按月明细

**独立测试**: 打开已有记账和盘点的账本，在总览切到今年和某一年，再切到一名成员。页面上没有「按月明细」

### 用户故事 6 的实现

- [x] T036 [US6] 在 `mobile-h5/src/api/asset.ts` 与 `miniapp/miniprogram/apis/index.ts` 实现 `POST /ledger`。正文只有 `billId`、`year`、可选 `memberId`，不传数量。`memberId` 只传当前选中的一名未隐藏成员
- [x] T037 [US6] 在 `mobile-h5/src/views/asset/OverviewView.vue` 的分组下面增加「年度收支对账」。年份来自响应 `years`，用 Vant 底部弹层列出，当前年标出。点某一年后关闭并重新请求。点取消或遮罩不改年份。默认今年；今年不在列表里时用最晚的一年。今年统计到本月，已结束年份到 12 月。展示 `income`、`expense`、`surplus`、`assetChange`、`netChange`、`diff`、`equal`。单人时展示 `exclusive`、`sharedShare`、`publicShare`、`effectiveIncome`。`unmatched` 时收入和支出为 0，并展示 `message`。有 `quantityRules` 时展示规则说明。期初、期末用 `openingMonth`、`closingMonth`、`openingAsset`、`closingAsset`；缺少盘点时总资产变化和差额显示「—」。差额绝对值小于 0.01 元标成相等，否则标成不相等。说明里给出同期净资产变化，并提示估值、漏记、没及时盘点和还贷本金。不提供按月明细。对账不受「移除固定资产」影响。打开隐藏金额时，对账金额使用 T033 的同一份掩码。只查看，不改记账、概览分摊或盘点。对账年份写入 `mobile-h5/src/stores/asset-view.ts`，离开资产或换账本后回到默认（依赖 T036、T012、T033）
- [x] T038 [P] [US6] 在 `miniapp/miniprogram/packageAsset/pages/asset/index.ts`、`index.wxml`、`index.wxss` 用底部弹层实现与 T037 相同的年度收支对账，包括隐藏金额时的掩码。不得用系统下拉框，也不得把年份铺成一排（依赖 T036、T013、T034）

**检查点**: 同一年、同一成员的总收入、总支出、总资产变化和差额与电脑端一致。页面没有按月明细

---

## 阶段 9：打磨与横切

**目的**: 手册和两端一起验收。宪章已是 3.6.0，实现时不得把家庭资产改回只在电脑端

- [x] T039 [P] 更新 `docs/用户手册.md`：手机可以管理总览、四笔钱、月历、趋势、年度收支对账、养老、登记、盘点和成员汇率。去掉「家庭资产只在电脑网页、小程序没有这一页」以及「资产尚未在移动端交付」。写明资产组成、类型配置、概览规则和近五年收支趋势仍在电脑端。写明手机不提供「已隐藏」和恢复成员
- [x] T040 [P] 复核 `.specify/memory/constitution.md` 已是 3.6.0。原则 II 写明小程序与 H5 可管理家庭资产的总览、四笔钱、月历、趋势、养老、登记、盘点、成员汇率和年度收支对账；资产组成、类型配置、概览规则和近五年收支趋势仍只在电脑端。若版本仍低于 3.6.0，或仍写家庭资产只在电脑端，本任务不得勾完
- [x] T041 在 `mobile-h5` 目录执行 `pnpm typecheck`（依赖 T012、T016、T018、T020、T024、T026、T028、T031、T033、T037）
- [x] T042 按 `specs/026-mobile-family-asset/quickstart.md` 对 H5 和小程序做手工验收，并与电脑端对照总负债、四笔钱、一个月的月末净资产、两种「移除固定资产」状态下的卡片、一笔较上一次盘点的变化，以及一年对账。只完成一端时本切片不算完成。确认手机没有资产组成，电脑端资产页没有被改版（依赖 T035、T038、T039、T040）

---

## 依赖与执行顺序

### 阶段依赖

- **准备（阶段 1）**: 无依赖，可立即开始
- **基础能力（阶段 2）**: 依赖准备完成——**阻塞**全部用户故事
- **用户故事（阶段 3+）**: 均依赖基础能力完成
- **打磨（阶段 9）**: 依赖所需用户故事均已完成

### 用户故事依赖

- **用户故事 1（P1）**: 基础能力完成后即可开始。它交付两端总览，是 MVP
- **用户故事 2（P1）**: 依赖用户故事 1 的总览已有登记入口和成员筛选。盘点和成员页可单独用空账本验收
- **用户故事 3（P1）**: 依赖用户故事 1 的成员筛选。不依赖登记和养老
- **用户故事 4（P2）**: 依赖用户故事 1 的成员筛选。推算读取现有记账，不依赖用户故事 2 的新盘点
- **用户故事 5（P2）**: 依赖用户故事 1 的总览。掩码要盖住已做好的四笔钱、月历、趋势、养老和盘点；这些页尚未存在时，先做总览开关，页补上后再接同一状态
- **用户故事 6（P2）**: 依赖用户故事 1 的总览分组。对账数字不依赖用户故事 5 的开关，但验收时要确认开关不改变对账

### 每个用户故事内部

- 先接通请求，再写 H5 与小程序
- 同一故事里两端页面可并行
- 本故事检查点通过后再进入下一故事

### 并行机会

- T002 与 T003 可并行，并与 T001 并行
- T005 与 T007 可并行
- T009 与 T010 可并行
- T014 与 T015 可并行；T017 与 T016、T019 与 T018、T021 与 T020 可并行
- T022 与 T023 可并行；T024 至 T029 在各自请求完成后可并行
- T031 与 T032 可并行（都依赖 T030）
- T033 与 T034 可并行
- T037 与 T038 可并行（都依赖 T036）
- T039 与 T040 可并行

---

## 并行示例：用户故事 1

```text
任务: "在 mobile-h5/src/api/asset.ts 实现成员、总览和列表统计"
任务: "在 miniapp/miniprogram/apis/index.ts 实现成员、总览和列表统计"
```

两端总览都依赖各自的请求完成后再写。H5 总览还依赖底栏不再提示去电脑端。

---

## 实施策略

### 先做 MVP（仅用户故事 1）

1. 完成阶段 1：准备
2. 完成阶段 2：基础能力
3. 完成阶段 3：用户故事 1
4. **停下来验收**：两端能看到净资产、总资产、总负债，并能切换成员、展开一组
5. 通过后再做登记、四笔钱和其余页面

### 增量交付

1. 准备 + 查看状态 → 空页面和路由就绪，服务端无新接口
2. 用户故事 1 → 两端能看家庭净资产
3. 用户故事 2 → 能登记、盘点、隐藏成员和改汇率
4. 用户故事 3 → 补上四笔钱、月历和趋势
5. 用户故事 4 → 补上养老计划
6. 用户故事 5 → 临时开关和两端一致，电脑端资产组成仍在
7. 用户故事 6 → 总览下方年度收支对账
8. 更新用户手册，并复核宪章仍是 3.6.0 → 才能按 SC-005 宣称交付

### 多人并行策略

1. 共同完成阶段 1 和阶段 2
2. 之后一人做 H5 页面，一人做小程序页面
3. 用户故事 3 的三页可以分给不同的人
4. 一人改用户手册，另一人复核宪章 3.6.0 没有被改回

---

## 备注

- [P] 任务 = 不同文件、无未完成依赖
- 用户故事 1、2、3 都是 P1；顺序按规格排列，因为子页要挂在总览上
- 不新建表，不改资产服务口径，不新增恢复成员
- 不得把新页面写进已关停的旧 `mobile/`
- 对比日默认用接口 `defaultAsOf`，不用原型演示里的上一个自然月末
- 每完成一个任务或逻辑组再继续下一项
- 可在任一检查点停下，单独验收该故事

---

## Phase 10: Convergence

- [x] T043 在 `mobile-h5/src/views/asset/FormView.vue` 与 `miniapp/miniprogram/packageAsset/pages/form/` 读取隐藏金额状态，打开隐藏金额时已保存的当前金额和年交保费显示为掩码 per FR-012 (partial)
- [x] T044 保留家庭资产月历、趋势和养老图的 echarts。H5 继续用现有依赖，小程序继续用 `miniapp/miniprogram/packageAsset/components/ec-canvas`，不进主包。四笔钱仍不用图表库 per plan: 月历、趋势、养老使用 echarts (contradicts)
