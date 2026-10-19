---

description: "服务端源码改为 TypeScript：任务列表"
---

# Tasks: 服务端源码改为 TypeScript

**Input**: `/specs/006-server-to-typescript/` 下的设计文档

**Prerequisites**: [plan.md](./plan.md)、[spec.md](./spec.md)、[research.md](./research.md)、[data-model.md](./data-model.md)、[contracts/behavior-parity.md](./contracts/behavior-parity.md)、[quickstart.md](./quickstart.md)

**Tests**: 规格没有要求自动化测试，仓库也没有服务端测试套件。不新增测试框架，不改 `server/package.json` 里现有的 `test` 脚本。类型检查和记账抽查按 [quickstart.md](./quickstart.md) 执行。

**Organization**: 先装好编译和开发启动，再把运行时源码改为 TypeScript。随后核对记账行为未变，最后改部署说明和宪章。

## 格式：`[ID] [P?] [Story] 描述`

- **[P]**：可以并行（不同文件，且不依赖未完成的任务）
- **[Story]**：所属用户故事（US1～US3）
- 描述里写明文件路径

## 全局约定（所有任务都要遵守）

- 只改 `server/` 的运行时源码、`server/package.json`、`server/pm2.conf.json`、`server/tsconfig.json`、`server/types/`，以及 `deploy/linux.md`、`deploy/windows.md`、`.specify/memory/constitution.md`。
- 不改 `frontend/`、`miniapp/`、`script/dev.js`、`docs/用户手册.md`、`deploy/sql/`、`deploy/nginx-linux.conf`、`deploy/nginx.conf`。不恢复 `mobile/`。
- 不改 `/api/v1` 的路径、必填项、已有响应字段和用户能看懂的失败原因。见 [contracts/behavior-parity.md](./contracts/behavior-parity.md)。
- 不执行 SQL，不调整 `sequelize.sync()` 会创建或对齐的表、列和索引。不改账号、绑定、账本、成员、明细、预算、计划、资产和图片的存法。见 [data-model.md](./data-model.md)。
- 业务源码使用 `import` / `export`。编译产物是 CommonJS。业务文件不得写 `require`、`any`、`@ts-nocheck` 或整文件关闭检查。
- 每个改写任务在新增 `.ts` 的同一任务里删除对应的 `.js`（`server/bin/www` 改为 `server/bin/www.ts` 后删除无后缀旧文件）。不要留下同名的两份源码。
- 保留已有中文注释。不借机重命名变量、调整目录、清理未使用变量或重写业务判断。
- `server/prettier.config.js`、`server/.env`、日志、SQL 和 `node_modules/` 不改写成 TypeScript。`server/dist/` 不提交。

---

## 阶段 1：准备工作

**目的**：把类型检查、编译和开发启动的工具装上，此时还不改业务源码。

- [X] T001 [P] 修改 `server/package.json`：`devDependencies` 增加 `typescript`（5.x）、`tsx`、`@types/node`；移除不再使用的 `nodemon`。脚本改为 `"typecheck": "tsc --noEmit"`、`"build": "tsc"`、`"dev": "cross-env NODE_ENV=dev tsx watch bin/www.ts"`、`"start": "node dist/bin/www.js"`、`"db:init": "node -e \"require('./dist/database/index').connectDB().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})\""`。保留 `prd` 与 `test` 原文。不要在本任务改 `.js` 源码
- [X] T002 [P] 新增 `server/tsconfig.json`：`strict: true`，`skipLibCheck: true`，`noUnusedLocals: false`，`noUnusedParameters: false`，`target: ES2020`，`module: CommonJS`，`moduleResolution: node`，`esModuleInterop: true`，`outDir: dist`，`rootDir: .`。`include` 为 `**/*.ts`，`exclude` 包含 `node_modules` 与 `dist`。不要开启 `allowJs`
- [X] T003 [P] 新增 `server/types/untyped.d.ts`，文件头用中文注明：这里只声明没有公开类型、且本仓库实际调用到的依赖；业务源码不得把整段规则标成 `any`。本任务先不写具体 `declare module`

---

## 阶段 2：基础（依赖可安装）

**目的**：工具链能装上，后续改写才有类型检查可跑。

