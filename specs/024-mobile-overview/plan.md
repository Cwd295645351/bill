# 实现计划：移动端收支概览

**功能分支**: `024-mobile-overview` | **日期**: 2026-11-19 | **规格**: [spec.md](./spec.md)

**输入**: `/specs/024-mobile-overview/spec.md` 中的功能规格

**说明**: 本文件由 `/speckit-plan` 填写；其定义描述执行工作流。

## 摘要

在微信小程序与移动端 H5 的账本内交付收支概览：月/年切换、同一行的开始和结束时间、四个汇总数、按成员汇总的收入、结算建议、支出结构与分类明细。手机不提供数量、归属、「计算」、近五年趋势，也不配置规则、不交付家庭资产。

技术路径：未传数量时，现有 `POST /api/v1/overview/settlement` 改为按自然年结算再合并，电脑端跨年查询直接使用这套结果，页面不用改。手机新增只读 `GET /api/v1/overview/mobile` 与 `GET /api/v1/overview/mobile/records`，结算和成员份额只复用上述计算。四个汇总数复用 `getBlance`。详见 [research.md](./research.md)。

## 技术上下文

**语言/版本**: TypeScript。后端 Node.js + Koa 2（`server/`）；H5 Vue 3 + Vite（`mobile-h5/`）；小程序原生 + TypeScript（`miniapp/`）。

**主要依赖**: 现有概览模块 `getBlance`、`buildSettlement`、账本成员校验；H5 的 `BookTabBar` 与 Vant；小程序已有 `packageOverview` 占位页和 `book-tab-bar`。不新增图表库。

**存储**: 继续使用现有记账、成员、概览规则与年度配置表。无新表、无迁移。手机只读年度配置。

**测试**: 无新测试框架。按 [quickstart.md](./quickstart.md) 手工验收；对照 [contracts/overview-mobile-api.md](./contracts/overview-mobile-api.md)。同一年与跨年都和电脑端按同一区间对账。

**目标平台**: 微信小程序；移动端 H5 部署路径 `/mobile/`。电脑端 `/pc/` 不改页面，但跨年结算随服务端计算一起验收。后端公开前缀仍是 `/api/v1`。

**项目类型**: monorepo 增量。主改 `server/modules/overview`、`mobile-h5/`、`miniapp/miniprogram/packageOverview`，并更新用户手册与宪章原则 II。

**性能目标**: 已有数据时，从点「概览」到看到当前月四个汇总数和结算建议，正常网络下不超过 10 秒（SC-001）。分类明细在点开后再请求。

**约束**: 不恢复旧 `mobile/`。不改电脑端概览的默认区间、查询按钮和近五年趋势。不在手机上写规则。未传数量的跨年结算必须改在 `POST /overview/settlement` 内完成，使电脑端与手机一致。开始不得晚于结束。占比两位小数且列表相加为 100.00%。

**规模/范围**: 两端各一个概览页；两个只读接口；账本内底栏「概览」进入真实页，「资产」仍提示到电脑端。

## 宪章检查

*门禁：须在阶段 0 研究前通过；阶段 1 设计后再复核一次。*

对照 `.specify/memory/constitution.md`（v3.5.0）。

| 原则 | 设计前 | 设计后 |
|------|--------|--------|
| I. 存量优先，增量规格化 | 通过。交付手机概览；电脑端页面、规则配置、家庭资产、近五年趋势保持原样。跨年结算是同一套计算的修正。 | 通过。新接口只读。结算成功体字段不变，未传数量的跨年计算改为按年合并。 |
| II. 多端边界不可混用 | 通过。v3.5.0 已写明小程序与 H5 可查看收支概览；近五年趋势、规则配置和家庭资产仍在电脑端；手机不提供临时试算。手册仍在交付时更新。 | 通过。源码只落在 H5、小程序概览分包和概览模块，不碰旧 `mobile/`，不把规则配置塞进手机。 |
| III. 账本隔离与记账权限 | 通过。非成员不能看。记账人不可在概览里修改。归属筛选沿用现有公共账与多人支出规则。 | 通过。两个新接口都走 `requireMember`。明细展示记账原金额。 |
| IV. 公开契约向后兼容 | 有条件通过。新增只读路径。未传数量时，跨年结算的计算结果会从「开始年套整段」改为按年合并；成功体字段不变，同一年结果不变。规格已批准这次计算修正。 | 通过。传入数量时仍按整段使用调用方给的值。电脑端当前不传数量。 |
| V. 密钥与部署约束 | 通过。无新密钥。H5 仍在 `/mobile/`，小程序仍请求同一套 `/api`。文档用中文。 | 通过。无环境变量、无新静态路径。 |
| 技术栈落点 | 通过。概览仍在 `server/modules/overview`。H5 在 `mobile-h5/src`，小程序在既有 `packageOverview`。 | 通过。见下方源码树。 |

