<!--
SYNC IMPACT REPORT
==================
Version change: 3.1.0 → 3.2.0
Bump rationale: MINOR。原则 II 将「计划」从仅 PC 提升为 PC + mobile-h5 + 小程序
  均可管理；概览、类型配置、家庭资产仍以 PC 为准（对齐 specs/019-mobile-plan）。
  预算三端可管（3.1.0）保持不变。

Principles amended:
  II. 多端边界不可混用（预算+计划三端可管；概览/类型/资产仍 PC）

Added sections: 无
Removed sections: 无

Templates reviewed for alignment:
  ✅ .specify/templates/plan-template.md — Constitution Check 仍对照原则 I–V
  ✅ .specify/templates/spec-template.md — 无需修改
  ✅ .specify/templates/tasks-template.md — 无需修改

Follow-up TODOs: 交付时同步 docs/用户手册.md（specs/019 T023）
-->

# 记亿由薪 Constitution

本仓库是已上线的多人联合记账系统「记亿由薪」，不是绿地项目。本宪章只固化**已经成立、或团队明确同意**的约束。后续 `/speckit-specify`、`/speckit-plan`、`/speckit-analyze` 必须以本文件为准。

## Core Principles

### I. 存量优先，增量规格化

不要先给整套历史系统补规格。规格描述的是**这一次要交付的行为变化**，现有代码只作为实现上下文。

- 第一次以及之后的每次功能，都必须是可独立评审的切片（一个 bug、一个字段、一个筛选、一次兼容性修复）。
- 规格必须同时写清「要达成什么」和「哪些现有行为不能动」。
- 用户可见行为以 `docs/用户手册.md` 为证据；规格与手册冲突时，先改规格并同步手册，禁止 silently 改用户习惯。
- 不要为了填模板编造当前并不存在的标准（例如「必须 100% 单测覆盖」）。

**理由：** 存量项目的风险是无边界重构。规格必须缩小变更面，而不是重写产品说明书。

### II. 多端边界不可混用

必须保留现有客户端分工，禁止无故引入平行技术栈或把一端的职责塞进另一端。旧版已关停的 `mobile/` 工程不得恢复；现行手机浏览器入口是独立工程 `mobile-h5/`，部署路径 `/mobile/`。

| 端 | 目录 | 职责 |
|----|------|------|
| PC | `frontend/` | Vue 3 + Vite + TypeScript，功能完整（含注册） |
| 移动端 H5 | `mobile-h5/` | Vue 3，能力对齐小程序日常记账、当年预算与计划；账号密码登录与注册；部署 `/mobile/` |
| 微信小程序 | `miniapp/` | 原生 + TypeScript + Vant Weapp；记账主路径、当年预算与计划；支持注册即绑定与绑定已有账号 |
| 后端 | `server/` | TypeScript 源码，运行时 Node.js + Koa 2 + MySQL + Redis，公开 API |

- PC 前端按页面模块组织：每个页面自带 `api.ts` / `router.ts`，框架自动收集路由。新增页面必须遵循这一约定。
- 小程序页面落在 `miniapp/miniprogram/pages/`（及既有业务分包），用微信开发者工具打开 `miniapp/`，执行「工具 -> 构建 npm」后编译。不要把小程序做成另一套浏览器网页，也不要用小程序去实现 PC 专属能力。
- 小程序与 H5 当前能力：注册/绑定（或账号登录）、账本查看/进入/加入、记账增改查、**当年预算查看与增删改**、**计划查看与增删改**。概览、类型配置、家庭资产仍以 PC 为准。
- 规格必须写明改 PC、mobile-h5、Miniapp、API 中的哪一端；未点名的端默认不改。
- 日常补记、当年预算与计划管理可在微信小程序、移动端 H5 或电脑上完成；统计、分账、类型配置与家庭资产在电脑上操作。
- 不得把新功能写进已关停的旧 `mobile/` 目录。

**理由：** 四端（含后端）边界清晰可避免功能回退与错误入口；恢复旧 `mobile/` 或混用栈会制造双份实现。

### III. 账本隔离与记账权限

账本是数据隔离的基本单位。下列规则属于产品不变量，规格不得削弱。

- 不同账本的成员、类型、预算、计划、明细互不影响。
- **记账人**由系统记录，不可改；只有记账人本人可以编辑或删除自己录入的明细。
- **归属人**决定这笔钱算在谁头上：
  - 支出可选「全部」、一名成员或多名成员，「全部」与成员互斥。多名成员是保存时确定的名单，不随之后成员加入而改变；勾选全部成员不等于「全部」。
  - 收入只能归属一名成员，不提供「全部」，也不能多选。
  - 归属多名成员的支出，分账时只在这几个人之间分摊，未被选中的成员不承担。
