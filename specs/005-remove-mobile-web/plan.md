# Implementation Plan: 移除手机端网页

**Branch**: `005-remove-mobile-web` | **Date**: 2026-10-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-remove-mobile-web/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

关掉手机浏览器里的记账网页。原来的 `/mobile/` 不再提供页面，也不改成说明或跳转。电脑网页、微信小程序、账务数据和 `/api/v1` 的响应形状保持不变。

做法见 [research.md](./research.md)：

- 从 Nginx 去掉 `/mobile` 与 `/mobile/`。未匹配的地址走 Nginx 默认 404，不自定义错误页。
- 不拦截 `/api`。当前没有人在用手机网页，不为「页面还开着」增加来源判断。
- 删除仓库里的 `mobile/`，并同步用户手册、readme 和部署说明。不改数据库，不改电脑端、小程序和服务端源码。

## Technical Context

**Language/Version**: 服务端 Node.js + Koa 2（`server/`，本次不改）。电脑端 Vue 3 + Vite + TypeScript（`frontend/`，本次不改）。小程序原生 + TypeScript + Vant Weapp（`miniapp/`，本次不改）。被移除的手机网页是 Vue 3 + Vite + Vant，路由为 hash。

**Primary Dependencies**: Nginx 静态托管与 `/api` 反代。不新增 npm 依赖。

**Storage**: 无变更。不改表、不迁移、不删除账号、账本、明细、预算、计划或微信绑定。

**Testing**: 仓库没有自动化测试。用 `curl` 核对 `/mobile` 返回 404 且不跳转，并人工确认电脑网页、小程序和用户手册。步骤见 [quickstart.md](./quickstart.md)。

**Target Platform**: 生产环境的 Linux 与 Windows Nginx。手机网页入口关闭后，用户只使用电脑网页（`/pc/`）和微信小程序。

**Project Type**: 多端 Web 应用加小程序，共用一套 REST API。本次只撤掉其中一个静态入口。

**Performance Goals**: 不新增请求。`/mobile/` 在 Nginx 直接 404，不进入 Node。

**Constraints**:

- `/mobile` 与 `/mobile/` 及其下任何路径都不得返回记账页面、说明页，也不得 301/302 到 `/pc/` 或其他地址。
- 手机网页内部是 hash 路由，账本、流水、搜索等「子页面」的服务器路径仍是 `/mobile/` 或 `/mobile/index.html`。
- `/api/v1` 的路径、字段、状态码保持不变，不按来源拒绝请求。
- 不新增手机浏览器客户端，不保留 `mobile/` 源码以便日后再构建。

**Scale/Scope**: 一个已上线静态站点下线。改动面是 Nginx 两份模板、部署与使用说明，以及删除 `mobile/`。业务代码与数据库不在范围内。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 设计前 | 设计后 |
|------|--------|--------|
| I. 存量优先，增量规格化 | 通过。规格只要求关掉手机网页，并写明电脑端、小程序和历史账务不动。 | 通过。没有顺带改记账、分账或接口形状。用户手册按 FR-009 删掉手机网页入口。历史规格目录不改。 |
| II. 多端边界不可混用（v2.0.0） | 通过。宪章已删除移动端 H5，并禁止恢复。规格 Assumptions 已改成按宪章 2.0.0 下线。 | 通过。只删 `mobile/` 和它的入口。不把手机网页的能力补进小程序，也不新增浏览器端。 |
| III. 账本隔离与记账权限 | 通过。不改记账人、归属人、分享码和绑定规则，不删数据。 | 通过。见 [data-model.md](./data-model.md)。权限判断仍在现有服务端，本次不改。 |
| IV. 公开契约向后兼容 | 通过。宪章 2.0.0 已把 `/mobile/` 标成批准的破坏性关停，不再要求兼容。`/pc/` 与 `/api` 仍在合同内。 | 通过。`/api/v1` 不改。关停只发生在静态入口。合同见 [contracts/mobile-shutdown.md](./contracts/mobile-shutdown.md)。 |
| V. 密钥与部署约束 | 通过。不新增密钥。部署模板在 `deploy/`。 | 通过。Linux 与 Windows 的 Nginx 模板一起改，避免只关一端。 |

五项均通过，没有需要写入 Complexity Tracking 的违反。

## Project Structure

### Documentation (this feature)

```text
specs/005-remove-mobile-web/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── mobile-shutdown.md
└── tasks.md              # 由 /speckit-tasks 生成，本命令不创建
```

### Source Code (repository root)

```text
deploy/nginx-linux.conf          # 删除 /mobile 两个 location，不改 /api/
deploy/nginx.conf                # 与 Linux 模板同一改动（Windows）
deploy/linux.md                  # 去掉 mobile 的构建、同步和访问说明
deploy/windows.md                # 同上
deploy/README.md                 # 去掉「旧手机网页会被拒绝」中对手机网页的依赖描述
readme.md                        # 项目结构、构建和访问地址不再包含移动端
docs/用户手册.md                  # 删第 10 章；简介、快速开始、登录、权限、常见问题、附录 C/D 不再把手机网页列为可用入口

# 删除
mobile/                          # 整个目录，含源码、构建配置和锁文件

# 明确不改
frontend/                        # 电脑网页
miniapp/                         # 微信小程序
server/                          # 业务接口与数据库
script/dev.js                    # 已经只启动 frontend 与 server
script/install.js                # 已经不安装 mobile
specs/001-* 至 specs/004-*       # 历史规格档案
```

**Structure Decision**: 关停只发生在 Nginx 的静态入口，不进 Node，也不按来源过滤 `/api`。当前没有手机网页用户，公共接口继续给电脑网页和小程序用。仓库不再保留 `mobile/`，避免下次部署又把它构建上去。

## Complexity Tracking

无。关停 `/mobile/` 已由宪章 2.0.0 写明，不构成原则违反。
