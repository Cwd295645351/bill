# Research: 016-mobile-miniapp-register

## 1. 小程序「注册即绑定」的接口形态

**Decision**: 新增服务端 `POST /api/v1/common/wxRegister`，在一次请求内完成滑块校验 → 创建用户 → 绑定当前 `bindTicket` 对应 openid；成功返回与 `wxBind` 同形的登录结果。

**Rationale**:
- 现网 `consumeCaptcha` 一次性消费；若客户端先 `register` 再 `wxBind`，用户必须过两次滑块，违背「3 分钟内一次走通」体验。
- 规格要求成功路径「无需再输密码绑一次」；服务端编排可保证成功时直接发 JWT。
- 规格半失败策略（账号保留、引导绑定）可由接口在「注册成功 / 绑定失败」分支返回明确错误且不发登录态，客户端切回绑定表单。

**Alternatives considered**:
- 客户端串调 `register` + `wxBind`：实现简单，但双滑块与错误态分散，拒绝。
- 扩展 `wxBind` 在「用户不存在时自动注册」：语义混杂，破坏「绑定已有账号」契约，拒绝。
- 仅 `register` 后自动调无密码的内部 bind：仍需两次公开调用或隐藏第二步，不如单一公开契约清晰。

## 2. H5 注册是否新接口

**Decision**: H5 只调用既有 `POST /common/register`；UI 增加注册态，成功后回登录（与 PC 一致）。

**Rationale**: H5 无微信绑定；规格明确注册后不自动登录。现有 register + captcha 已满足。

**Alternatives considered**:
- H5 注册成功自动 login：被 clarify 否决（选项 A：回登录）。
- 为 H5 单独造 registerH5：无必要，拒绝。

## 3. 绑定失败半成功的用户可见策略

**Decision**: `wxRegister` 在用户行已插入但 `user_wechats` 写入失败时：不回滚用户；响应 `retCode != 0`，文案明示「账号已创建但绑定失败，请使用该账号完成绑定」；不返回 accessToken；客户端切到绑定态并尽量保留用户名。

**Rationale**: 对齐 clarify 选项 B；复用现成 `wxBind` 闭环，避免复杂补偿删除。

**Alternatives considered**:
- 事务回滚删除用户：实现成本高，且用户名占用窗口难处理，clarify 已否决。
- 静默重试绑定：增加不确定性，clarify 未选。

## 4. 密码与字段规则来源

**Decision**: 用户名 `/^\w{3,20}/`（与现 `register`/`wxBind` 路由一致）、昵称选填（空则用用户名）、密码 RSA 密文 + 服务端解密后强度（≥8 且含大小写与数字），与 PC 一致；确认密码字段若 PC 有则 H5/小程序对齐，否则不加。

**Rationale**: 规格要求字段规则与 PC/手册一致；避免三端校验漂移。

**Alternatives considered**:
- 放宽小程序密码：削弱安全且与手册冲突，拒绝。

## 5. 鉴权放行

**Decision**: `wxRegister` 与 `register`/`wxBind`/`login`/`captcha` 一样加入 JWT `unless`（及各端免登录请求名单）；`wxLogin` 仍不要求滑块。

**Rationale**: 未登录用户必须能开户；静默登录路径不变（FR-006）。

## 6. 文档与宪章

**Decision**: 本交付修改 `docs/用户手册.md` 与 `.specify/memory/constitution.md`（版本 bump，SYNC IMPACT REPORT），删除「仅 PC 注册」「小程序/H5 不能注册」「不存在 Mobile」等与现行产品冲突的条文；承认 `mobile-h5/` 与小程序注册即绑定。

**Rationale**: FR-010/011 与 SC-005/006；否则后续 plan 的 Constitution Check 无法诚实通过。

**Alternatives considered**:
- 只改手册、宪章另开：clarify 否决。

## 7. PC 与回归范围

**Decision**: 不改 `frontend/` 登录注册代码；手工回归 PC 注册/登录与滑块，确认无回归。

**Rationale**: FR-008；降低变更面。
