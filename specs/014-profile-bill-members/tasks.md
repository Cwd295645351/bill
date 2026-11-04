# Tasks: 个人信息与账本成员进出

**Input**: Design documents from `/specs/014-profile-bill-members/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 手工验证（未要求自动化测试）

**Organization**: 按用户故事分组

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行
- **[Story]**: US1 / US2 / US3

## Phase 1: Setup

- [x] T001 确认 `specs/014-profile-bill-members/` 与 `.specify/feature.json` 指向本功能

## Phase 2: Foundational

- [x] T002 加固 `server/routes/bill/controller.ts` 中 `quitBill`：按 `billId+userId` 删除；创建者拒绝退出
- [x] T003 加固 `server/routes/bill/controller.ts` 中 `removePerson`：校验操作者为创建者；禁止移除创建者/自己；按 `billId+userId` 删除
- [x] T004 更新 `server/routes/bill/index.ts` `/quit`：传入 `operatorId`；移除路径不再用请求头昵称匹配目标

## Phase 3: User Story 1 - 修改昵称 (P1) MVP

**Goal**: 用户可改昵称，会话与账本成员显示名同步

**Independent Test**: 改昵称后刷新仍显示新名，且仍可进入原账本

- [x] T005 [US1] 在 `server/routes/common/controller.ts` 实现 `updateProfile`（nickName trim 后 1～20，`^[\u4E00-\u9FA5A-Za-z0-9_]+$`；更新 users；同步全部 bill_users.user_name；返回 USER_ATTRS）
- [x] T006 [US1] 在 `server/routes/common/index.ts` 增加 `PUT /profile`
- [x] T007 [P] [US1] `frontend/src/utils/common-info/index.ts` 增加写回/合并 userInfo 的辅助方法
- [x] T008 [US1] `frontend/src/components/layout/api.ts` 增加 updateProfile；`use-layout.ts` + `Layout.vue` 增加「修改个人信息」弹窗与提交后刷新展示
- [x] T009 [P] [US1] `miniapp/miniprogram/apis/index.ts` 增加 updateProfile；`pages/mine` 增加改昵称并写回 storage

## Phase 4: User Story 2 - 非创建者退出账本 (P1)

**Goal**: 非创建者可退出；创建者不可退出

**Independent Test**: 加入者退出后列表无该账本；创建者无退出入口

- [x] T010 [US2] `frontend/src/views/bill/api.ts` 增加 quitBill；`use-bill.ts` + `Bill.vue` 非创建者退出确认与刷新列表
- [x] T011 [P] [US2] `miniapp/miniprogram/apis/index.ts` + `pages/bills` 非创建者退出

## Phase 5: User Story 3 - 创建者移除成员 (P1)

**Goal**: 创建者可移除其他成员

**Independent Test**: 移除后对方进不了账本；不能移除自己/创建者

- [x] T012 [US3] PC `Bill.vue` / `use-bill.ts`：创建者「成员」弹窗（拉详情 users），移除确认调用 quit API（target≠自己）

## Phase 6: Polish

- [x] T013 更新 `docs/用户手册.md`：个人信息可改昵称；退出账本；移除成员；权限表
- [x] T014 自检：类型/权限边界；确认未改归档 specs 001–013 与无关 package.json/.gitignore

## Dependencies

- T001 → T002/T003/T004 → T005/T006 → T007/T008/T009
- T004 → T010/T011/T012
- 全部故事 → T013 → T014

## Parallel Opportunities

- T002 与 T003（同文件则串行，逻辑上可一次改完）
- T007 与 T009；T010 与 T011

## Phase 7: Extension - 改密 / 头像 / H5 (P1)

**Goal**: 三端支持改密与头像；昵称保留同一入口体验

- [x] T015 [US1] `server/database/services/avatarService.ts`：OSS 上传 avatars/、签名查看、按 userId 取文件
- [x] T016 [US1] `controller`：`changePassword`（旧密校验 + genPassword + 强度）；`uploadAvatar`；登录/资料响应富化 avatarUrl
- [x] T017 [US1] `routes/common`：`PUT /password`、`POST /avatar`、`GET /avatar/file`；改密成功清 session
- [x] T018 [US1] PC Layout：个人信息弹窗支持头像选择上传 + 改密；成功刷新/踢登录
- [x] T019 [P] [US1] 小程序 mine：头像选择上传 + 改密（RSA）+ 昵称同一入口体验
- [x] T020 [P] [US1] mobile-h5 MineView：昵称/头像/改密入口与会话刷新（宪章例外按用户要求）
- [x] T021 更新 `docs/用户手册.md` 三端个人信息说明
- [x] T022 自检类型与边界；确认未改 001–013 与无关 package.json/.gitignore

## MVP

T001–T009（改昵称端到端）即可演示；随后接退出与移除；扩展 T015–T022 完成改密/头像/H5。

## Phase 8: UX - 资料/改密分 Tab + 默认头像 (t54u)

- [x] T023 PC `Layout.vue` + `hooks/use-layout.ts`：el-tabs 分「个人资料」「修改密码」各自保存；无头像用 UserFilled
- [x] T024 [P] mobile-h5 `MineView.vue`：van-tabs 两段保存 + user-o 默认头像
- [x] T025 [P] 小程序 `pages/mine`：van-tabs 两段保存 + user-o 默认头像
- [x] T026 014 research 记一笔；未改 001–013 / 无关 package.json/.gitignore


## Phase 9: 账本退出/移除三端对齐 (t56u)

- [x] T027 更新 014 spec：FR-008 / US2–US3 明确 PC+小程序+H5 均需退出与移除 UI
- [x] T028 [US2] mobile-h5 `BillsView`：非创建者左滑退出（复用 `POST /bill/quit`）
- [x] T029 [US3] mobile-h5 `BillDetailView`：创建者「成员」弹层移除
- [x] T030 [US3] 小程序 `pages/bill-detail`：创建者「成员」弹层移除（列表退出已有）
- [x] T031 更新用户手册权限表与 5.6/5.7；未改 001–013 / 无关 package.json/.gitignore
