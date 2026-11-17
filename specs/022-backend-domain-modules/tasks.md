---
description: "后端按业务领域重组并补齐账本权限的任务列表"
---

# 任务列表：后端按业务领域重组并补齐账本权限

**输入**: `/specs/022-backend-domain-modules/` 下的设计文档

**前置条件**: plan.md（必须）、spec.md（用户故事必须）、research.md、data-model.md、contracts/

**测试**: 规格明确不新增测试框架。本列表不写自动化测试任务。每步用 `server` 目录的 `pnpm typecheck` 把关，最后按 quickstart.md 手工验收。

**组织方式**: 按用户故事分组，以便每个故事可独立实现与验收。

## 格式：`[ID] [P?] [Story] 描述`

- **[P]**: 可并行（不同文件、无未完成依赖）
- **[Story]**: 所属用户故事（US1、US2、US3、US4）
- 描述中须含确切文件路径

## 路径约定

- 后端源码在 `server/`，不是 `src/`
- 不改 `frontend/`、`mobile-h5/`、`miniapp/`，不恢复 `mobile/`
- 契约：`specs/022-backend-domain-modules/contracts/http-compatibility.md`、`specs/022-backend-domain-modules/contracts/bill-access.md`

## 阶段 1：准备（共享基础设施）

**目的**: 在搬任何业务代码之前，先让宪章允许新的目录落点

- [x] T001 修订 `.specify/memory/constitution.md`：把「技术栈与模块落点」从 `server/routes` 加 `server/database/services` 改为 `server/modules`；版本从 `3.3.0` 升到 `3.4.0`；文首同步影响说明记下 `3.3.0` → `3.4.0`。原则 I 与原则 IV 的原文保留。未完成不得开始 T002

---

## 阶段 2：基础能力（阻塞性前置）

**目的**: 准备响应、当前用户、按领域拆开的表定义，以及唯一的账本权限入口。旧路由此时仍可运行

**⚠️ 关键**: 本阶段完成前，不得开始用户故事实现

- [x] T002 [P] 新建 `server/http/res-model.ts`，内容与 `server/model/resModel.ts` 相同：成功 `retCode` 为 0，失败 `retCode` 为 1，字段仍是 `data`、`message`、`retCode`。`server/model/resModel.ts` 改为再导出新文件，旧路由继续从原路径导入，直到 T036 确认没有引用后再删除
- [x] T003 [P] 在 `server/http/outcome.ts` 定义服务返回值：成功携带数据，失败携带中文说明。服务不得写响应体
- [x] T004 [P] 在 `server/http/current-user.ts` 只读取登录凭证中的 `ctx.state.user.userId`，不读请求头里的用户编号
- [x] T005 在 `server/http/respond.ts` 把 `server/http/outcome.ts` 写成 `server/http/res-model.ts` 的现有响应（依赖 T002、T003）
- [x] T006 从 `server/database/models/index.ts` 抽出共用建表函数到 `server/database/models/helpers.ts`（主键、金额字段）。不改字段类型和列名
- [x] T007 [P] 在 `server/database/models/auth.ts` 定义 `users`、`user_wechats`、`encryptions`。一个账号只绑定一个微信；不新增解绑字段（依赖 T006）
- [x] T008 [P] 在 `server/database/models/bill.ts` 定义 `bills`、`bill_users`。`bills.creator` 不可转让；`bills.name` 仍为 STRING(128)；`isDel` 仍表示删除留档。成员资格只有「在 `bill_users` 中」或「不在」（依赖 T006）
- [x] T009 [P] 在 `server/database/models/catalog.ts` 定义支出类型、收入类型、支付方式、概览规则及年度数量。仍按账本隔离，不加列（依赖 T006）
- [x] T010 [P] 在 `server/database/models/budget.ts` 定义 `bill_budgets`、`bill_budget_details`。不改金额精度（依赖 T006）
- [x] T011 [P] 在 `server/database/models/plan.ts` 定义 `bill_plan_buys`（依赖 T006）
- [x] T012 [P] 在 `server/database/models/transaction.ts` 定义 `transactions`、`transaction_images`。`transactions.userId` 是记账人且保存后不可改；`belongUserId` 保持 STRING(1024)，`belongUserName` 保持 STRING(2048)；`money` 仍为两位小数；`isDel` 仍为删除留档。不把归属人改成另一张表（依赖 T006）
- [x] T013 [P] 在 `server/database/models/asset.ts` 定义 `members`、`assets`、`asset_records`、`bill_exchange_rates`、`asset_retire_plans`。`members` 是资产名单，不是账本成员。`assets.isDebt` 保持布尔、默认假，不加列；`assets.currency` 创建后不可改（依赖 T006）
- [x] T014 重写 `server/database/models/index.ts`，只建立跨表关联并汇总导出；`server/database/index.ts` 的导出名单保持 User、UserWechat、Encryption、Bill、BillUser、BillCostType、BillIncomeType、BillPayMethod、BillOverviewRule、BillOverviewRuleYear、BillPlanBuy、BillBudget、BillBudgetDetail、Member、Asset、AssetRecord、BillExchangeRate、AssetRetirePlan、Transaction、TransactionImage 以及 `sequelize`、`connectDB`（依赖 T007 至 T013）
- [x] T015 新增 `server/modules/access/service.ts` 与 `server/modules/access/index.ts`，且没有路由。公开 `requireMember(userId, billId)`、`requireCreator(userId, billId)`、`billIdOfAsset`、`billIdOfRecord`、`billIdOfMember`。调用方决定失败说明，以便已有说明保持原文（依赖 T014）
- [x] T016 [P] 修改 `server/app.ts` 的挂载：每个现有路由同时注册 `routes()` 和它自己的 `allowedMethods()`。去掉把 `budget.allowedMethods()` 套到概览上的写法。用错方法时必须表现为方法不对，而不是没有这个地址。不得改 `cors` 配置和 `app.keys`
- [x] T017 在 `server` 目录执行 `pnpm typecheck`，旧路由仍可编译（依赖 T005、T014、T015、T016）

