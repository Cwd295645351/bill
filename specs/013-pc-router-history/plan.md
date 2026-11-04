# Implementation Plan: PC 路由 History 与鉴权回跳

**Branch**: `013-pc-router-history` | **Date**: 2026-11-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-pc-router-history/spec.md`

## Summary

重写 PC `vue-router` 守卫与登录回跳；401/logout 统一带安全 redirect；账本上下文进入路径 `/layout/bill/:billId/{tab}`；补 404；预算→记账用 `?costTypeId=`；`createWebHashHistory` 改为 `createWebHistory`，Vite `base` 与 nginx SPA fallback 对齐 `/pc/`。

## Technical Context

**Language/Version**: TypeScript / Vue 3 / vue-router 4  
**Primary Dependencies**: 现有 frontend  
**Storage**: sessionStorage（token/userInfo/billId 兼容）；路由为账本上下文源  
**Testing**: 手工（登录守卫、redirect、深链刷新、404、预算跳转）  
**Target Platform**: PC 网页（dev `:4000`，prod `/pc/`）  
**Project Type**: web-app  
**Constraints**: 不改归档 specs；不污染无关 package.json/.gitignore；不改小程序/H5 路由  
**Scale/Scope**: router + login/layout/logout + 各 views router 路径 + nginx + 手册一小段

## Constitution Check

- 新功能仅 `specs/013-*`，不改 001–012 正文。  
- 仅 PC frontend / deploy 配置；边界清晰。  
- 用户可见地址形态变化同步手册。

## Project Structure

### Documentation

```text
specs/013-pc-router-history/
├── spec.md
├── plan.md
├── tasks.md
└── checklists/requirements.md
```

### Source (expected touch)

```text
frontend/vite.config.ts
frontend/src/main.ts
frontend/src/router/index.ts
frontend/src/router/helpers.ts          (new)
frontend/src/views/NotFound.vue         (new) 或 components/not-found
frontend/src/components/login/router.ts
frontend/src/components/login/hooks/use-login.ts
frontend/src/components/layout/hooks/use-layout.ts
frontend/src/utils/common-info/index.ts
frontend/src/views/*/router.ts
frontend/src/views/bill/hooks/use-bill.ts
frontend/src/views/budget/hooks/use-budget.ts
frontend/src/views/record/hooks/use-record.ts
deploy/nginx.conf
deploy/nginx-linux.conf
docs/用户手册.md
```

## Design

### URL 形态

| 场景 | 路径 |
|------|------|
| 登录 | `/login` |
| 账本列表 | `/layout/bill` |
| 记账 | `/layout/bill/:billId/record` |
| 概览/预算/计划/资产 | `/layout/bill/:billId/{overview\|budget\|plan\|asset}` |
| 预算跳记账 | 同上 + `?costTypeId=` |
| 404 | catch-all 组件 |

生产实际浏览器地址带 base：`/pc/layout/bill/...`（`createWebHistory(import.meta.env.BASE_URL)`）。

### 鉴权

- `meta.public === true`：登录页（及可选静态公开页）。  
- `isAuthenticated()`：`getUserInfo().accessToken` 非空。  
- `beforeEach`：未登录且非 public → `{ path:'/login', query:{ redirect: to.fullPath } }`。  
- `sanitizeRedirect`：须以 `/` 开头、禁止 `//` 与 `://`、禁止跳到外链。  
- `logoutUser`：清会话后 `push({ path:'/login', query:{ redirect } })`（当前 fullPath，排除 login）。

### History / base / nginx

- Vite：`base: process.env.NODE_ENV === 'production' ? '/pc/' : '/'`。  
- Router：`createWebHistory(import.meta.env.BASE_URL)`。  
- `main.ts`：若 `location.hash` 为 `#/...`，`history.replaceState` 到 `BASE_URL + hash.slice(1)`。  
- nginx：`/pc/` 用 `root` + `try_files $uri $uri/ /pc/index.html`（修复 alias 深链刷新）。  
- 旧 `/layout/record` 等：redirect 到带 sessionStorage billId 的新路径或列表。

### 布局同步

- `use-layout`：从 `route.params.billId` / `route.name` 同步 store、sessionStorage、顶栏高亮；菜单 route 动态拼 billId。  
- `use-bill.showBillDetail` → `push(/layout/bill/${id}/record)`。  
- `jumpRecord` → path + `query.costTypeId`；`use-record` 优先读 query，其次 Pinia。

## Out of Scope

后端认证、H5/小程序路由、归档规格修订。

## Fix note (2026-11-04)

F5 on record page crashed because use-layout immediate watch called getInfo before const getInfo initialization (TDZ). Moved getInfo above the watch; also install Pinia before Router.
