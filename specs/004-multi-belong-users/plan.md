# Implementation Plan: 支出归属人支持多选

**Branch**: `004-multi-belong-users` | **Date**: 2026-10-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-multi-belong-users/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

电脑端和小程序记支出时，归属人可以选多名成员。概览按「同一组归属人」先汇总、再按组内有效收入比例分一次。按成员搜索时能找到他参与的多人支出。收入只能归属一名成员，服务端拒绝「全部」和多人。手机网页不改。

做法见 [research.md](./research.md)：

- 不新建表。加宽 `transactions.belong_user_id`（36 → 1024）和 `belong_user_name`（64 → 2048）。多人记账把按成员顺序排好的 id 用英文逗号拼接存入 `belong_user_id`，名字用「、」拼接存入 `belong_user_name`，与表示「全部」的空串区分开。线上通过 `deploy/sql/` 下的升级脚本执行，并提供回滚脚本。
- 按成员筛选统一用 `FIND_IN_SET`，单人和多人都能命中。
- 接口用 `belongUserIds: string[]` 替换 `belongUserId`，旧字段从记账相关的请求和响应中移除。数据库列名不变，只在服务端内部转换。写入接口收到只带旧字段的请求时明确拒绝，不会悄悄存成「全部」。小程序同时接入强制更新。
- 结算复用「全部」支出已有的「汇总后分一次、逐笔对齐」函数，按组合各算一遍。

## Technical Context

**Language/Version**: 服务端 Node.js + Koa 2（`server/`）。电脑端 Vue 3 + Vite + TypeScript（`frontend/`）。小程序原生 + TypeScript + Vant Weapp（`miniapp/`）。

**Primary Dependencies**: Sequelize、Element Plus（`el-select multiple`）、Vant Weapp。不新增 npm 依赖。

**Storage**: MySQL `transactions` 表加宽两列：`belong_user_id` 改为 `VARCHAR(1024)`，`belong_user_name` 改为 `VARCHAR(2048)`，不新建表、不新增列、不迁移数据。`sequelize.sync()` 不会修改已有列，所以线上要先执行 `deploy/sql/004-multi-belong-users-upgrade.sql`，再发布新代码；新装环境由模型直接建出宽列。升级和回滚 SQL 见 [data-model.md](./data-model.md)。

**Testing**: 仓库没有自动化测试，`server` 的 test 脚本仍是占位。分账用 `node -e` 直接调用纯函数核对规格的 8 个例子，其余按 [quickstart.md](./quickstart.md) 手工验收。

**Target Platform**: 电脑网页（记账、搜索、导出、概览）、微信小程序（记一笔、编辑、流水、搜索）。手机网页不改，也不验收。

**Project Type**: 多端 Web 应用加小程序，共用一套 REST API。

**Performance Goals**: 家庭账本规模。名单和名字都在主表同一行，列表、导出、结算不增加查询次数。按成员筛选由 `IN` 改为 `FIND_IN_SET`；`belong_user_id` 本来就没有索引，性能特征不变。不设并发指标。

**Constraints**:

- 金额按整数「分」计算。同组先汇总，再分一次；除最后一名外四舍五入，最后一名拿剩余。
- 没有多人归属支出的账本，概览输出与改动前逐字段相同。
- 记账相关接口不再接收或返回 `belongUserId`。旧客户端的写入请求一律拒绝，提示更新；查询请求只是丢掉归属人筛选条件。结算的 `quantityInputs[].belongUserId` 不在替换范围。
- 名单顺序固定为 `bill_users.id` 升序。
- 发布顺序固定：执行升级 SQL → 发布服务端和电脑端 → 立即提交小程序新版本审核并发布。小程序新版本发布后，服务端回滚必须和小程序版本回退一起做（规格 FR-022）。

**Scale/Scope**: 成员数不设上限。改动涉及记账增改查、批量新增、搜索、导出、汇总分组、结算，电脑端记账弹窗与概览类型明细，小程序记账表单与流水底色，以及用户手册。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 设计前 | 设计后 |
|------|--------|--------|
| I. 存量优先，增量规格化 | 通过。规格写明了单人、「全部」、汇总数字、近三年趋势、批量解析和导入都不动。 | 通过。没有顺带重构。电脑端概览左侧只显示收入，本次保持不变（规格 FR-011）。用户手册按 FR-019 同步。 |
| II. 多端边界不可混用 | 通过。规格点名电脑端、小程序、后端；手机网页不改。 | 通过。小程序只改记账表单和流水底色，没有新增概览或分账入口。手机网页目录没有改动。 |
| III. 账本隔离与记账权限（v1.2.0） | 通过。宪章已修订为「支出可多选、收入仅单人、全员勾选不等于『全部』」。 | 通过。名单只接受本账本成员；按成员筛选的条件始终和 `bill_id` 一起使用，限定在账本内。编辑权限校验在名单校验之前，被选为归属人不获得编辑权。 |
| IV. 公开契约向后兼容 | 需关注。收入拒绝「全部」会改变旧客户端的结果。 | **规格已显式批准破坏性升级（FR-020）**：记账相关接口删掉了 `belongUserId`，理由见下方 Complexity Tracking，字段对照见 [contracts/transaction-belong-users.md](./contracts/transaction-belong-users.md)。收入拒绝「全部」是规格 FR-002 的要求。表结构只加宽两列，不改数据；附带回滚脚本，先把多人记账降级为「全部」再改回原长度。 |
| V. 密钥与部署约束 | 通过。不新增密钥，不改部署。 | 通过。 |