**检查点**: 基础就绪——响应、模型导出和权限入口可用，旧接口尚未下线

---

## 阶段 3：用户故事 1 - 有权的人继续按现在的方式用账本（优先级：P1）🎯 MVP

**目标**: 把九组接口迁入领域模块。成员和创建者的成功结果、已有失败说明、金额算法和地址保持不变

**独立测试**: 用重组前已有的账本，在三端用同一账号完成登录进入、查看一笔已知明细、记账人改自己的账、再记一笔，电脑端再看一次区间汇总。笔数、金额、记账人、归属人与搬迁前一致，且三端源码没有改动

### 用户故事 1 的实现

- [x] T018 [P] [US1] 建立 `server/modules/bill/router.ts`、`server/modules/bill/service.ts`、`server/modules/bill/index.ts`，承接 `server/routes/bill/`。前缀仍是 `/api/v1/bill`。新建账本仍写入 `server/database/initDatas.ts` 的默认支出类型、收入类型和支付方式。该名单留在启动数据，不迁入模块。详情失败说明保持「找不到账本」；删除非创建者保持「找不到该账本或您非该账本的创建者」；退出未加入保持「您并未加入该账本」；非创建者移除成员保持「仅账本创建者可移除成员」；创建者退出保持「创建者不能退出账本」。本任务先不改「改名尚未校验创建者」的现状
- [x] T019 [P] [US1] 建立 `server/modules/catalog/router.ts`、`server/modules/catalog/service.ts`、`server/modules/catalog/index.ts`，承接 `server/routes/billtype/`。前缀仍是 `/api/v1/billtype`。非创建者说明保持「只有账本创建者才能管理类型」和「只有账本创建者才能管理概览规则」；已有的「无权访问该账本数据」「无权管理该账本数据」不改。改类型名时仍同步流水上的类型名称。`index.ts` 向记账公开按编号读取类型名称的函数
- [x] T020 [P] [US1] 建立 `server/modules/budget/router.ts`、`server/modules/budget/service.ts`、`server/modules/budget/index.ts`，承接 `server/routes/budget/` 与 `server/database/services/billService.ts` 中的 `saveBudget`。前缀仍是 `/api/v1/budget`。非成员说明保持「该用户并未加入此账本」。`index.ts` 公开「在给定事务中按现有算法重算并保存」，全仓库只保留这一套算法
- [x] T021 [P] [US1] 建立 `server/modules/plan/router.ts`、`server/modules/plan/service.ts`、`server/modules/plan/index.ts`，承接 `server/routes/plan/` 与 `server/database/services/billService.ts` 中的 `savePlanBuy`。前缀仍是 `/api/v1/plan`。非成员说明保持「该用户并未加入此账本」。`savePlanBuy` 只在本模块使用
- [x] T022 [US1] 在 `server/app.ts` 挂上账本、类型、预算、计划四个模块各自的路由和允许方法，并删除 `server/routes/bill/`、`server/routes/billtype/`、`server/routes/budget/`、`server/routes/plan/`。不留转调层。不得改 `cors` 配置和 `app.keys`（依赖 T018 至 T021）
- [x] T023 [US1] 建立 `server/modules/transaction/` 的 `router.ts`、`query-service.ts`、`command-service.ts`、`import-service.ts`、`image-service.ts`、`belong-users.ts`、`index.ts`。来源是 `server/routes/transaction/`、`server/database/services/transactionImageService.ts`、`server/database/services/belongUsers.ts`。前缀仍是 `/api/v1/transaction`。归属人仍支持「全部」、单人、多人，且勾选全部成员不等于「全部」。新增、批量新增、编辑、删除仍在同一 Sequelize 事务里更新流水、预算和用户累计收支，预算只调用 `server/modules/budget/index.ts` 的公开重算。是成员但不是记账人时，说明保持「只能编辑自己记的账单」「只能删除自己记的账单」。上传照片时不是成员仍为「未找到账本」；签名打开失败仍为「无权查看」。本任务先不补今天缺失的成员校验（依赖 T020）
- [x] T024 [P] [US1] 建立 `server/modules/overview/router.ts`、`server/modules/overview/query-service.ts`、`server/modules/overview/settlement.ts`、`server/modules/overview/index.ts`，承接 `server/routes/overview/` 与 `server/database/services/overviewSettlement.ts`。前缀仍是 `/api/v1/overview`。区间收支和近三年支出仍按现有内存循环计算。分账非成员说明保持「不是该账本成员」。本任务先不补 balance 与 threeYearCost 的成员校验
- [x] T025 [P] [US1] 建立 `server/modules/asset/` 的 `router.ts`、`member-service.ts`、`asset-service.ts`、`record-service.ts`、`record-query.ts`、`statistics-service.ts`、`exchange-service.ts`、`ledger-service.ts`、`retire-service.ts`、`fx.ts`、`month-end.ts`、`index.ts`。来源是 `server/routes/asset/` 以及 `server/database/services/` 下的 `assetLedgerService.ts`、`assetFx.ts`、`assetRetireService.ts`、`assetRecordService.ts`、`monthEndTotals.ts`。前缀仍是 `/api/v1/asset`。成员判断改调用 `server/modules/access/index.ts`，失败说明保持「无权查看该账本」。只有资源编号时先用 `billIdOfAsset`、`billIdOfRecord`、`billIdOfMember` 反查账本。资产名单不得代替 `bill_users`
- [x] T026 [P] [US1] 建立 `server/modules/auth/router.ts`、`server/modules/auth/service.ts`、`server/modules/auth/avatar-service.ts`、`server/modules/auth/index.ts`，承接 `server/routes/common/` 与 `server/database/services/avatarService.ts`。前缀仍是 `/api/v1/common`。滑块、会话和 JWT 签发留在 `server/modules/auth/router.ts`，不放进服务文件。登录成功结果仍含现在的访问凭证、刷新凭证、有效时长和用户资料。未登录放行名单保持 login、logout、login_config、captcha、register、wxLogin、wxBind、wxRegister，以及照片和头像的签名读取
- [x] T027 [P] [US1] 建立 `server/modules/ai/router.ts`、`server/modules/ai/parse-service.ts`、`server/modules/ai/index.ts`，承接 `server/routes/ai/`。前缀仍是 `/api/v1/ai`。顺序保持：输入校验、可选账本成员校验、未配置、日额度、上游调用、审计。非成员说明保持「无权访问该账本」。未配置、超过当日额度、解析成功的说明不变。未真正调用外部解析的失败不计当日次数。`parse-service.ts` 只调用 `server/utils/ai`
- [x] T028 [US1] 在 `server/app.ts` 挂上记账、概览、资产、登录、智能解析的路由和各自的允许方法，并删除对应的 `server/routes/transaction/`、`server/routes/overview/`、`server/routes/asset/`、`server/routes/common/`、`server/routes/ai/`。不留转调层。不得改 `cors` 配置和 `app.keys`。然后在 `server` 目录执行 `pnpm typecheck`（依赖 T023 至 T027）

