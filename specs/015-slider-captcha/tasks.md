# Tasks: 登录注册滑块校验

**Input**: Design documents from `/specs/015-slider-captcha/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行
- **[USn]**: 对应用户故事

## Phase 1: Setup

- [x] T001 创建 `specs/015-slider-captcha/` 工作集（spec/plan/research/data-model/contracts/checklist/tasks/quickstart）

## Phase 2: Foundational

- [x] T002 实现 `server/utils/captcha.ts`（SVG 出题 + Redis 读写/一次性消费）
- [x] T003 [P] `ApiInput` 增加 `captchaId` / `captchaX`；`GET /common/captcha` 路由
- [x] T004 JWT `unless` 放行 `/api/v1/common/captcha$`；确认 dist 同步

## Phase 3: User Story 1–2 - 服务端强制校验 (P1) 🎯 MVP

- [x] T005 [US2] `login` / `register` 调用 `consumeCaptcha`，fail closed
- [x] T006 [US4] `wxBind` 同样调用；`wxLogin` 不调用

## Phase 4: User Story 2 - PC UI (P1)

- [x] T007 [P] [US2] `SliderCaptcha.vue` + `fetchCaptcha` API
- [x] T008 [US2] `Login.vue` / `use-login.ts` 提交携带字段；失败刷新题目
- [x] T009 [P] axios `EXCLUDE_URL` 加入 `/captcha`

## Phase 5: User Story 3 - H5 UI (P1)

- [x] T010 [P] [US3] H5 `SliderCaptcha.vue` + `LoginView` 接线

## Phase 6: User Story 4 - 小程序绑定 UI (P1)

- [x] T011 [P] [US4] `components/slider-captcha` + bind 页接线

## Phase 7: Polish

- [x] T012 规格文档对齐 014 结构与中文表述（本任务）
- [ ] T013 手工按 quickstart 回归（拉题公开、三端、一次性、静默无滑块）

## Dependencies & Execution Order

### Phase Dependencies

- Phase 2 阻塞一切 UI。  
- Phase 3 可与 Phase 4–6 前端并行（契约已定）。

### User Story Dependencies

- US1（拉题）为 US2–4 前提。  
- US2 / US3 / US4 可并行接 UI。

## Implementation Strategy

### MVP First

服务端 captcha + login 强制校验 + PC 登录页。

### Incremental Delivery

注册 → H5 → 小程序绑定 → 鉴权放行与 EXCLUDE 防误伤。

## Notes

- 任务勾选反映当前仓库已实现状态；T013 由 Wade 在目标环境重启后端后验收。
