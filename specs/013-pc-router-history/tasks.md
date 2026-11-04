# Tasks: PC 路由 History 与鉴权回跳

**Input**: Design documents from `/specs/013-pc-router-history/`

**Prerequisites**: plan.md, spec.md

**Tests**: 手工验证

**Organization**: 按用户故事分组

## Phase 1: Setup

- [x] T001 创建 `specs/013-pc-router-history/`（spec/plan/tasks/checklist）并更新 `.specify/feature.json`

## Phase 2: Foundational

- [x] T002 [P] 新增 `frontend/src/router/helpers.ts`：`sanitizeRedirect` / `isAuthenticated` / `billTabPath` / 旧路径 redirect 辅助
- [x] T003 Vite `base` 改为 prod `/pc/`、dev `/`；`main.ts` 增加 Hash→History 兼容替换
- [x] T004 更新 `deploy/nginx.conf` 与 `deploy/nginx-linux.conf`：`/pc/` SPA `try_files`（root 模式）

## Phase 3: US1+US3+US6 守卫 / 登录 / History / logout

- [x] T005 重写 `frontend/src/router/index.ts`：`createWebHistory`、`meta.public`、`beforeEach`、挂载子路由新路径、catch-all、旧路径 redirect
- [x] T006 登录路由 `meta.public`；`use-login.ts` 登录成功走安全 redirect
- [x] T007 `logoutUser` 与 401 路径统一带当前 fullPath redirect
- [x] T008 新增极简 `NotFound` 页并接入 catch-all

## Phase 4: US2 账本进 URL

- [x] T009 更新各 `views/*/router.ts` 为 `/layout/bill/:billId/...`（列表仍为 `/layout/bill`）
- [x] T010 `use-layout.ts`：菜单/高亮/返回列表与 `route.params.billId` 同步
- [x] T011 `use-bill.ts` 进入账本 push 新路径

## Phase 5: US5 预算→记账 query

- [x] T012 `use-budget.ts` `jumpRecord` 带 `costTypeId` query
- [x] T013 `use-record.ts` 优先读 `route.query.costTypeId`，保留 Pinia 回退

## Phase 6: Polish

- [x] T014 手册补一小段 PC 地址由 `#` 改为路径（含 `/pc/` 与深链刷新说明）
- [x] T015 自检清单：守卫、redirect、账本 Tab URL、404、dev 刷新；确认未改归档 specs 与无关 package.json/.gitignore

## Dependencies

- T001 → T002 → T003/T004 → T005 → T006/T007/T008 → T009 → T010/T011 → T012/T013 → T014/T015

## Parallel Opportunities

- T003 与 T004；T006 与 T007；T010 与 T011；T012 与 T013

