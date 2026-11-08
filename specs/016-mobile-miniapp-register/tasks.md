# Tasks: 移动端与小程序注册

**Input**: Design documents from `/specs/016-mobile-miniapp-register/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 规格未要求自动化测试；本列表不含 TDD/契约测试任务，以 quickstart 手工验收为准。

**Organization**: 按用户故事拆分，便于独立实现与验收。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无未完成依赖）
- **[Story]**: US1/US2/US3 对应用户故事
- 描述须含确切文件路径

## Path Conventions

本仓库触点：`server/`、`mobile-h5/`、`miniapp/`、`docs/`、`.specify/memory/`（不改 `frontend/` 功能、不碰旧 `mobile/`）

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 对齐设计制品与改动边界，无新工程脚手架

- [x] T001 核对 `specs/016-mobile-miniapp-register/` 下 plan/research/data-model/contracts/register-api.md/quickstart 齐全，并按 plan「Source Code」列出将改文件清单（确认不改 `frontend/` 功能代码、不恢复旧 `mobile/`）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 确认无库表迁移；理清可复用的注册/绑定/滑块能力，再开故事实现

**⚠️ CRITICAL**: 本阶段完成前不开始 US1/US2/US3 编码

- [x] T002 阅读并确认复用点：`server/routes/common/controller.ts` 中 `register`（用户名占用、密码强度：长度≥8 且含小写/大写/数字、昵称空则回落 username）与 `wxBind`（bindTicket、openid/user_id 唯一）；`consumeCaptcha` 一次性消费；无新 MySQL 表
- [x] T003 [P] 确认 `server/app.ts` JWT `unless` 已放行 `/api/v1/common/register` 与 `wxBind`/`captcha`，记下新增 `wxRegister` 放行位置；确认 `mobile-h5`/`miniapp` 未登录请求模式与 015 滑块一致

**Checkpoint**: 基础就绪——可开始用户故事（US1 仅依赖既有 `register`；US2 将新增 `wxRegister`）

---

## Phase 3: User Story 1 - 移动端 H5 完成注册 (Priority: P1) 🎯 MVP

**Goal**: H5 提供与 PC 同规则的注册；成功后提示并回到登录，再登录进入主流程

**Independent Test**: 未登录打开 `/mobile/` → 注册合法账号（含滑块）→ 回到登录 → 再登录进入主界面；弱密码/重名/未过滑块失败

### Implementation for User Story 1

- [x] T004 [P] [US1] 在 `mobile-h5/src/api/common.ts` 新增 `register({ username, password, nickName?, captchaId, captchaX })`，请求 `POST /common/register`（`silent: true`，无需登录）
- [x] T005 [US1] 改造 `mobile-h5/src/views/login/LoginView.vue`：增加 `login | register` 模式切换、「注册账号」入口；注册表单含用户名（必填）、昵称（选填）、密码（必填）；对齐 PC 校验（用户名 3–20 位 `\w`，密码强度规则与提交前提示）
- [x] T006 [US1] 在 `LoginView.vue` 接线注册提交：点注册 → 弹窗复用既有 `SliderCaptcha` → 调用 `register`；成功提示「注册成功，请登录」、切回登录态并清空密码、**不**调用 `session.setSession`；失败展示可读错误并 `captchaRef.reload()`
- [x] T007 [P] [US1] 更新 `LoginView.vue` 文案（如副标题），去掉暗示「仅能登录、不能注册」的表述

**Checkpoint**: 仅 H5 即可独立验收开户闭环（SC-001）；不依赖小程序改动

---

## Phase 4: User Story 2 - 微信小程序完成注册并进入可用状态 (Priority: P1)

**Goal**: 未绑定微信用户可注册；一次滑块内创建账号并绑定当前微信，成功直接进主流程；半失败保留账号并引导绑定

**Independent Test**: 未绑定微信完成注册 → 直接进主界面且再次打开静默登录；冲突/滑块失败不建号；绑定失败分支无登录态并引导 `wxBind`

### Implementation for User Story 2

- [x] T008 [US2] 在 `server/routes/common/controller.ts` 实现 `wxRegister({ bindTicket, username, password, nickName })`：先校验 ticket/openid 未占用；再走与 `register` 相同创建逻辑（用户名占用、密码强度：≥8 且含小写/大写/数字、昵称空则 username）；再写入 `user_wechats`（`user_id` 与 `openid` 均唯一）；成功返回可登录用户行；**绑定失败保留用户、不抛成删号**
- [x] T009 [US2] 在 `server/routes/common/index.ts` 增加 `POST /wxRegister`：校验用户名 `/^\w{3,20}/`、密码非空、`bindTicket`、调用 `consumeCaptcha` 后调 `wxRegister`；成功用既有 `writeLoginResult` 返回与 `wxBind` 同形（含 `needBind: false`）；半失败 `retCode != 0`、无 token，message 明示账号已创建请去绑定，可选 `data: { accountCreated: true, username }`
- [x] T010 [US2] 在 `server/app.ts` JWT `unless` 增加 `/api/v1/common/wxRegister`（或等价正则），保证未登录可调用
- [x] T011 [P] [US2] 在 `miniapp/miniprogram/apis/index.ts` 新增 `wxRegister`（`bindTicket` + 注册字段 + `captchaId`/`captchaX`，`auth: false`）
- [x] T012 [US2] 改造 `miniapp/miniprogram/pages/bind/index.wxml` / `index.wxss` / `index.json`：支持「绑定已有账号 | 注册新账号」切换；注册态增加昵称选填；去掉「小程序不提供注册」文案
- [x] T013 [US2] 改造 `miniapp/miniprogram/pages/bind/index.ts`：注册态校验与 PC 一致 → 弹窗滑块 → 调 `wxRegister`；成功 `saveSession` + `clearBindTicket` + `openAfterLogin`；半失败（`accountCreated` 或文案识别）切回绑定态、预填用户名、**不** `saveSession`；保留既有 `wxBind` 路径

**Checkpoint**: 小程序开户闭环可独立验收（SC-002）；与 H5 互不阻塞

---

## Phase 5: User Story 3 - 已有账号路径不受影响 (Priority: P2)

**Goal**: H5 登录、小程序绑定/静默登录、PC 注册登录行为与改前一致

**Independent Test**: 用已有账号走 H5 登录、小程序绑定或静默、PC 登录/注册，抽测通过且无功能回退

### Implementation for User Story 3

- [x] T014 [P] [US3] 确认未改动 `frontend/src/components/login/` 下登录/注册逻辑；若有误改则回退
- [x] T015 [US3] 按 `specs/016-mobile-miniapp-register/quickstart.md` 第 4 节回归：H5 登录、小程序 `wxBind`、已绑定 `wxLogin` 无滑块/无注册强推、PC 注册登录+滑块

**Checkpoint**: 回归通过（SC-004）

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 手册与宪章对齐；端到端验收

- [x] T016 [P] 更新 `docs/用户手册.md`：第 4/11/12 章与能力对照表改为三端可注册；写明小程序注册即绑定及半失败引导；删除「仅 PC 可注册」「小程序/H5 不能注册」等过时句（FR-010 / SC-005）
- [x] T017 [P] 修订 `.specify/memory/constitution.md`：承认 `mobile-h5/` 与 `/mobile/`；允许小程序注册即绑定；保留一微信一账号、不解绑；按治理规则 bump 版本并写 SYNC IMPACT REPORT（FR-011 / SC-006）
- [x] T018 按 `specs/016-mobile-miniapp-register/quickstart.md` 完整跑通第 1–2、5 节（含文档验收）；半失败第 3 节能模拟则验，否则代码评审确认绑定失败不发 JWT、不删用户

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup** → 无依赖
- **Phase 2 Foundational** → 依赖 Setup；**阻塞**所有用户故事编码
- **Phase 3 US1** 与 **Phase 4 US2** → 依赖 Foundational；二者可并行（不同目录：`mobile-h5/` vs `server`+`miniapp/`）
- **Phase 5 US3** → 建议在 US1/US2 主要改动合并后做回归
- **Phase 6 Polish** → 依赖计划交付的故事完成（至少 US1+US2）；T016/T017 可与实现末期并行起草

### User Story Dependencies

- **US1 (P1)**：仅依赖既有 `POST /common/register` + captcha；不依赖 `wxRegister`
- **US2 (P1)**：依赖本故事内 T008–T010 后端就绪后再接小程序 UI；不依赖 H5 改动
- **US3 (P2)**：验证既有路径；依赖 US1/US2 不破坏既有接口语义

### Within Each User Story

- US1：API 封装 → UI 模式 → 提交/滑块/成功回登录 → 文案
- US2：controller → route/unless → 小程序 API → 页面结构 → 页面逻辑
- US3：确认 PC 未改 → quickstart 回归

### Parallel Opportunities

- T003 可与 T002 并行阅读
- T004 与后续 UI 可先并行写 API
- Foundational 完成后：**Developer A** 做 US1（T004–T007），**Developer B** 做 US2（T008–T013）
- T016 与 T017 可并行改文档
- T014 可在实现中随时自查

---

## Parallel Example: User Story 1

```bash
# API 与文案可并行启动（不同关注点）：
Task: "T004 在 mobile-h5/src/api/common.ts 新增 register"
Task: "T007 更新 LoginView.vue 文案"