**检查点**: 有权用户的成功路径和已有失败说明与搬迁前一致。今天只校验登录的缺口留到用户故事 2，不得在本检查点发布

---

## 阶段 4：用户故事 2 - 手册已写明的账本权限真正生效（优先级：P1）

**目标**: 针对某一个已有账本的查看或修改，非成员一律失败。新补上的说明为「不是该账本成员」。已有说明不改写

**独立测试**: 用不属于该账本的账号请求流水列表、区间汇总、近三年支出、预算和导出，全部失败且看不到金额。用普通成员改账本名称、管理类型、编辑创建者的明细，全部失败且数据不变。该账号仍可新建自己的账本，并凭有效邀请加入

### 用户故事 2 的实现

- [x] T029 [P] [US2] 在 `server/modules/bill/service.ts` 修改账本名称：先调用 `server/modules/access/index.ts` 的 `requireMember`，非成员说明为「不是该账本成员」且名称不变；是成员但不是创建者时调用 `requireCreator`，说明为「只有账本创建者才能修改账本名称」且名称不变；创建者成功结果与现在相同
- [x] T030 [P] [US2] 在 `server/modules/transaction/query-service.ts` 为 `POST /api/v1/transaction/list`、`GET /api/v1/transaction/currentMonthCost`、`POST /api/v1/transaction/export` 在查询前调用 `requireMember`。失败说明为「不是该账本成员」，响应不得包含该账本的明细或金额
- [x] T031 [P] [US2] 在 `server/modules/transaction/command-service.ts` 与 `server/modules/transaction/import-service.ts` 为新增、批量新增、导入，以及非成员的编辑和删除，先调用 `requireMember`，说明为「不是该账本成员」。已是成员但不是记账人时，仍用「只能编辑自己记的账单」或「只能删除自己记的账单」
- [x] T032 [P] [US2] 在 `server/modules/overview/query-service.ts` 为 `GET /api/v1/overview/balance` 与 `GET /api/v1/overview/threeYearCost` 在计算前调用 `requireMember`，说明为「不是该账本成员」，且不得返回金额
- [x] T033 [US2] 通读 `server/modules/bill/`、`server/modules/catalog/`、`server/modules/budget/`、`server/modules/plan/`、`server/modules/asset/`、`server/modules/ai/`、`server/modules/transaction/`、`server/modules/overview/`。凡是仍只校验登录就读写某一个已有账本的入口，补上 `requireMember`，说明为「不是该账本成员」。`specs/022-backend-domain-modules/contracts/bill-access.md` 里「已经在用的说明」表中的句子不得改写。新建账本、自己的账本列表、凭有效邀请加入不得按非成员拒绝（依赖 T029 至 T032）
- [x] T034 [US2] 把上述模块里已经存在的成员判断和创建者判断改成只调用 `server/modules/access/index.ts`。包括账本详情、退出、移除成员、预算、计划、类型与概览规则、分账、照片上传，以及 T029 至 T033 新补上的入口。失败说明仍由调用方按契约原文返回，不得改句。模块内不得再直接查询 `bill_users` 来决定是不是成员或创建者（依赖 T033）
- [x] T035 [US2] 在 `server` 目录执行 `pnpm typecheck`（依赖 T034）

