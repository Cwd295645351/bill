# Implementation Plan: 移动端 H5 重建

**Branch**: `011-mobile-h5-rebuild` | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-mobile-h5-rebuild/spec.md`

## Summary

在独立目录 `mobile-h5/` 新建手机浏览器记账应用，部署路径 `/mobile/`，功能对齐微信小程序主路径（账本 / 记一笔 / 我的，以及账单详情、记/改账、搜索、加入账本）。登录与 PC 一致：账号密码 + JWT（含 RSA 密码加密与 refresh）；**不提供 H5 注册**、**不提供微信绑定/网页授权页面**。复用现有 `/api/v1` 业务接口，不新增第二套账本/记账语义；不恢复旧 `mobile/` 或 `/mobile/`。本 plan 只交付设计产物，不写业务实现代码。

## Technical Context

**Language/Version**: 客户端 TypeScript；Vue 3。构建 Vite（与现网 `frontend/` 同族）。不改服务端语言版本。

**Primary Dependencies**: Vue 3、Vue Router 4、Pinia、Axios、Vant（移动端组件库，对齐小程序 Vant Weapp 体验）、jsrsasign（与 PC 相同的 RSA 密码加密）。服务端继续 Koa + 现有 `server/routes/*`，本特性预期**零新增业务路由**（仅部署/静态入口变更）。

**Storage**: 不改表结构。H5 本地仅存会话令牌与必要用户展示信息（localStorage/sessionStorage，与 PC 会话模式对等即可）。

**Testing**: `mobile-h5` 侧 `vue-tsc` / 构建通过；手工按 [quickstart.md](./quickstart.md) 走登录→账本→记一笔→搜索/改账→我的退出→邀请加入。对照 PC/小程序同账号数据与权限。Nginx：`/mobile/` 可访问，`/mobile/` 仍 404。

**Target Platform**: 手机浏览器（含微信内置浏览器与独立 Safari/Chrome）。不改小程序、不改 PC 页面功能面。

**Project Type**: 独立 Web SPA（`mobile-h5/`）+ 既有 API（`server/`）+ Nginx 静态托管扩展（`deploy/`）。

**Performance Goals**: 常规网络下满足规格 SC-001（2 分钟内登录见账本）、SC-002（3 分钟主路径记账）。首屏与接口以现网 `/api/v1` 延迟为准，不另定服务端 SLA。

**Constraints**: 宪章 v3.0.0：新建 `mobile-h5/`、`/mobile/`；旧 旧源码目录 `mobile/` 永关；禁止改 `specs/001`–`010`；登录仅账号密码；无 H5 注册；无微信绑定页。H5 不得调用或依赖 `/wxLogin`、`/wxBind` 完成主路径。

**Scale/Scope**: 新建一个前端工程与部署入口；页面集合对齐小程序除 `bind` 外的记账相关页；文档/部署说明回写 `deploy/`。

## Constitution Check

| 原则 | 设计前 | 设计后 |
|------|--------|--------|
| I. 存量优先，增量规格化 | 通过。只交付新 H5 入口与对等记账能力。 | 通过。规格仅在 `011`；不回头改归档规格。 |
| II. 多端边界不可混用 | 通过。落点 `mobile-h5/`，不写回 `mobile/`。 | 通过。PC / 小程序默认不改功能；API 复用。 |
| III. 账本隔离与记账权责 | 通过。权限与分摊规则走现网接口与手册。 | 通过。客户端不另造语义；创建者改删等由 API 拒绝。 |
| IV. 公开契约向后兼容 | 通过。新增 `/mobile/` 静态合同；`/mobile/` 关停不变；`/api/v1` 不破坏。 | 通过。见 [contracts/](./contracts/)。 |
| V. 密钥与部署约定 | 通过。无新密钥；JWT/RSA 沿用现网。 | 通过。`/mobile/` Nginx 写回 `deploy/`；密钥仍不进 Git。 |

## Project Structure

### Documentation (this feature)

```text
specs/011-mobile-h5-rebuild/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── h5-api-reuse.md
│   └── m-static-deploy.md
├── checklists/requirements.md
└── spec.md
```

### Source Code (repository root)

```text
mobile-h5/                          # 新建：Vue3 + Vite + TS + Vant
├── package.json
├── vite.config.ts                  # base 适配 /mobile/（或相对路径 + Nginx alias）
├── index.html
└── src/
    ├── main.ts
    ├── App.vue
    ├── router/                     # 登录守卫；主 Tab：账本/记一笔/我的
    ├── stores/                     # 会话、当前账本上下文
    ├── api/                        # Axios 封装；对齐 /api/v1
    ├── views/
    │   ├── login/                  # 仅登录（无注册、无微信绑定）
    │   ├── bills/                  # 账本列表
    │   ├── bill-detail/            # 账单详情
    │   ├── record-add/             # Tab「记一笔」入口
    │   ├── record-create/          # 新建记账
    │   ├── record-edit/            # 编辑自己的记录
    │   ├── record-search/          # 搜索
    │   ├── mine/                   # 我的 + 退出（无绑定入口）
    │   └── join/                   # 邀请加入
    └── utils/                      # RSA 加密密码等（对齐 PC）

server/                             # 预期不改业务路由；沿用 common/bill/transaction/...
deploy/
├── nginx.conf                      # 增加 location /mobile/；保持 /mobile/ 不托管
├── nginx-linux.conf                # 同上
└── README.md / windows.md / linux.md  # 补充 /mobile/ 发布步骤

# 明确不碰
mobile/                             # 永久冻结
specs/001–010/                      # 归档不可改
frontend/                           # 本特性不改 PC 功能（除非联调文档交叉引用）
miniapp/                            # 本特性不改小程序
```

**Structure Decision**: 新建独立 SPA `mobile-h5/`（宪章 II），构建产物部署到 Nginx `html/bill/mobile/`（或 Linux `/var/www/bill/mobile/`），对外路径 `/mobile/`。业务数据全部经现有 `/api/v1`；不恢复 `mobile/`。

## Complexity Tracking

> 无宪章违规需辩护。新建端是宪章 v3.0.0 已批准的产品面，不是「第四套未经批准技术栈」。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Phase 0 / Phase 1

见 [research.md](./research.md)、[data-model.md](./data-model.md)、[contracts/](./contracts/)、[quickstart.md](./quickstart.md)。
