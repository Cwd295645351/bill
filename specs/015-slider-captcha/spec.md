# Feature Specification: 登录注册滑块校验

**Feature Branch**: `015-slider-captcha`

**Created**: 2026-11-04

**Status**: Accepted

**Input**: User description: "当前登录和注册有点简单，需要增加滑块校验"; 用户确认三端都要做（PC 登录+注册、H5 登录、小程序 wxBind）。

## Background

账号密码登录、注册与小程序首次绑定目前无图形人机校验，易被脚本撞库或批量注册。本规格增加**自建拼图滑块**：服务端 Redis 一次性校验，客户端三端展示滑块；**不引入**第三方验证码 SaaS。静默微信登录（`wxLogin`）不涉及密码提交，不要求滑块。

## User Scenarios & Testing *(mandatory)*

范围：**后端 API + PC 登录/注册 + mobile-h5 登录 + 微信小程序绑定页**。H5 仍无注册入口（011 已定）。禁止修改已归档 `specs/001`–`014` 正文。

### User Story 1 - 获取并完成滑块题目 (Priority: P1)

未登录用户在点击登录、注册或绑定提交后，以弹窗展示滑块拼图（页面默认不展示滑块）；拖动拼图块对齐缺口（前端按 targetX/tolerance 即时判定，错位则失败并刷新）后，客户端持有本次校验所需的题目标识与滑动位置并继续提交。超时、失败或用户主动刷新时可重新拉取。

**Why this priority**: 没有可用题目，后续登录/注册/绑定无法通过服务端校验。

**Independent Test**: 点击登录/注册/绑定后弹窗出现滑块图与轨道；刷新按钮可换新题；错位不显示成功且会刷新。

**Acceptance Scenarios**:

1. **Given** 用户在 PC 登录/注册页、H5 登录页或小程序绑定页填好表单，**When** 点击提交，**Then** 弹窗出现背景图、可拖动拼图块与提示文案；提交前页面上默认不展示滑块。
2. **Given** 当前题目仍有效，**When** 用户点刷新，**Then** 换新题，旧题不可再用于提交。
3. **Given** 题目已过期（超过服务端约定时效），**When** 用户仍用旧题提交业务，**Then** 业务失败并提示需重新完成滑块。

---

### User Story 2 - PC 登录与注册须过滑块 (Priority: P1)

PC 端登录、注册在提交账号密码（及注册昵称）时，必须附带本次滑块结果。未完成、错位或服务端判定失败时，不得发放登录凭证，也不得创建新用户。

**Why this priority**: 用户明确要求登录与注册增加滑块；PC 是唯一注册入口。

**Independent Test**: 不拖滑块直接登录/注册被拒；正确拖动后可用合法账号完成原有流程。

**Acceptance Scenarios**:

1. **Given** 用户点登录或注册，**When** 弹窗出现后未对准缺口或关闭弹窗，**Then** 不会完成业务提交；服务端即使被直调缺字段也会拒绝。
2. **Given** 用户完成滑块且账号密码正确，**When** 登录，**Then** 与改造前一样进入账本相关页。
3. **Given** 用户完成滑块且注册信息合法，**When** 注册，**Then** 注册成功并可再登录。
4. **Given** 滑块位置偏差过大或 captcha 字段缺失，**When** 提交，**Then** 返回明确错误，不产生 JWT、不新建用户。

---

### User Story 3 - H5 登录须过滑块 (Priority: P1)

mobile-h5 登录页与 PC 共用同一套滑块与业务校验；H5 仍不提供注册。

**Why this priority**: 用户要求三端都要做；H5 登录同样可被脚本调用。

**Independent Test**: `/mobile/` 登录页完成滑块后可用账号密码登录；省略滑块失败。

**Acceptance Scenarios**:

1. **Given** H5 登录页，**When** 未完成滑块提交，**Then** 失败提示。
2. **Given** 完成滑块且账号密码正确，**When** 登录，**Then** 进入账本列表等既有主流程。