**⚠️ 关键**：本阶段完成前不要把业务 `.js` 改成 `.ts`。

- [X] T004 在 `server/` 执行依赖安装，确认 `tsc` 与 `tsx` 可执行。根目录 `.gitignore` 已忽略 `dist/`，不要把 `server/dist/` 加入版本库。安装失败时停下来，不要继续改源码

**检查点**：`server/package.json`、`server/tsconfig.json`、`server/types/untyped.d.ts` 已就位，业务源码仍是 JavaScript。

---

## 阶段 3：用户故事 1 - 服务端业务源码改为可在运行前检查类型的写法（Priority: P1）🎯 MVP

**目标**：会在进程里执行的业务和启动源码改为 TypeScript。写错明确类型时，`pnpm run typecheck` 失败并指出位置，该结果不能当作可发布版本。

**独立测试**：`server/` 中除 `prettier.config.js` 外不再有需要维护的运行时 JavaScript。按 [quickstart.md](./quickstart.md) 第 1 节故意写错一处类型，检查失败；改回后通过。

### 用户故事 1 的实现

- [X] T005 [P] [US1] 将 `server/config/secrets.js`、`server/config/db.js`、`server/config/version.js`、`server/config/ai.js` 改为同名 `.ts` 并删除 `.js`。`loadSecrets` 在缺少变量或 `AES_KEY` / `AES_IV` 不是 16 字节时仍抛出原来的中文错误。读取的仍是进程环境变量，不把密钥写进源码
- [X] T006 [P] [US1] 将 `server/utils/dateUtil.js`、`server/utils/xss.js`、`server/utils/cryp.js`、`server/utils/jwtUser.js`、`server/utils/wechat.js`、`server/utils/redis.js`、`server/utils/xlsx.js` 改为同名 `.ts` 并删除 `.js`。加密、会话存储、日期和导出的输入输出保持原样
- [X] T007 [P] [US1] 将 `server/model/resModel.js` 改为 `server/model/resModel.ts` 并删除 `.js`。响应外层字段保持原名，不增删字段
- [X] T008 [P] [US1] 将 `server/database/models/index.js`、`server/database/index.js`、`server/database/ensureEncryption.js`、`server/database/initDatas.js` 改为同名 `.ts` 并删除 `.js`。保留 `tableName`、`field`、`DataTypes` 和金额 getter：数据库 `DECIMAL` 读出后仍转为 number。继续导出 `connectDB`。不改 `sequelize.sync()` 的调用方式
- [X] T009 [P] [US1] 将 `server/database/services/belongUsers.js`、`server/database/services/billService.js`、`server/database/services/overviewSettlement.js`、`server/database/services/assetRecordService.js`、`server/database/services/transactionImageService.js` 改为同名 `.ts` 并删除 `.js`。不改归属人、分账、资产和图片的判断
- [X] T010 [P] [US1] 将 `server/routes/common/index.js` 与 `server/routes/common/controller.js` 改为同名 `.ts` 并删除 `.js`。保留现有路由前缀，以及 `/wxLogin`、`/wxBind` 的路径和处理结果
- [X] T011 [P] [US1] 将 `server/routes/bill/index.js` 与 `server/routes/bill/controller.js` 改为同名 `.ts` 并删除 `.js`。账本创建、加入和成员隔离的判断保持原样
- [X] T012 [P] [US1] 将 `server/routes/transaction/index.js` 与 `server/routes/transaction/controller.js` 改为同名 `.ts` 并删除 `.js`。仍只有记账人可以改、删自己的明细；归属人规则不改
- [X] T013 [P] [US1] 将 `server/routes/budget/index.js` 与 `server/routes/budget/controller.js` 改为同名 `.ts` 并删除 `.js`
- [X] T014 [P] [US1] 将 `server/routes/overview/index.js` 与 `server/routes/overview/controller.js` 改为同名 `.ts` 并删除 `.js`
- [X] T015 [P] [US1] 将 `server/routes/plan/index.js` 与 `server/routes/plan/controller.js` 改为同名 `.ts` 并删除 `.js`
- [X] T016 [P] [US1] 将 `server/routes/asset/index.js`、`server/routes/asset/assetController.js`、`server/routes/asset/recordController.js`、`server/routes/asset/statisticsController.js`、`server/routes/asset/memberController.js` 改为同名 `.ts` 并删除 `.js`
- [X] T017 [P] [US1] 将 `server/routes/billtype/index.js` 与 `server/routes/billtype/controller.js` 改为同名 `.ts` 并删除 `.js`
- [X] T018 [P] [US1] 将 `server/routes/ai/index.js` 与 `server/routes/ai/controller.js` 改为同名 `.ts` 并删除 `.js`。智能解析仍按原方式调用，不新增能力
- [X] T019 [P] [US1] 将 `server/app.js`、`server/server.js`、`server/bin/www` 改为 `server/app.ts`、`server/server.ts`、`server/bin/www.ts`，并删除旧文件。`bin/www.ts` 保留首行 `#!/usr/bin/env node`。`app.ts` 读取环境文件和访问日志时，目录必须是 `server/` 根目录：从 `dist/app.js` 运行时用编译文件的上一级，用 `tsx` 直接运行 `app.ts` 时用源码所在的 `server/`。路径分别对应 `server/.env`（`dotenv` 的 `quiet: true` 保留）和 `server/logs/access.log`。缺少密钥时仍 `console.error(err.message)` 后 `process.exit(1)`。`server.ts` 只负责拉起入口
- [X] T020 [US1] 依赖 T005～T019。在 `server/` 执行 `pnpm run typecheck`。有公开类型的依赖安装对应 `@types` 或使用自带类型；没有类型的，只把本仓库实际调用的形状写入 `server/types/untyped.d.ts`（优先核对 `koa-onerror`、`koa-morgan`、`koa-generic-session`、`koa2-cors`、`koa-redis`、`xss`、`node-xlsx`、`jsrsasign`）。业务 `.ts` 不得因此加入 `any` 或 `@ts-nocheck`。结束时 `pnpm run typecheck` 退出码为 0
- [X] T021 [US1] 依赖 T020。按 `specs/006-server-to-typescript/quickstart.md` 第 1 节，在任意一个业务 `.ts` 里把明确的数字类型改成字符串，执行 `pnpm run typecheck`，确认失败输出含该文件和位置；然后还原，再次执行直到通过。不要把写错的类型留在仓库。同时确认 `server/` 下需要维护的运行时源码只剩 `.ts`，JavaScript 只剩 `server/prettier.config.js`