原则 IV 有一处违反，已在 Complexity Tracking 中写明理由，按宪章治理条款可以进入实现。其余原则没有违反。

## Project Structure

### Documentation (this feature)

```text
specs/004-multi-belong-users/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── transaction-belong-users.md
└── tasks.md              # 由 /speckit-tasks 生成，本命令不创建
```

### Source Code (repository root)

```text
deploy/sql/004-multi-belong-users-upgrade.sql      # 新建：加宽 belong_user_id、belong_user_name
deploy/sql/004-multi-belong-users-rollback.sql     # 新建：多人归属降级为「全部」后改回原长度
deploy/README.md                                   # 新增「数据库升级脚本」一节：备份、执行顺序、核对 SQL

server/database/models/index.js                    # Transaction 的两列长度改为 1024、2048
server/database/services/belongUsers.js            # 新建：分隔符常量、isMultiBelong/splitBelongIds、名单解析与校验（含旧请求识别）、拼接写入值、FIND_IN_SET 筛选条件、响应中 belongUserId → belongUserIds
server/routes/transaction/controller.js            # 增、改、批量新增只读 belongUserIds；buildFilter 与导出读 belongUserIds；列表、汇总响应去掉 belongUserId
server/routes/overview/controller.js               # balance 响应去掉 belongUserId、改为 belongUserIds；settlement 把拆出的名单传入计算
server/database/services/overviewSettlement.js     # 多人组合：汇总、组内分摊、指定类型平均扣减、支出结构对齐

frontend/src/views/record/hooks/use-belong-select.ts   # 新建：「全部」与成员互斥、收入单选、切换收支时的归属人处理
frontend/src/views/record/hooks/use-add-edit.ts        # 新增、编辑提交 belongUserIds；编辑时回填名单；批量新增把表格单选转成 [] 或 [id]
frontend/src/views/record/hooks/use-record.ts          # 搜索、导出的筛选条件改为 belongUserIds
frontend/src/views/record/Record.vue                   # 新增、编辑弹窗改为多选；搜索框绑定 belongUserIds；多人卡片固定底色
frontend/src/views/record/type.d.ts                    # belongUserId 换成 belongUserIds
frontend/src/types/bill.d.ts                           # RecordItem 的 belongUserId 换成 belongUserIds
frontend/src/views/overview/hooks/use-type-chart.ts    # 类型明细查询与前端过滤改用 belongUserIds；汇总明细读 belongUserIds
frontend/src/views/overview/Overview.vue               # 收入明细的 v-for key 改用 belongUserIds（显示内容不变）

miniapp/miniprogram/app.ts                             # 接入 wx.getUpdateManager 强制更新
miniapp/miniprogram/components/record-form/index.ts    # 平铺标签多选、收入单选、切换收支、上次名单；提交 belongUserIds
miniapp/miniprogram/components/record-form/index.wxml  # 去掉归属人滚轮选择器，改为标签
miniapp/miniprogram/components/record-form/index.wxss  # 标签样式
miniapp/miniprogram/pages/record-search/index.ts       # 筛选条件改为 belongUserIds
miniapp/miniprogram/utils/storage.ts                   # RecordPref 改存 belongUserIds，读取时兼容旧缓存
miniapp/miniprogram/utils/records.ts                   # 记账类型 belongUserId 换成 belongUserIds；多人归属固定底色

docs/用户手册.md                                        # 3.2 记账人与归属人、电脑端与小程序记账、概览分摊说明（FR-019）

# 明确不改
mobile/                                                # 手机网页本次不改，后续下线；上线后其记账写入会被拒绝
frontend/src/views/record/hooks/use-parse.ts           # 批量解析表格内部仍为单选，提交前由 use-add-edit 转换
frontend/src/views/overview/type.d.ts                  # quantityInputs 的 belongUserId 是数量规则的归属人，不替换
server/routes/transaction 的导入（/const）              # 只导入支出，按名字匹配单人
server/routes/overview 的 GET /threeYearCost
frontend/src/views/overview/Overview.vue 左侧明细       # 仍只显示收入
```

**Structure Decision**: 沿用现有分层，不新建表。名单的拼接、拆分和校验集中在 `server/database/services/belongUsers.js`，增改查、导出、汇总、结算都调用它，「多人」的判断只有一处定义。路由层只做取数和组装。分账仍在 `overviewSettlement.js` 这个纯函数里完成，前端只负责展示。电脑端「全部」与成员互斥的逻辑抽成一个 hook，供新增和编辑两个弹窗共用。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 原则 IV：记账相关接口删掉 `belongUserId`（请求、筛选、列表、汇总） | 用户决定改用 `belongUserIds` 后不再保留旧字段。两个字段并存，就要长期维护「冲突时以谁为准、只传一个时怎么推断」的规则，客户端也会继续混用 | 保留旧字段做兼容：用户已否决。缺失新字段时按空名单处理：旧版本小程序记的单人支出会被悄悄存成「全部」，导致错账。现方案对旧写入请求明确拒绝，并让小程序强制更新，把影响限制在「旧版本暂时不能记账」 |
