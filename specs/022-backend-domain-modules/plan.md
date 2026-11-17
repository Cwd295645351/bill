# 实现计划：后端按业务领域重组并补齐账本权限

**功能分支**: `022-backend-domain-modules` | **日期**: 2026-11-17 | **规格**: [spec.md](./spec.md)

**输入**: `/specs/022-backend-domain-modules/spec.md` 中的功能规格

**说明**: 本文件由 `/speckit-plan` 填写；其定义描述执行工作流。

## 摘要

把后端从「路由目录 + 数据服务目录」收成按业务领域的模块，并补上账本权限。凡是针对某一个已有账本的查看或修改，非成员必须失败；已经在用的失败说明保持原文，今天只校验登录的入口改为「不是该账本成员」。合法用户的成功结果、地址和金额算法不变。电脑网页、手机网页、小程序不改。

技术路径见 [research.md](./research.md)：先把宪章落点改到 `3.4.0`，再增加统一的成功/失败结果和当前用户读取，拆开表定义，用唯一的账本权限模块挡住非成员，然后按领域搬迁。记账与预算仍在同一个数据库事务里，只保留一套预算算法。最后做一次负债标记补数，删掉无人调用的补数文件和已经执行完的升级脚本。

## 技术上下文

**语言/版本**: TypeScript；后端 Node.js 18+ 与 Koa 2（`server/`）。不改 `frontend/`、`mobile-h5/`、`miniapp/`，不恢复已关停的 `mobile/`。

**主要依赖**: 现有 Koa、koa-router、koa-jwt、Sequelize、mysql2、Redis、阿里云 OSS。响应仍是 `retCode`、`message`、`data`。

**存储**: MySQL 表结构不变。Redis 继续负责会话、滑块和智能解析日额度。不新建表，不加列。负债标记只做一次数据补齐。

**测试**: 仓库没有可运行的测试脚本，本期不新增测试框架。每步结束在 `server` 目录执行 `pnpm typecheck`。全部完成后按 [quickstart.md](./quickstart.md) 手工回归。

**目标平台**: 后端 API。电脑网页、手机网页、小程序继续请求同一套 `/api/v1`。

**项目类型**: monorepo 内的后端结构重组。主改动在 `server/`，另改部署说明和用户手册第 14 节的一处权限表述。

**性能目标**: 不改查询算法。概览和月汇总仍在内存中按现有循环计算。记一笔仍是一次数据库事务。

**约束**: 地址、方法、成功字段保持兼容，见 [contracts/http-compatibility.md](./contracts/http-compatibility.md)。服务不接收请求上下文，不写响应体。模块之间只能引用对方的 `index.ts`。身份只从登录凭证的 `userId` 读取。权限说明见 [contracts/bill-access.md](./contracts/bill-access.md)。

**规模/范围**: 现有九组接口（common、bill、billtype、transaction、budget、overview、plan、asset、ai）全部迁入模块。约 20 张表按领域拆到多个模型文件。

## 宪章检查

*门禁：须在阶段 0 研究前通过；阶段 1 设计后再复核一次。*

对照 `.specify/memory/constitution.md`（当前 v3.3.0）。规格要求实现的第一步先升到 v3.4.0，再按新落点写模块。未修订宪章不得开始搬代码。

| 原则 | 设计前 | 设计后 |
|------|--------|--------|
| I. 存量优先，增量规格化 | 通过。这是一次已确认的结构重组，并补上手册已写、接口未执行的权限。不改金额、归属人存法和删除口径。 | 通过。搬迁分步进行，每步可类型检查。不做概览算法替换，不引入新的表变更框架。 |
| II. 多端边界不可混用 | 通过。只改 `server/`、`deploy/README.md` 和用户手册第 14 节那一处。不改三端，不恢复 `mobile/`。 | 通过。源码树只列出 `server/` 与部署说明。 |
| III. 账本隔离与记账权限 | 通过。成员隔离保持，并补上非成员仍能读账的缺口。只有记账人能改删自己的明细。 | 通过。权限只有 `modules/access` 一处；判断顺序和说明见契约。资产名单与账本成员不混用。 |
| IV. 公开契约向后兼容 | 通过。前缀仍是 `/api/v1`。不删成功字段。非成员、非创建者收到现有风格的失败说明，合法用户的成功响应不变。 | 通过。见两份契约。删除已执行完的加宽脚本不改表，理由见复杂度跟踪。 |
| V. 密钥与部署约束 | 通过。不改密钥名单。删除 `deploy/sql` 时同步改部署说明，避免死链接。规格用语保持中文。 | 通过。快速验收包含部署说明和手册第 14 节。 |
| 技术栈落点 | 有条件通过。v3.3.0 仍要求路由在 `server/routes`、业务在 `server/database/services`。本计划改为 `server/modules`。第一步必须把该节改成新落点并升到 `3.4.0`。无此修订，后续模块代码不得开始。 | 通过（以修订后的宪章为准）。目录与依赖方向见下方源码树。原则 I、IV 的原文保留。 |

无未记录的门禁失败。技术落点的偏离已在复杂度跟踪中说明，并且被规格 FR-015 要求为第一步。

### 设计后复核

选定方案与 [research.md](./research.md) 一致：`server/http` 负责当前用户和响应；`server/modules/access` 是唯一的成员与创建者判断；其余领域只通过对方的 `index.ts` 协作；`server/database` 不再放业务。`app.ts` 同时注册路由表和各自的允许方法。非成员拦截范围是某一个已有账本的全部查看和修改，已有失败说明不改写。记账调用预算模块公开的重算函数，两者仍在同一事务中。负债标记先补一次再删除死文件。`deploy/sql` 与部署说明中的升级节一并删除，`specs/004-multi-belong-users/` 不改。