**检查点**：类型检查能拦住错误并通过正确源码。还不必改部署文档。

---

## 阶段 4：用户故事 2 - 记账的人感觉不到这次改动（Priority: P1）

**目标**：登录、账本、记账、分享码和已有数据与改写前一致。电脑网页和小程序不用改接口地址。

**独立测试**：对照改写前记下的一笔明细，重启后金额、记账人、归属人不变。未登录记账的拒绝原因不变。`frontend/` 与 `miniapp/` 没有本次改动。

### 用户故事 2 的实现

- [X] T022 [P] [US2] 对照改写前的 `server/database/models/index.js`（用 `git diff` 或 `git show HEAD:server/database/models/index.js`）检查 `server/database/models/index.ts`：`tableName`、列的 `field`、`allowNull`、`defaultValue` 和金额 getter 与改写前一致。发现语义差异就改回类型层面的写法，不要改表
- [X] T023 [P] [US2] 检查 `server/routes/common/index.ts`、`server/routes/bill/index.ts`、`server/routes/transaction/index.ts`、`server/routes/budget/index.ts`、`server/routes/overview/index.ts`、`server/routes/plan/index.ts`、`server/routes/asset/index.ts`、`server/routes/billtype/index.ts`、`server/routes/ai/index.ts` 的路由前缀和路径与对应旧 `index.js` 一致。`server/model/resModel.ts` 的字段名与旧文件一致
- [X] T024 [P] [US2] 用 `git diff --stat -- frontend miniapp deploy/sql docs/用户手册.md script/dev.js` 确认这些路径没有本次改动。输出应为空。不要为了验收去改电脑网页或小程序
- [X] T025 [US2] 按 `specs/006-server-to-typescript/quickstart.md` 第 2 节的反例和第 3 节手工核对：移走一项必填密钥时进程退出并提示缺少该项，恢复 `.env` 后能启动；用改写前账号完成登录、打开已有账本、记一笔、只允许记账人修改自己的一笔、分享码加入。没有数据库或小程序环境时，在本任务下注明未跑的项目，不要改业务代码来凑结果。验收备注：清空 `MYSQL_USER` 后进程退出码 1，并打印「缺少环境变量 MYSQL_USER」；未改 `.env`。未登录请求 `POST /api/v1/transaction/list` 返回「接口鉴权失败，请重新登录」。第 3 节登录、打开账本、记一笔、记账人修改、分享码加入未跑（没有改写前账号会话，也没有小程序环境）