**检查点**: 非成员不能查看或修改指定账本；创建者和记账人的原有限制仍在。可以独立于用户故事 4 验收。身份仍可能被请求头改写，不得在 T039 之前发布

---

## 阶段 5：用户故事 3 - 按业务领域维护规则（优先级：P1）

**目标**: 旧的路由层和数据服务层退出，模块之间只走公开入口，身份不再被请求头改写

**独立测试**: 不打开三端源码。确认账号、账本、类型、预算、计划、记账、概览、资产、智能解析各自只在 `server/modules/<领域>`；账本权限只有 `server/modules/access`；`server/database` 不再包含登录、分账、汇率、照片或整本账加载。默认分类名单仍在 `server/database/initDatas.ts`。记账重算预算只调用预算模块的公开函数

### 用户故事 3 的实现

- [x] T036 [US3] 确认 `server/app.ts` 不再引用 `server/routes` 后，删除残留的 `server/routes/` 目录。确认没有文件再导入 `server/model/resModel.ts` 后，删除 `server/model/`
- [x] T037 [US3] 删除已经迁入模块的 `server/database/services/` 文件，包括 `billService.ts`、`avatarService.ts`、`belongUsers.ts`、`transactionImageService.ts`、`overviewSettlement.ts`、`assetLedgerService.ts`、`assetFx.ts`、`assetRetireService.ts`、`assetRecordService.ts`、`monthEndTotals.ts`。保留 `assetDebtBackfill.ts` 与 `runDebtBackfill.ts` 到用户故事 4
- [x] T038 [US3] 去掉 `server/modules/bill/service.ts` 里一次加载类型、预算、计划和成员的 `findBillById` 对外导出。各模块只查自己的表，调用方改走各自的查询
- [x] T039 [US3] 把各模块路由中的当前用户改为 `server/http/current-user.ts`。然后删除 `server/utils/jwtUser.ts`，以及 `server/app.ts` 里用请求头改写当前用户的中间件。请求中另写的用户编号不得覆盖登录凭证。不得改 `cors` 配置和 `app.keys`
- [x] T040 [US3] 检查 `server/modules/`：模块之间只允许引用对方的 `index.ts`；服务文件不接收 `ctx`、不写 `ResModel`。发现违反则改到对应的 `router.ts` 或 `index.ts`。`server/database/` 不得引用 `server/modules/`。成员和创建者判断只允许出现在 `server/modules/access/`
- [x] T041 [US3] 在 `server` 目录执行 `pnpm typecheck`（依赖 T036 至 T040）