实现顺序：

1. 修订宪章落点与版本。
2. 增加 `server/http` 的结果类型、响应写入和当前用户。响应模型在 `server/http/res-model.ts`，旧的 `server/model/resModel.ts` 只再导出它，旧路由继续运行。路由迁完后再删除旧文件。
3. 把模型拆成领域文件。`database/index.ts` 的导出名单保持不变。新建账本的默认分类名单留在 `server/database/initDatas.ts`，由账本模块调用；不把它迁进模块，也不写回 `database/services`。
4. 增加 access 模块。搬迁时可以暂时留下各模块自己的判断。权限阶段必须把成员和创建者判断全部改到 access，包含资产、照片、账本详情、预算、计划和类型；失败说明仍由调用方按原文返回。
5. 建立账本、类型、预算、计划四个模块并挂到 `app.ts`。预算重算在这一步从整包读取中移入预算模块。记账在下一步改完之前，只调用预算模块的公开函数，避免两套保存并存。
6. 建立记账和概览模块，先保持成功路径和已有说明。契约里新的成员校验和改名校验在下一阶段补上，该阶段完成前不得发布。
7. 建立资产、登录、智能解析模块。权限收口完成后再删除残留的 `server/routes`、已迁走的 `server/database/services` 和 `server/model`，并去掉请求头身份改写。请求头身份改写去掉之前不得发布。改 `app.ts` 时不动跨站配置和会话签名。
8. 对目标库执行一次负债补数，再删除补数文件。删除 `deploy/sql` 并改部署说明。用户手册第 14 节改为仅创建者可管理类型。
9. 全量类型检查，并按快速验收做手工回归。

## 项目结构

### 文档（本功能）

```text
specs/022-backend-domain-modules/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── http-compatibility.md
│   └── bill-access.md
├── checklists/requirements.md
└── tasks.md                 # /speckit-tasks 再创建
```

### 源码（仓库根）

迁完后删除 `server/routes`、`server/database/services`、`server/model`、`server/utils/jwtUser.ts`、`deploy/sql`。启动、配置和其余基础设施保留。

```text
server/
  app.ts                         创建 Koa、挂中间件、挂各模块路由及其允许方法
  server.ts                      生产入口
  bin/www.ts                     监听端口
  http/
    outcome.ts                   成功数据或失败说明
    respond.ts                   写成现有 retCode / message / data
    res-model.ts                 新建；旧的 server/model/resModel.ts 只再导出它，路由迁完再删
    current-user.ts              只从登录凭证读取 userId
  modules/
    access/                      成员、创建者、资源反查账本；无路由
    auth/                        /api/v1/common；登录、注册、微信、资料、头像
    bill/                        /api/v1/bill
    catalog/                     /api/v1/billtype；向记账公开类型名称
    budget/                      /api/v1/budget；向记账公开事务内重算
    plan/                        /api/v1/plan
    transaction/                 /api/v1/transaction；查询、写入、导入、照片、归属人
    overview/                    /api/v1/overview；区间、近三年、分账
    asset/                       /api/v1/asset；资产名单与账本成员分开
    ai/                          /api/v1/ai
  database/
    index.ts                     连接、同步、再导出模型
    models/                      按领域拆文件，index 只做关联和汇总
    ensureAssetSchema.ts
    ensureEncryption.ts
    initDatas.ts                 默认分类名单；启动数据，由账本模块调用
  config/                        环境、密钥、数据库、智能解析、版本
  utils/                         Redis、滑块、加解密、微信、表格、日期、智能解析客户端
```

每个有路由的模块内部是 `router.ts`、服务文件和 `index.ts`。`index.ts` 导出路由，以及少数给其他模块用的函数。access 只有服务和 `index.ts`。

依赖方向：`app.ts` 只创建应用并挂载模块导出的路由。模块可以调用 `server/http`、`server/database`、`server/utils`、`server/config`。模块之间只能引用对方的 `index.ts`。`server/database` 不引用模块。

**结构决策**: 领域模块放在 `server/modules`，HTTP 适配与业务服务同居一目录。表定义按领域拆文件，是因为现在的模型文件已含约 20 张表。业务仍从 `database/index.ts` 导入模型，避免拆文件时改遍导入路径。不增加仓储层。跨领域写入继续把 Sequelize 事务作为参数传入公开函数。`server/database/initDatas.ts` 只保留新建账本的默认分类名单，由账本模块调用；登录、分账、汇率、照片和整本账加载不留在数据存放。

## 复杂度跟踪

| 违规项 | 为何需要 | 更简单方案及否决原因 |
|--------|----------|----------------------|
| 修改宪章技术落点，不再使用 `server/routes` + `server/database/services` | 业务和数据访问混在 `database/services`，登录、分账、汇率、照片无法按这个目录名找到。规格要求按业务成块，并规定未改宪章不得搬代码 | 只把控制器挪进 `database/services` 能少改路径，但新代码仍堆在错误的层 |
| 从部署说明中撤下已执行且不再回滚的加宽脚本 | 线上列已经是 1024 和 2048，规格要求不再引导执行这次加宽或其回滚。本次不改表 | 留下脚本符合「库变更可回滚」的字面，但会让发布人员再次执行已完成的步骤。全新空库仍由模型建出宽列 |
| 为尚未校验成员的账本操作补上拒绝 | 澄清结果是：针对某一个账本的查看和修改，非成员一律拒绝。流水、概览、导入导出今天只确认登录 | 只补规格最初点名的三四项会把其余入口留成漏洞，和「不能进入该账本」不符。已有失败说明保持原文，避免把预算、资产、详情的提示改掉 |