---

### User Story 4 - 小程序绑定须过滑块 (Priority: P1)

小程序首次绑定已有账号（`wxBind`）提交用户名与密码时须完成滑块。已绑定用户的静默登录不要求滑块。

**Why this priority**: 绑定路径含密码，与登录同类风险。

**Independent Test**: 绑定页完成滑块后绑定成功；静默进入已绑定账号无滑块。

**Acceptance Scenarios**:

1. **Given** 用户在绑定页，**When** 未完成滑块点绑定，**Then** 被拒绝。
2. **Given** 完成滑块且账号密码与绑定凭证有效，**When** 绑定，**Then** 绑定成功并进入小程序主流程。
3. **Given** 用户已绑定且走静默登录，**When** 打开小程序，**Then** 不出现滑块。

---

### Edge Cases

- 同一题目标识只能成功/失败消费一次；重复提交必须失败。
- 题目时效建议约 2 分钟；过期后须重新获取。
- 允许小范围像素误差（拼图对齐），超出则失败。
- 获取滑块接口必须对未登录用户开放；不得因 JWT 鉴权导致登录页无法拉题。
- 密码仍走既有 RSA 密文；滑块不替代密码强度与账号校验。
- 业务失败（密码错误等）后应刷新滑块，避免复用已消费题目。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 提供未登录可访问的获取滑块题目接口，返回渲染所需数据（题目标识、背景、拼图、纵向位置与尺寸等）及有效期说明。
- **FR-002**: 系统 MUST 将正确答案存入 Redis（或等价短时存储），设置有限 TTL；校验时一次性删除，成功与失败均不得二次使用。
- **FR-003**: `POST /common/login`、`POST /common/register`、`POST /common/wxBind` MUST 校验请求中的题目标识与滑动位置；缺失、过期或偏差过大时 MUST 拒绝业务（fail closed）。
- **FR-004**: 滑块结果 MUST 以服务端校验为准；仅前端禁用按钮不算符合本规格。
- **FR-005**: `POST /common/wxLogin`（静默）MUST NOT 要求滑块。
- **FR-006**: PC 登录与注册、H5 登录、小程序绑定 MUST 在用户点击提交后以弹窗展示可操作滑块（默认不内嵌在表单中），对准后附带校验字段再请求业务接口；前端 MUST 按接口返回的 targetX/tolerance 判定成功，错位则失败并刷新题目。
- **FR-007**: 获取滑块接口 MUST 加入与 `login_config` / `login` 同类的鉴权放行名单，避免未登录拉题失败。

### Key Entities

- **滑块题目**: 一次性挑战，含标识、拼图几何答案、过期时间。
- **用户会话**: 登录成功后的既有 JWT/session；本规格不改变令牌语义。
- **绑定凭证**: 小程序既有 `bindTicket`；与滑块独立，二者均须在绑定时有效。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 三端在正确完成滑块后，原有登录/注册/绑定成功率与改造前一致（合法账号场景）。
- **SC-002**: 省略或伪造滑块字段时，抽测 login/register/wxBind 均返回错误且无 JWT、无新用户。
- **SC-003**: 同一题目标识第二次提交业务接口 100% 失败。
- **SC-004**: 未登录状态下获取滑块接口可在数秒内返回题目（常规网络），不出现「请重新登录」类鉴权误伤。

## Assumptions

- Redis 与现网 session 共用实例可用。
- 不引入 sharp/canvas 等原生图像库；可用 SVG 等轻量方式生成题目。
- 不引入 GeeTest / Turnstile 等第三方 SaaS（除非后续产品另行决策）。
- H5 无注册入口保持 011 结论。

## Out of Scope

- 静默 `wxLogin`、改密、忘记密码重置。
- 登录失败次数锁定 / IP 限流（可后续另开规格）。
- 修改已归档 `specs/001`–`014`。