无未通过的门禁。原则 II 已升到 3.5.0。用户手册仍在交付时更新。

### 设计后复核

选定方案与研究记录一致：先把未传数量的 `POST /overview/settlement` 改成按年合并，电脑端跨年查询不用改页面。手机读 `GET /overview/mobile`，结算和成员份额只调用这段计算；点分类再读 `GET /overview/mobile/records`。总支出、总投资、总收入复用 `getBlance`，避免基金口径分叉。环形图在页面内绘制，不复制预算分包的 echarts。H5 从底栏进入 `/bill/:id/overview`；小程序替换占位页。资产入口维持现状。

实现顺序建议：未传数量的按年结算 → 电脑端跨年对账 → 手机聚合与明细接口 → H5 页面与路由 → 小程序页面 → 手册与宪章 3.5.0 → 按快速验收抽查两端。

## 项目结构

### 文档（本功能）

```text
specs/024-mobile-overview/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── overview-mobile-api.md
├── checklists/requirements.md
└── tasks.md                 # /speckit-tasks 再创建
```

### 源码（仓库根）

```text
server/modules/overview/
├── router.ts                 # 增加两个 GET；balance 与 threeYearCost 的行为不变
├── query-service.ts          # 继续提供 getBlance；手机汇总调用它
├── settlement.ts             # 抽出按年切段与净额配对；成功体字段不变
├── settlement-route.ts       # 未传数量时按年合并；传入数量时仍按整段使用
└── mobile-view.ts            # 新建：复用按年结算，并组装汇总、占比、笔数与明细

mobile-h5/src/
├── api/overview.ts           # 新建：两个只读请求
├── views/overview/OverviewView.vue
├── router/index.ts           # /bill/:id/overview
└── components/BookTabBar.vue # 概览从「只提示电脑端」改为进入概览页；资产仍提示

miniapp/miniprogram/
├── apis/index.ts             # 增加两个只读方法
└── packageOverview/pages/overview/
    ├── index.ts
    ├── index.wxml
    ├── index.wxss
    └── index.json            # 替换占位页；标题体现概览

docs/用户手册.md              # 手机可看概览；近五年、规则、资产仍在电脑端
.specify/memory/constitution.md  # 原则 II 已升为 3.5.0
```

**结构决策**: 跨年结算落在现有概览模块，电脑端页面继续调用原来的结算接口。手机页面只消费只读聚合。不新增领域目录，不改 `frontend/` 概览页，不恢复旧 `mobile/`。全局底栏仍是账本、记一笔、我的；账本内五个入口继续用现有自定义底栏。

## 复杂度跟踪

| 违规项 | 为何需要 | 更简单方案及否决原因 |
|--------|----------|----------------------|
| （已关闭）原则 II 曾写概览只在电脑端 | 分析补救已把宪章升到 3.5.0。手册仍待 T024 | — |
| 未传数量时改变跨年结算结果 | 电脑端也会查询跨年区间。开始年套整段会用错年份的数量配置 | 只在手机接口里合并，电脑端跨年仍和手机不一致 |
| 手机仍新增两个只读接口 | 手机要占比、笔数、收入行和分类明细；结算本身不再单独发明 | 让两端各自拼这些展示字段，占比和笔数会分叉 |
| 两端各做一套概览界面 | 规格要求两端都完成才算交付 | 只做一端违反 FR-001 与 SC-004 |
| 允许内部抽取结算配对函数 | 跨年要把各年净额相加后再生成与现网相同的句子，避免复制取整规则 | 复制一套转账配对，同一年对账容易漂 |