**检查点**: 目录边界成立，且用户故事 1、2 的行为仍然成立

---

## 阶段 6：用户故事 4 - 发布说明不再指向已做完的升级（优先级：P2）

**目标**: 负债标记补齐后删除死补数；部署说明不再引导已完成的归属人列加宽；手册第 14 节与第 5.4 节一致

**独立测试**: 部署说明中没有 `sql/` 和「数据库升级脚本」整节；`specs/004-multi-belong-users/` 与改前一致；类型为负债且未删除的资产都已标成负债；全新空库不执行已删除脚本也能保存「全部 / 单人 / 多人」归属

### 用户故事 4 的实现

- [x] T042 [US4] 在删除补数文件之前，于 `server` 目录对目标库执行 `pnpm exec tsx database/services/runDebtBackfill.ts`。只把类型为负债、`isDebt` 仍为假、且未删除的资产标成负债，不改金额和其他类型。确认没有遗漏后，删除 `server/database/services/assetDebtBackfill.ts` 与 `server/database/services/runDebtBackfill.ts`。启动和接口不得再调用补数
- [x] T043 [P] [US4] 删除 `deploy/sql/`（含 `004-multi-belong-users-upgrade.sql` 与 `004-multi-belong-users-rollback.sql`）。编辑 `deploy/README.md`：去掉目录表中的 `sql/` 行，以及「数据库升级脚本」整节。不要修改 `specs/004-multi-belong-users/`
- [x] T044 [P] [US4] 编辑 `docs/用户手册.md` 第 14 节，把「管理类型」改为仅创建者，与第 5.4 节一致。不要放大或缩小其他权限条文

**检查点**: 发布说明、负债口径和手册权限表述可以单独核对

---

## 阶段 7：打磨与横切

**目的**: 全量类型检查，并按快速验收确认没有把漏洞或行为变化留到发布

- [x] T045 在 `server` 目录执行 `pnpm typecheck`，作为可发布前的类型检查
- [x] T046 按 `specs/022-backend-domain-modules/quickstart.md` 完成合法路径、权限路径（含非成员查看和上传照片）、用错方法、身份冒充和文档核对（含全新空库保存「全部 / 单人 / 多人」归属，以及负债已标上且补数文件已删除）。不得在本步重跑已删除的补数命令。未通过不得发布
- [x] T047 确认 `frontend/`、`mobile-h5/`、`miniapp/` 没有本次改动，且已关停的 `mobile/` 没有恢复

---

## 依赖与执行顺序

### 阶段依赖

- **准备（阶段 1）**: 无依赖，必须第一个做。T001 未完成不得写 `server/modules/`
- **基础能力（阶段 2）**: 依赖 T001。完成前不得开始用户故事
- **用户故事 1（阶段 3）**: 依赖阶段 2。这是成功路径搬迁，可单独演示，但不得单独发布
- **用户故事 2（阶段 4）**: 依赖用户故事 1 的模块文件。发布前必须完成，否则新结构会带上旧漏洞。本阶段可以验收权限，但不得发布
- **用户故事 3（阶段 5）**: 依赖用户故事 1。应在用户故事 2 之后做，避免删掉尚未补上的权限代码。T039 去掉请求头身份改写之前不得发布
- **用户故事 4（阶段 6）**: 依赖用户故事 3 把业务迁走，但 T042 必须在 T037 保留的补数文件仍存在时执行。T043、T044 可与 T042 并行
- **打磨（阶段 7）**: 依赖阶段 3 至阶段 6

### 用户故事依赖

