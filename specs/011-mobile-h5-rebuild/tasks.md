---
description: "移动端 H5 重建（对齐小程序主路径）的任务列表"
---

# Tasks: 移动端 H5 重建

**Input**: Design documents from `/specs/011-mobile-h5-rebuild/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: 规格未要求自动化测试。不要为 `mobile-h5` 引入新测试框架。验证放在最后一阶段，按 [quickstart.md](./quickstart.md) 手工执行。

**Organization**: 按用户故事分阶段。Setup / Foundational 完成前不得开始故事实现。禁止修改 `specs/001`–`010`、禁止写回 `mobile/`、禁止恢复 `/mobile/`。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件，且不依赖尚未完成的任务）
- **[Story]**: 用户故事标签（US1…US6）
- 描述里必须有具体文件路径

## Path Conventions

- 新建 H5：`mobile-h5/`（Vue 3 + Vite + TypeScript + Vant）
- 部署：`deploy/nginx.conf`、`deploy/nginx-linux.conf`、`deploy/README.md`（及 windows/linux 文档）
- API：复用现网 `/api/v1`（见 [contracts/h5-api-reuse.md](./contracts/h5-api-reuse.md)）
- 不改：`mobile/`、`specs/001`–`010/`、`miniapp/`；本特性不改 PC 功能面（`frontend/` 仅作实现对齐参照，不改业务）
- 服务端：预期零新增业务路由（`server/routes/*` 不为本特性扩语义）

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 初始化独立 `mobile-h5/` 工程与构建基线，对齐 `/mobile/` 部署约定

- [x] T001 在仓库根创建 `mobile-h5/` 目录骨架：`package.json`、`vite.config.ts`、`tsconfig.json`、`tsconfig.node.json`、`index.html`、`src/main.ts`、`src/App.vue`、`src/env.d.ts`；`vite.config.ts` 的 `base` 适配生产路径 `/mobile/`（或相对路径 + Nginx alias，与 [contracts/m-static-deploy.md](./contracts/m-static-deploy.md) 一致）；开发态将 `/api` 代理到本机 API（对齐 `frontend` 代理思路）
- [x] T002 在 `mobile-h5/package.json` 安装并锁定依赖：`vue`、`vue-router@4`、`pinia`、`axios`、`vant`、`jsrsasign`，以及 Vite + Vue + TypeScript 开发依赖；提供 `dev` / `build` / `preview` / `typecheck`（或 `vue-tsc --noEmit`）脚本；**不要**引入微信 SDK 或注册相关依赖
- [x] T003 [P] 在 `mobile-h5/` 配置 ESLint/Prettier（或沿用 monorepo 既有前端规范文件，若无可最小落地 `.eslintrc.cjs` + `.prettierrc`），确保 `npm run build` 与类型检查可跑通空壳应用

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 会话、路由守卫、API 客户端、主壳与 Tab 框架——所有用户故事的阻塞前置

**⚠️ CRITICAL**: 任一用户故事实现不得在本阶段完成前开始

- [x] T004 在 `mobile-h5/src/utils/rsa.ts`（或等价路径）实现与 PC `frontend/src/components/login/hooks/use-login.ts` 同模式的 RSA 密码加密（`jsrsasign`）；约束原文：「使用与电脑端相同的账号 + 密码方式」；不得明文提交密码
- [x] T005 [P] 在 `mobile-h5/src/api/http.ts` 封装 Axios 实例：baseURL 指向 `/api/v1`；请求头携带现网要求的用户标识与令牌；统一解析 `ResModel`（`retCode` / `message` / `data`）；401/会话失效时清本地令牌并跳转登录；约束原文：「会话失效时 MUST 回到可登录状态」
- [x] T006 [P] 在 `mobile-h5/src/api/common.ts` 封装契约接口：`GET /common/login_config`、`POST /common/login`、`PUT /common/refreshToken`、`POST /common/logout`；**禁止**封装或调用 `/common/register`、`/common/wxLogin`、`/common/wxBind`（FR-011 / FR-012）
- [x] T007 [P] 在 `mobile-h5/src/api/bill.ts` 与 `mobile-h5/src/api/transaction.ts` 封装契约复用接口：`GET /bill/list`、`GET /bill`、`POST /bill`（新建）、`DELETE /bill`（删除）、`POST /bill/invite`、`POST /bill/join`、`POST /transaction/list`、`POST /transaction/`、`PUT /transaction/`、`DELETE /transaction/`，及详情汇总只读：`GET /transaction/currentMonthCost`、`GET /budget/list`、`GET /overview/balance`；不新造第二套账本/记账语义（FR-008）
- [x] T008 在 `mobile-h5/src/stores/session.ts` 用 Pinia 管理 `accessToken` / `refreshToken` / `expiresIn` / `userInfo` 的读写与持久化（localStorage 或 sessionStorage，与 PC 会话模式对等）；提供 `isAuthenticated`、`clearSession`；失效后不得继续展示过期会话数据
- [x] T009 [P] 在 `mobile-h5/src/stores/bill-context.ts` 管理当前账本上下文（选中账本 id/名称等），供记一笔与详情页共用；无账本时允许空状态
- [x] T010 在 `mobile-h5/src/router/index.ts` 配置路由：`/login`、主 Tab 布局（账本 / 记一笔 / 我的）及子路由占位（账单详情、新建、编辑、搜索、加入）；全局前置守卫：未登录访问业务路由 → 登录；已登录访问登录页 → 主界面；约束原文：「未登录用户 MUST 无法读取账本列表、账单明细或提交记账」
- [x] T011 在 `mobile-h5/src/layouts/MainTabLayout.vue`（或 `src/App.vue` + 布局组件）落地 Vant Tabbar 三入口：「账本」「记一笔」「我的」（FR-003）；子页面出口用 `<router-view>`；本阶段 Tab 内容可为占位，但导航骨架可用
- [x] T012 在 `mobile-h5/src/main.ts` 注册 Vue Router、Pinia、Vant（按需或全量与包体积权衡），挂载 `App.vue`；确认 `npm run dev` 可打开空壳并命中路由守卫

**Checkpoint**: 基础壳、会话与 API 客户端就绪；可以开始用户故事

---

## Phase 3: User Story 1 - 账号密码登录进入 H5 (Priority: P1) 🎯 MVP

**Goal**: 手机浏览器用与 PC 相同的账号密码完成登录并进入主界面；错误凭证明确失败；有效会话可续用；失效回登录

**Independent Test**: 用已知正确账号密码在手机浏览器（或桌面模拟移动 UA）完成登录并进入主界面；用错误密码看到明确失败提示且不进入业务页；无注册入口、无微信绑定入口

### Implementation for User Story 1

- [x] T013 [US1] 在 `mobile-h5/src/views/login/LoginView.vue` 实现仅登录表单（账号 + 密码 + 提交）：先 `login_config` 取公钥，RSA 加密后 `POST /common/login`，成功写入 `stores/session.ts` 并跳转主 Tab；失败停留本页展示可读 `message`，不暴露内部细节；约束原文：「MUST 仅提供登录，MUST NOT 提供注册入口」；页面上**不得**出现注册切换、微信登录/绑定按钮或文案入口
- [x] T014 [P] [US1] 在 `mobile-h5/src/router/index.ts`（及登录相关守卫逻辑）落实：凭证仍有效时打开入口无需重复输入即可进主界面（或按现网 refresh 规则续期）；凭证失效访问业务页 → 清会话并回登录；不得展示过期会话下的账本数据
- [x] T015 [P] [US1] 确认 `mobile-h5/src` 内无任何对 `/wxLogin`、`/wxBind`、`/register` 的调用或路由（可用仓库内搜索核对）；误加的「注册/绑定」路由必须删除或不可达

**Checkpoint**: User Story 1 可独立验收；此时账本/记账页仍可为占位

---

## Phase 4: User Story 2 - 浏览账本并进入账单 (Priority: P1)

**Goal**: 「账本」列出当前用户有权账本（可新建/删除本人创建账本）；点进某一账本进入与小程序对等的账单详情；无账本时空状态而非白屏

**Independent Test**: 登录后只验证账本列表与进入某一账本详情，不依赖改账或搜索即可演示价值

### Implementation for User Story 2

- [x] T016 [US2] 在 `mobile-h5/src/views/bills/BillsView.vue` 调用 `GET /bill/list` 渲染账本列表（行以账本名为重点，对齐小程序）；底部「新建账本」（名称 3–10）；本人创建账本可左滑删除并确认；空态文案「还没有账本，创建一个或让家人邀请你」；弱网/失败有可读提示与重试
- [x] T017 [US2] 在 `mobile-h5/src/views/bill-detail/BillDetailView.vue` 进入单一账本上下文：读取 `GET /bill`、六项汇总（`budget/list` + `currentMonthCost` + `overview/balance`）、`POST /transaction/list`；按日分组与归属人底色（`utils/records.ts` 对齐小程序）；本人左滑删除、FAB 记一笔、查看照片、创建者邀请码弹层；设置 `bill-context`；无权或加载失败有可读说明
- [x] T018 [P] [US2] 在 `mobile-h5/src/router/index.ts` 将账本列表 → 账单详情的路由参数（账本 id）接好，并保证从 Tab「账本」可回到列表

**Checkpoint**: User Story 2 可独立验收（在 US1 登录之后）

---

## Phase 5: User Story 3 - 记一笔 (Priority: P1)

**Goal**: 从「记一笔」或账本上下文完成记账；支出可分摊、收入仅单成员；校验必填；仅创建者可改删（改删能力可在 US4 完善，本故事至少完成新建与权限拒绝路径的 API 行为一致）

**Independent Test**: 已登录且有账本时完成一笔支出保存，并在账单中确认出现

### Implementation for User Story 3

- [x] T019 [US3] 在 `mobile-h5/src/views/record-add/RecordAddView.vue`（Tab「记一笔」）进入记账流程：若尚无当前账本则引导先选账本（复用列表或上下文）；有上下文则进入新建页
- [x] T020 [US3] 在 `mobile-h5/src/views/record-create/RecordCreateView.vue`（可抽 `mobile-h5/src/components/RecordForm.vue`）实现新建表单：类型（支出/收入）、金额、归属/分摊、必要字段；支出可「全部」或多成员；收入只能归属一名成员（不可多选或「全部」）；约束原文与用户手册权限/分摊规则一致；缺字段或非法金额阻止提交并提示
- [x] T021 [US3] 在新建保存路径调用 `POST /transaction/`；成功后在对应账单/流水中可见该笔；失败展示可读错误且不静默丢数据；非创建者改删若在本页暴露入口，须与 API 拒绝一致（FR-006）

**Checkpoint**: 主路径「打开账本 → 记一笔支出 → 账单可见」可走通（SC-002）

---

## Phase 6: User Story 4 - 搜索、查看与修改自己的记录 (Priority: P2)

**Goal**: 账本内关键字搜索；打开单笔；创建者可编辑自己的记录；无匹配空状态

**Independent Test**: 对已知关键字搜出目标记录，并成功改自己创建的一笔金额或备注类字段

### Implementation for User Story 4

- [x] T022 [US4] 在 `mobile-h5/src/views/record-search/RecordSearchView.vue` 用 `POST /transaction/list`（或现网同等筛选）按关键字检索当前账本记录；有结果列表；无匹配展示空状态而非错误页；行为对齐小程序搜索
- [x] T023 [US4] 在 `mobile-h5/src/views/record-edit/RecordEditView.vue`（复用 `RecordForm`）回填原记录并允许创建者 `PUT /transaction/` 保存；非创建者进入时禁用提交或展示拒绝说明；删除走 `DELETE /transaction/` 且同样受创建者约束；保存成功后列表/详情展示更新后内容

**Checkpoint**: User Story 4 可独立验收

---

## Phase 7: User Story 5 - 「我的」与退出 (Priority: P2)

**Goal**: 「我的」展示当前账号身份；退出清除本地会话；再进业务需登录；无微信绑定 UI

**Independent Test**: 打开「我的」确认身份信息，退出后无法再直接进入账本页

### Implementation for User Story 5

- [x] T024 [US5] 在 `mobile-h5/src/views/mine/MineView.vue` 展示当前 `userInfo`（昵称/账号等，对齐小程序「我的」信息密度参照）；**不得**提供微信绑定入口、微信头像绑定体系或授权按钮（FR-012）
- [x] T025 [US5] 在 `MineView.vue` 实现退出：确认后调用 `POST /common/logout`（若现网需要）并 `clearSession`；跳转登录；之后访问账本等业务路由须重新登录

**Checkpoint**: User Story 5 可独立验收

---

## Phase 8: User Story 6 - 通过邀请加入账本 (Priority: P3)

**Goal**: 已登录用户凭有效邀请加入账本并在列表可见；无效邀请失败说明；未登录先登录再继续

**Independent Test**: 用有效邀请在测试账号加入账本，列表出现该账本；无效邀请有明确失败提示

### Implementation for User Story 6

- [x] T026 [US6] 在 `mobile-h5/src/views/join/JoinView.vue` 实现邀请码/链接加入流程：已登录时 `POST /bill/join`；成功后账本列表可见新账本；无效或过期邀请展示失败说明且不产生错误成员关系
- [x] T027 [US6] 在 `mobile-h5/src/router/index.ts` 处理未登录打开加入入口：先登录再回到加入流程（或明确提示需先登录）；深链参数（邀请码）在登录后保留

**Checkpoint**: 全部用户故事均可独立验证

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: 部署合同、构建产物、手工验收与归档边界

- [x] T028 [P] 按 [contracts/m-static-deploy.md](./contracts/m-static-deploy.md) 更新 `deploy/nginx.conf` 与 `deploy/nginx-linux.conf`：新增 `location /mobile/`（`/mobile` → `/mobile/`、`try_files` 回退 `index.html`、静态资源 200）；**保持** `/mobile`、`/mobile/` 及其下资源 404，且不 301/302 到 `/mobile/` 或 `/pc/`
- [x] T029 [P] 更新 `deploy/README.md`（及 `deploy/windows.md` / `deploy/linux.md` 若存在）补充 `mobile-h5` 构建产物发布到 `html/bill/mobile/` 或 `/var/www/bill/mobile/` 的步骤
- [x] T030 确认 `mobile-h5` 生产构建（`npm run build` + `vue-tsc`）通过；产物目录可直接拷贝至 Nginx `.../bill/mobile/`
- [x] T031 按 [quickstart.md](./quickstart.md) 手工走完验收场景 1–10（登录、无注册、无微信绑定、账本→记一笔、权限、搜索/改账、我的/退出、加入、`/mobile/` 与 `/mobile/` 合同、`git diff` 确认未改 `specs/001`–`010`）
- [x] T032 [P] 全库快速核对：无恢复 `mobile/` 源码托管；H5 主路径无 `/wxLogin`、`/wxBind`、注册 UI；本特性提交不包含对 `specs/001`–`010` 的正文修改（SC-005、SC-006、FR-009、FR-010）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖，可立即开始
- **Foundational (Phase 2)**: 依赖 Setup 完成；**阻塞**所有用户故事
- **User Stories (Phase 3–8)**: 均依赖 Foundational；建议按 P1 → P2 → P3 顺序（US1 → US2 → US3 → US4 → US5 → US6）；人员充足时可在 Foundational 后并行不同故事（注意共享表单组件冲突）
- **Polish (Phase 9)**: 依赖目标故事完成后再做部署与 quickstart 验收

### User Story Dependencies

- **US1 (P1)**: Foundational 后即可开始；无故事间依赖；**建议 MVP**
- **US2 (P1)**: 依赖登录会话（US1）；可与 US1 衔接验证
- **US3 (P1)**: 依赖账本上下文（US2）；主路径 MVP 建议含 US1+US2+US3
- **US4 (P2)**: 依赖已有记录与账本上下文（US2/US3）；编辑表单可复用 US3 的 `RecordForm`
- **US5 (P2)**: 主要依赖会话 store（Foundational/US1）；与 US2–US4 无强耦合
- **US6 (P3)**: 依赖登录（US1）与账本列表（US2）展示加入结果

### Within Each User Story

- API 封装（Phase 2）→ 页面/组件 → 路由串联 → 错误与空状态
- 不写自动化测试（规格未要求）
- 每故事结束后按 Independent Test 手工点验

### Parallel Opportunities

- Phase 1：T003 可与依赖安装收尾并行文档/配置整理
- Phase 2：T005、T006、T007、T009 可并行（不同文件）；T004/T008/T010/T011 有顺序依赖时串行
- Phase 3：T014 与 T015 可并行
- Phase 4：T018 可与 T016/T017 部分并行（路由 vs 页面）
- Phase 7：T024/T025 同文件建议串行
- Phase 9：T028、T029、T032 可并行

---

## Parallel Example: Foundational

```bash
# 不同文件可同时进行：
Task: "Axios 封装 mobile-h5/src/api/http.ts"
Task: "common API mobile-h5/src/api/common.ts"
Task: "bill/transaction API mobile-h5/src/api/bill.ts 与 transaction.ts"
Task: "账本上下文 store mobile-h5/src/stores/bill-context.ts"
```

## Parallel Example: User Story 1

```bash
Task: "路由会话续期/失效守卫 mobile-h5/src/router/index.ts"
Task: "核对无 wx/register 调用（全 src 搜索）"
```

---

## Implementation Strategy

### MVP First（建议 US1 + US2 + US3）

1. 完成 Phase 1 Setup
2. 完成 Phase 2 Foundational（阻塞点）
3. 完成 Phase 3–5（登录 → 账本 → 记一笔）
4. **STOP**：按 Independent Test / SC-001、SC-002 验收
5. 再交付 US4–US6 与部署合同

### Incremental Delivery

1. Setup + Foundational → 壳可用
2. US1 → 可登录演示
3. US2 → 可见账本
4. US3 → 可记账（MVP 主路径）
5. US4 → 搜索改账闭环
6. US5 → 身份与安全退出
7. US6 → 家庭扩展加入
8. Polish → `/mobile/` 上线合同与 quickstart 勾选

### Parallel Team Strategy

1. 全员先完成 Setup + Foundational
2. 之后可拆：A=US1+US5（会话相关），B=US2+US3（账本记账），C=US4+US6（搜索加入）；合并前协调共享 `RecordForm` 与 router

---

## Notes

- [P] = 不同文件且无未完成依赖
- [USn] 映射 spec.md 用户故事，便于追溯
- 每个故事应可独立点验收
- 提交按任务或逻辑组拆分；任何 checkpoint 可停下来演示
- 避免：含糊任务、多人同改一文件无协调、为 H5 另造业务 API、写回 `mobile/`、改归档 specs、加注册/微信绑定