- 加入账本走分享码；创建者与成员权限以用户手册「权限与数据规则」为准。
- 小程序未绑定微信时：可**注册新账号并绑定当前微信**（`/wxRegister`），或用**已有账号密码**绑定（`/wxBind`）；之后静默登录（`/wxLogin`）。注册成功即绑定，无需再输同一组密码绑一次；若账号已创建但绑定失败，保留账号并引导走绑定。
- 一个账号只绑定一个微信（`user_wechats` 中 `user_id` 与 `openid` 均唯一），产品不提供解绑；换绑由管理员改库，规格不得自行增加解绑入口。

**理由：** 多人联合记账的正确性建立在隔离和不可抵赖的录入责任上。

### IV. 公开契约向后兼容

对外 HTTP 契约与静态资源路径是部署合同，变更必须向后兼容，除非规格显式批准破坏性升级。

- API 前缀为 `/api/v1`。
- 生产静态资源：PC 为 `/pc/`，移动端 H5 为 `/mobile/`，API 由 Nginx 反代 `/api`。
- 小程序**不经 Nginx 托管静态页**，只请求同一套 `/api`。体验版/正式版的接口根地址必须是已备案的 HTTPS 域名（不含路径和末尾斜杠），并在微信公众平台配置为 request 合法域名。
- 扩展现有 JSON 接口时，优先新增可选字段/参数，禁止无故改响应形状或删字段。新增公开接口（如 `/wxRegister`）须加入未登录放行名单。
- 数据库变更必须可回滚；禁止在无迁移方案的情况下改表。

**理由：** 电脑网页、H5 与小程序同时依赖同一套 API，破坏性变更会让多端一起坏掉。

### V. 密钥与部署约束

密钥不得进入源码或 Git。部署约定以 `deploy/` 为准。

- `AI_API_KEY`、`WX_APPID`、`WX_SECRET`、`JWT_SECRET`、`PASSWORD_SALT`、`AES_KEY`、`AES_IV`、`MYSQL_USER`、`MYSQL_PASSWORD` 只放 `server/.env` 或进程环境变量；`server/.env` 已被 Git 忽略。`server/config/db.js` 只读取这些变量，可以提交。
- 本地联调：Web 使用 `env.local.js`；小程序体验版/正式版地址写在 `miniapp/.env` 的 `MINIAPP_BASE_URL`，执行 `npm run sync-env` 生成 `env.local.ts`。`.env` 与 `env.local.ts` 均不提交。
- 小程序 `project.config.json` 的正式 `appid` 可按发布环境修改，但不要把密钥或生产接口地址写入可提交源码。
- 生产启动与 Nginx 配置遵循 `deploy/README.md`、`deploy/linux.md`、`deploy/windows.md`；小程序发布步骤见 `deploy/README.md`「微信小程序」。
- 代码标识符使用英文；注释、规格、手册使用简体中文。

**理由：** 密钥泄漏和部署路径漂移是本项目最贵的运维事故。

## 技术栈与模块落点

规划（`/speckit-plan`）必须复用现有分层，而不是另起炉灶。

- 后端：`server/routes/<模块>` 负责路由，业务放 `server/database/services`。小程序登录/注册绑定走 `server/routes/common` 的 `/wxLogin`、`/wxBind`、`/wxRegister`。
- PC 改动落在 `frontend/src/views/<页面>` 及其 `api.ts`。
- 移动端 H5 改动落在 `mobile-h5/src/`；不得写入已关停的旧 `mobile/`。
- 小程序改动落在 `miniapp/miniprogram/pages/<页面>`，请求封装放 `miniapp/miniprogram/apis` 与 `utils`。
- 现有模块：账本（bill）、记账（transaction/record）、类型（billtype）、概览（overview）、预算（budget）、计划（plan）、资产（asset）、AI 解析（ai）、微信绑定（user_wechats）。

## 规格驱动工作流

1. 全项目宪章只维护这一份文件。
2. 每个功能一个目录：`specs/NNN-short-name/`，至少包含 `spec.md`。完成后保留为历史档案，下一件事开新目录。
3. 推荐顺序：`/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze` → `/speckit-implement` → `/speckit-converge`。
4. 小改动可缩短为 specify → plan → tasks → implement → converge。
5. `/speckit-specify` 只写 what/why；技术栈、目录、接口细节放到 `/speckit-plan`。
6. 实现完成后必须 `/speckit-converge`：拿代码对照规格，缺口补任务再实现，禁止口头宣称「做完了」。
7. 规格文件与业务代码一起提交、一起 Code Review。

## 治理

- 本宪章优先于临时约定和对话里的口头指令。
- 修改原则必须先改本文件并提升版本，再让后续规格生效。
- 计划阶段若违反原则，必须在 Constitution Check 中写明理由；无理由则不得进入实现。
- 复杂度必须被规格中的用户价值证明；禁止「顺便重构」。

**Version**: 3.2.0 | **Ratified**: 2026-09-15 | **Last Amended**: 2026-11-10