- **用户故事 1（P1）**: 基础能力完成后即可开始。不依赖其他故事
- **用户故事 2（P1）**: 依赖用户故事 1 已把路由放到 `server/modules/`。可独立验收权限，不依赖用户故事 4
- **用户故事 3（P1）**: 依赖用户故事 1 的搬迁，并应排在用户故事 2 之后
- **用户故事 4（P2）**: 依赖补数文件还在、业务已经迁走。不改变三端行为

### 每个用户故事内部

- 本期没有先写失败测试的任务
- 先共用模型和权限入口，再各领域服务，再挂路由
- 先保住成功结果和已有说明，再补新的非成员拒绝
- 旧文件在对应模块挂上之后删除，不留转调
- 用户故事 1 完成并核对成功路径后，再进入用户故事 2

### 并行机会

- T002、T003、T004 可同时做；T006 完成后，T007 至 T013 可同时做
- T016 只改现有挂载，可与模型拆分同时做
- T018、T019、T020、T021 可同时做
- T023 与 T024、T025、T026、T027 可同时做；T023 仍依赖 T020 的公开重算函数
- T029、T030、T031、T032 可同时做
- T043 与 T044 可同时做

---

## 并行示例：用户故事 1

```text
同时建立前四个模块：
任务: "建立 server/modules/bill/ ..."
任务: "建立 server/modules/catalog/ ..."
任务: "建立 server/modules/budget/ ..."
任务: "建立 server/modules/plan/ ..."

预算公开重算落地后，同时建立其余模块：
任务: "建立 server/modules/transaction/ ..."
任务: "建立 server/modules/overview/ ..."
任务: "建立 server/modules/asset/ ..."
任务: "建立 server/modules/auth/ ..."
任务: "建立 server/modules/ai/ ..."
```

## 并行示例：用户故事 2

```text
同时补四类新的成员拒绝：
任务: "server/modules/bill/service.ts 改名校验"
任务: "server/modules/transaction/query-service.ts 列表、当月支出、导出"
任务: "server/modules/transaction/command-service.ts 与 import-service.ts"
任务: "server/modules/overview/query-service.ts 区间收支与近三年支出"
```

## 并行示例：用户故事 4

```text
补数可以单独先做。文档两处可同时改：
任务: "删除 deploy/sql/ 并改 deploy/README.md"
任务: "改 docs/用户手册.md 第 14 节"
```

---

## 实施策略

### 先做可演示增量（用户故事 1，不发布）

1. 完成阶段 1：宪章 `3.4.0`
2. 完成阶段 2：响应、模型、权限入口
3. 完成阶段 3：九组接口迁入模块，成功路径与现网一致
4. **停下来核对成功路径**。不要发布：非成员仍可能读到今天没拦住的流水和概览

### 增量交付

1. 准备 + 基础能力 → 旧服务仍在，类型检查通过
2. 用户故事 1 → 成功路径可演示，不发布
3. 用户故事 2 → 权限可独立验收，不发布
4. 用户故事 3 → 旧目录删除，身份只认登录凭证；这时才允许作为候选发布
5. 用户故事 4 → 部署说明、负债标记、手册
6. 阶段 7 按 quickstart.md 全量核对后再发布

### 多人并行策略

1. 一起完成 T001 至 T017
2. 之后可以分工：一人账本/类型/预算/计划，一人记账/概览，一人资产/登录/智能解析
3. 四条新的权限补丁（T029 至 T032）可由不同人同时改不同文件
4. 用户故事 3 的删除要等对应模块已经挂上，避免两套实现并存

---

## 备注

- [P] 任务 = 不同文件、无未完成依赖
- [US1] 成功路径不回退；[US2] 补权限；[US3] 目录边界；[US4] 发布说明与负债标记
- 不得新增测试框架，不得改三端，不得改表结构
- 每完成一个模块就在 `server` 目录执行 `pnpm typecheck`
- T039 完成前不得发布

---

## Phase 8: Convergence

- [x] T048 在 `server/modules/transaction/command-service.ts` 编辑明细时，先按该明细真实所属账本调用 `requireMember`，并要求请求中的账本编号与明细一致；不是该账本成员时说明为「不是该账本成员」，且不得改写该明细、照片或任一账本的预算，再按记账人拒绝 per Constitution III (contradicts)
- [x] T049 在 `server/modules/catalog/service.ts` 的年度概览配置保存与删除中，确认是成员后再确认是创建者；非成员说明保持「无权管理该账本数据」，是成员但不是创建者时说明为「只有账本创建者才能管理概览规则」，且数量不变 per FR-006 (partial)