**检查点**：源码已经是 TypeScript，记账规则和另外两端没有被改到。

---

## 阶段 5：用户故事 3 - 按部署说明仍能把服务开起来（Priority: P2）

**目标**：按更新后的说明，安装、编译、再启动。进程名仍是 `bill-manage`，端口默认仍是 `3000`，密钥仍在 `server/.env`。

**独立测试**：只读 `deploy/linux.md` 和 `deploy/windows.md`，能找到「先 `pnpm run build` 再启动」。`server/pm2.conf.json` 的入口是 `dist/server.js`，解释器是 Node，不再出现 `babel-node`。

### 用户故事 3 的实现

- [X] T026 [P] [US3] 修改 `server/pm2.conf.json`：`script` 改为 `dist/server.js`；删除指向 `node_modules/babel-cli/bin/babel-node.js` 的 `interpreter`；保留 `exec_interpreter` 为 `node`、进程名 `bill-manage`、`cwd` 为 `./`，以及现有日志文件 `logs/err.log`、`logs/out.log`。不要改 `watch`、内存上限和 `env` 里的 `NODE_ENV`
- [X] T027 [P] [US3] 修改 `deploy/linux.md`：在 `pnpm install` 之后、`pnpm start` 与 `pnpm run prd` 之前写上 `pnpm run build`，并写明编译失败就不要启动。把「`pnpm start` 等价于 `node bin/www`」改为等价于 `node dist/bin/www.js`。生产入口改为 `dist/server.js` 拉起 `dist/bin/www.js`。文中 `app.js`、`database/index.js` 改为对应的 `.ts` 源码路径，并说明运行的是编译结果。不要改端口 `3000`、进程名、Nginx 或 `.env` 的位置。全文不得再把 `babel-node` 写成启动方式
- [X] T028 [P] [US3] 修改 `deploy/windows.md`：在 `pnpm install` 和 `pnpm run prd` 之间增加 `pnpm run build`，写明编译失败就不要执行 `prd`。进程名仍写 `bill-manage`，并指向 `server/pm2.conf.json`。不要改 Nginx 步骤
- [X] T029 [P] [US3] 修改 `.specify/memory/constitution.md`：原则 II 表格中后端职责由「Koa2 + MySQL + Redis，公开 API」改为「TypeScript 源码，运行时 Node.js + Koa 2 + MySQL + Redis，公开 API」。版本 `2.0.0` 改为 `2.1.0`，`Last Amended` 改为 `2026-10-18`。按该文件顶部的 SYNC IMPACT REPORT 格式写明这是 MINOR：只补充源码语言，不改变三端分工，不改原则 I、III、IV、V。不要在宪章里写编译命令

**检查点**：发布人员按 Linux 或 Windows 说明可以完成安装、编译和启动。宪章与源码语言一致。

---

## 阶段 6：收尾

**目的**：确认编译产物能启动，且仓库里没有把 `dist/` 或旧 JavaScript 业务源码留下。

- [X] T030 [P] 在 `server/` 搜索仍被维护的 `.js` 和没有后缀的 `bin/www`。运行时业务与启动源码应为 `.ts`；允许留下的 JavaScript 只有 `server/prettier.config.js`。`server/dist/` 若已生成，不得加入 git 暂存区
- [X] T031 [P] 按 `specs/006-server-to-typescript/quickstart.md` 第 2 节和第 4 节收口：`pnpm run build` 成功后再按说明启动，默认端口 `3000`。核对两份部署文档已包含编译步骤，且不再把旧的 `.js` 入口或 `babel-node` 写成现行步骤。没有 MySQL 时注明启动未跑，但文档核对仍要完成。验收备注：`pnpm run build` 成功，`dist/server.js` 被 `.gitignore` 忽略。编译产物已连上 MySQL 并监听 `3000`，核对后已停止。两份部署文档已包含 `pnpm run build`，现行步骤不再写 `babel-node` 或旧的 `.js` 入口。第 3 节手工记账未跑
- [X] T032 [P] 再读 `specs/006-server-to-typescript/contracts/behavior-parity.md`：确认本次没有新的对外路径、没有改表、没有改电脑网页和小程序的请求代码