# 然后串行完成表单与提交：
Task: "T005 LoginView 注册态 UI"
Task: "T006 滑块 + register 提交与回登录"
```

## Parallel Example: User Story 2

```bash
# 后端就绪后，API 封装与 wxml 结构可并行：
Task: "T011 miniapp/miniprogram/apis/index.ts 新增 wxRegister"
Task: "T012 pages/bind 双态 UI 与文案"

# 再接线逻辑：
Task: "T013 pages/bind/index.ts 成功/半失败处理"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 + Phase 2  
2. Phase 3 US1（H5 注册）  
3. **STOP**：按 Independent Test / quickstart §1 验收  
4. 可先演示手机浏览器开户，再开小程序

### Incremental Delivery

1. Setup + Foundational  
2. US1 H5 注册 → 验收  
3. US2 `wxRegister` + 小程序 UI → 验收  
4. US3 回归  
5. Polish：手册 + 宪章 + quickstart 全文

### Parallel Team Strategy

1. 共同完成 Phase 1–2  
2. A：`mobile-h5` US1；B：`server` + `miniapp` US2  
3. 合并后一起做 US3 回归与 Polish 文档

---

## Notes

- 不新增自动化测试任务（规格未要求）
- 禁止修改归档 `specs/001`–`015` 正文
- `wxRegister` 成功响应必须与 `wxBind` 登录结果同形，便于复用 `saveSession`
- 半失败默认策略：保留账号、不发 JWT、引导 `wxBind`（澄清选项 B）
- 格式校验：全部任务均为 checklist 项且含路径或明确文档路径
