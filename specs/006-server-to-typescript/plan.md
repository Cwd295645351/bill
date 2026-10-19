# Implementation Plan: 服务端源码改为 TypeScript

**Branch**: `006-server-to-typescript` | **Date**: 2026-10-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-server-to-typescript/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

把 `server/` 里会在进程中执行的 JavaScript 改为 TypeScript，并在发布前用类型检查拦住明确的类型错误。电脑网页、微信小程序、账本数据和 `/api/v1` 的行为保持不变。

做法见 [research.md](./research.md)：

- 开发用 `tsx` 直接运行源码；生产用 `tsc` 编译到 `server/dist/`，再由 Node 启动。进程名、端口、密钥位置不变。
- `strict: true`。缺少类型的第三方包只在 `server/types/` 做边界声明。
- 读取 `.env` 和访问日志时固定使用 `server/` 根目录，避免编译产物目录把这两个路径带走。
- 更新 Linux 与 Windows 的部署说明，以及宪章里后端的源码语言描述。

## Technical Context

**Language/Version**: 服务端源码 TypeScript 5.x，编译目标 ES2020、模块格式 CommonJS；运行时 Node.js 18 及以上。电脑网页 Vue 3 + Vite + TypeScript、小程序原生 TypeScript 本次不改。

**Primary Dependencies**: 现有 Koa 2、Sequelize、MySQL、Redis 及当前 `server/package.json` 中的库。新增开发依赖：`typescript`、`tsx`、`@types/node`，以及实现时核对后确有公开类型的 `@types/*`。不更换业务依赖，不引入新的测试框架。

**Storage**: 无变更。MySQL 表结构、Redis 会话和对象存储用法保持原样。不写迁移脚本。

**Testing**: 仓库没有服务端自动化测试，本次不新增。验收用 `tsc` 的成功与失败，以及 [quickstart.md](./quickstart.md) 里的启动和记账抽查。

**Target Platform**: 开发机与现有 Linux、Windows 部署。对外仍由 Nginx 反代 `/api`，服务端默认 `127.0.0.1:3000`。

**Project Type**: 多端记账应用的后端。本次只改服务端源码的编写、检查和启动方式。

**Performance Goals**: 不设定新的吞吐指标。编译发生在发布前，请求路径上仍是 Node 执行编译结果，不在每次请求时转译 TypeScript。

**Constraints**:

- 纳入运行的业务与启动源码必须是 TypeScript，并且通过 `strict` 检查后才能发布。
- `/api/v1` 的路径、字段和用户能理解的失败原因不变。端口默认 `3000`，PM2 进程名 `bill-manage`。
- 密钥仍只在 `server/.env` 或进程环境。访问日志仍在 `server/logs/access.log`。
- 不改表，不改电脑网页和小程序，不恢复手机网页。
- 不借迁移清理无关注释、未使用变量或业务结构。

**Scale/Scope**: 一个现有 Koa 服务，约 40 个运行时 JavaScript 文件，外加无后缀入口 `bin/www`。不含 `frontend/`、`miniapp/` 和已删除的手机网页。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 设计前 | 设计后 |
|------|--------|--------|
| I. 存量优先，增量规格化 | 通过。规格只要求换服务端源码语言，并写明记账行为、两端客户端和历史数据不动。 | 通过。研究结论不改接口和表。不新增测试覆盖率要求。部署说明只更正会被这次启动方式改掉的步骤。 |
| II. 多端边界不可混用 | 通过。只改 `server/`。不把服务端职责移到电脑网页或小程序，不恢复手机网页。 | 通过。目录分层仍是 `routes/` 与 `database/services`。宪章后端一行在实现时补上 TypeScript，版本 `2.0.0` → `2.1.0`，三端分工不变。 |
| III. 账本隔离与记账权限 | 通过。隔离、记账人、归属人、分享码和微信绑定都要求与改写前一致。 | 通过。见 [data-model.md](./data-model.md)。权限仍由现有服务判断，本次只换写法。 |
| IV. 公开契约向后兼容 | 通过。规格未批准改变 `/api/v1` 或表结构。`/mobile/` 保持已关停，与本次无关。 | 通过。行为合同见 [contracts/behavior-parity.md](./contracts/behavior-parity.md)。没有新路径或新字段。 |
| V. 密钥与部署约束 | 通过。密钥继续放在 `server/.env`。启动方式若变化，必须改 `deploy/`。 | 通过。编译产物不携带密钥。Linux 与 Windows 说明一起加上编译步骤，避免只改一端。 |

五项均通过，没有需要写入 Complexity Tracking 的违反。

## Project Structure

### Documentation (this feature)

```text
specs/006-server-to-typescript/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── behavior-parity.md
└── tasks.md              # 由 /speckit-tasks 生成，本命令不创建
```

### Source Code (repository root)

```text
server/
├── tsconfig.json              # 新增。strict，产出 CommonJS 到 dist/
├── types/                     # 新增。仅放缺少类型的依赖声明
├── package.json               # 脚本改为 typecheck、build、tsx 开发、node 运行 dist
├── pm2.conf.json              # script 改为 dist/server.js，解释器改为 node
├── bin/www.ts                 # 由 bin/www 改名并改为 TypeScript
├── server.ts                  # 由 server.js 改来，只负责拉起入口
├── app.ts                     # 由 app.js 改来；.env 与 logs 固定在 server 根目录
├── config/                    # 运行时配置模块改为 .ts
├── database/                  # 模型与服务改为 .ts，表结构不改
├── routes/                    # 路由与控制器改为 .ts
├── utils/                     # 改为 .ts
├── model/resModel.ts
└── dist/                      # tsc 产物，已由仓库 .gitignore 忽略，不提交

# 保持 JavaScript / 非源码
server/prettier.config.js
server/.env                    # 不提交
deploy/sql/

# 说明
deploy/linux.md                # 安装后增加编译，再启动；更正 .js 路径
deploy/windows.md              # 同上
.specify/memory/constitution.md # 原则 II 后端补上 TypeScript，2.1.0

# 明确不改
frontend/
miniapp/
script/dev.js                  # 仍调用 server 的 dev 脚本
docs/用户手册.md
specs/001-* 至 specs/005-*
```

**Structure Decision**: 源码留在现有 `server/` 分层里，只把运行时文件从 JavaScript 换成 TypeScript。生产运行 `dist/` 中的 CommonJS，避免 Node 18 直接执行 TypeScript，也避免把 `.env` 放进编译目录。开发用 `tsx` 缩短反馈，发布以 `tsc` 通过为准。

## Complexity Tracking

无。源码语言变化没有突破宪章里的三端分工、记账权限或公开接口兼容要求。