---

## 依赖与执行顺序

### 阶段依赖

- **准备工作（阶段 1）**：无前置，可立即开始
- **基础（阶段 2）**：依赖 T001。T002、T003 可与 T001 同时做，安装必须在 T001 之后
- **用户故事（阶段 3 起）**：故事 1 依赖阶段 2。故事 2 依赖故事 1 的源码改写完成。故事 3 依赖 T001 里的脚本名，以及 T019 的 `dist` 入口；可与故事 2 并行
- **收尾（阶段 6）**：依赖打算交付的全部故事

### 用户故事之间

- **用户故事 1（P1）**：阶段 2 完成后即可开始，不依赖故事 2、3
- **用户故事 2（P1）**：依赖故事 1。它核对的是改写没有改变记账结果
- **用户故事 3（P2）**：不依赖故事 2 的手工记账。发布前应在编译脚本和 `dist/server.js` 入口已经确定之后再改文档

### 故事内部

- 故事 1：T005～T019 文件互不重叠，可同时改；T020 必须等这些文件都换成 `.ts`；T021 必须等 T020 通过
- 故事 2：T022、T023、T024 可同时做；T025 使用现有环境手工看，不写新功能
- 故事 3：四份文件各改各的，可同时做
- 不安排自动化测试

### 可并行的部分

- T001、T002、T003 可同时做
- T005～T019 可同时做
- T022、T023、T024 可同时做
- T026、T027、T028、T029 可同时做
- T030、T031、T032 可在前面的故事完成后同时做

---

## 并行示例：用户故事 1

```text
同时进行：
- T005 改 server/config 下四个模块
- T006 改 server/utils 下七个模块
- T008 改 server/database 的模型、连接和初始化
- T010～T018 按路由目录改写

然后：
- T020 补齐缺类型的依赖声明，直到 pnpm run typecheck 通过
- T021 故意写错一处类型，确认检查失败后再还原
```

---

## 实施策略

### 先做 MVP（用户故事 1）

1. 完成阶段 1、阶段 2
2. 完成阶段 3，让 `pnpm run typecheck` 对正确源码通过、对故意写错的类型失败
3. **停下来核对**：运行时源码已是 TypeScript，`server/prettier.config.js` 仍在
4. 同一版本接着做阶段 4。故事 2 也是 P1，不能只换语言却不核对账还在

### 增量交付

1. 阶段 1～2：工具链就绪，业务行为还没变
2. 故事 1：源码改为 TypeScript，发布前检查生效
3. 故事 2：确认登录、记账和已有明细与改写前一致
4. 故事 3：部署说明和宪章跟上启动方式
5. 阶段 6：按 quickstart 收口，确认 `dist/` 不入库

### 并行

阶段 2 完成后：

- 多人按 T005～T019 分目录改写故事 1，最后由一人做 T020
- 故事 1 完成后，一人做故事 2 的 diff 和手工核对，另一人改 `pm2.conf.json`、两份部署说明和宪章

---

## 备注

- [P] 表示不同文件、且不依赖未完成任务
- 故事标签只出现在阶段 3～5
- 开发用的 `tsx watch` 不代替发布门禁；能发布的前提是 `pnpm run build`（其中含类型检查）通过
- 根目录 `script/dev.js` 仍调用 `server` 的 `dev` 脚本，不要改这个文件
- 每完成一个故事就可以按该故事的独立测试停下来核对

## Phase 7: Convergence

- [X] T033 按 FR-003，把业务源码中的 `Loose`（`server/types/input.ts` 中等价于 `any`）从账本、记账、预算、分账等业务判断上撤下，只在缺少类型的依赖边界保留最小声明，使这些字段重新接受 `strict` 检查；不改接口、表和记账结果 (partial)
