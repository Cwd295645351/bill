# Implementation Plan: 移动端与小程序注册

**Branch**: `016-mobile-miniapp-register` | **Date**: 2026-11-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-mobile-miniapp-register/spec.md`

## Summary

在现行 **mobile-h5** 与 **微信小程序** 增加与 PC 同规则的账号注册。H5 复用既有 `POST /api/v1/common/register`，登录页增加注册态，成功后回登录再登。小程序新增 `POST /api/v1/common/wxRegister`：一次滑块校验内完成「创建账号 + 绑定当前微信」；成功直接登录进主流程；账号已建但绑定失败则保留账号、不发登录态，引导走既有 `wxBind`。同步修订用户手册与宪章中「不可注册 / 否定 H5」的过时表述。PC 注册登录行为不变；不改归档 `specs/001`–`015`。

## Technical Context

**Language/Version**: TypeScript（server Koa 2 + mobile-h5 Vue 3 + miniapp 原生）  
**Primary Dependencies**: 现有 `server/`、`mobile-h5/`、`miniapp/`；复用 `register`、`wxBind`、`consumeCaptcha`、RSA 密码加密、滑块组件  
**Storage**: 既有 `users` / `user_wechats`；`bindTicket` 与 captcha 仍在 Redis；无新表  
**Testing**: 手工验收（见 [quickstart.md](./quickstart.md)）；对照 contracts 与回归 PC/H5 登录、小程序绑定/静默登录  
**Target Platform**: API + mobile-h5 `/mobile/` + 微信小程序；PC `/pc/` 仅回归、不改功能  
**Project Type**: monorepo（web + H5 + miniapp + API）  
**Performance Goals**: 与现网注册/绑定同级；用户 3 分钟内走通开户（规格 SC-001/002）  
**Constraints**: 一账号一微信；不引入手机号一键注册；不改归档规格；滑块 fail closed；宪章/手册本交付内对齐  
**Scale/Scope**: common 路由增量接口 + H5 登录页注册态 + 小程序绑定页注册态 + 文档两处

## Constitution Check

*GATE: 对照当前 `.specify/memory/constitution.md`（v2.1.0）与本规格已确认的修订义务。*

| 原则 | 判定 | 说明 |
|------|------|------|
| I 存量优先 | 通过 | 新目录 `specs/016-*`；增量行为；禁止改 001–015 |
| II 多端边界 | **有意修订** | 现行宪章写「不存在 Mobile / 小程序不支持注册」，与手册及 011/015 已交付的 H5 冲突；本交付按 FR-011 **同步修订宪章**，承认 `mobile-h5/` + `/mobile/`，并允许小程序注册 |
| III 账本隔离与权限 | **有意修订** | 「不提供小程序内注册」改为允许注册即绑定；一微信一账号、不解绑等不变 |
| IV 契约兼容 | 通过 | 新增可选公开接口 `wxRegister`；既有 `register`/`wxBind`/`wxLogin`/`login` 形状不删字段 |
| V 密钥与部署 | 通过 | 不新增密钥种类；小程序仍只打 `/api` |

**Gate**：在「本迭代包含宪章修订任务」前提下通过。未完成宪章修订不得宣称交付完成（SC-006）。

### Post-Design Re-check

设计选定：H5 复用 `register`；小程序用 `wxRegister` 服务端编排注册+绑定（见 research）。不新增平行技术栈、不恢复旧 `mobile/` 目录。与修订后宪章预期一致。Gate 仍通过。

## Project Structure

### Documentation (this feature)

```text
specs/016-mobile-miniapp-register/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/register-api.md
├── checklists/requirements.md
└── tasks.md                 # /speckit-tasks 生成，本命令不创建
```

### Source Code (repository root)

```text
server/
├── routes/common/index.ts          # 新增 POST /wxRegister；JWT unless 放行
├── routes/common/controller.ts     # wxRegister：register 逻辑 + bind 逻辑编排
└── app.ts                          # unless 名单含 wxRegister（若按路径过滤）

mobile-h5/
├── src/api/common.ts               # register API
├── src/views/login/LoginView.vue   # 登录/注册切换；注册成功回登录
└── src/components/SliderCaptcha.vue # 复用

miniapp/
└── miniprogram/
    ├── apis/index.ts               # wxRegister
    ├── pages/bind/index.{ts,wxml,wxss,json}  # 绑定/注册双态；文案更新
    └── components/slider-captcha/  # 复用

docs/用户手册.md                    # 三端可注册、小程序注册即绑定
.specify/memory/constitution.md     # 对齐 H5 + 小程序注册（版本 bump）
```

**Structure Decision**: 不改 `frontend/` 功能；不碰旧 `mobile/`；能力落在既有 `mobile-h5/` 与 `miniapp/` 及 `server/routes/common`。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 实现期间相对宪章 v2.1.0「小程序禁止注册 / 无 Mobile」 | 规格 FR-011 与产品现实（手册已有 H5）要求本交付修订宪章 | 只改客户端不改宪章 → Constitution Check 永久红灯，且与手册继续打架 |
| 新增 `wxRegister` 而非纯客户端串调 `register`+`wxBind` | 滑块一次性消费；串调需两次滑块，体验差且半失败语义分散 | 客户端两次提交违反「一次验证完成注册即绑定」的验收预期 |

## Design

### H5

- 登录页增加「注册账号」入口与注册字段（用户名、昵称选填、密码），规则对齐 PC / 手册 4.1。
- 提交 → 弹窗滑块 → `POST /common/register`（含 `captchaId`/`captchaX`）。
- 成功：提示「注册成功，请登录」，切回登录态并清空密码；**不**写 session。
- 失败：可读错误 + 滑块刷新。

### 小程序

- 未绑定页保留「绑定已有账号」，增加「注册新账号」切换。
- 注册提交 → 弹窗滑块 → `POST /common/wxRegister`（`bindTicket` + 注册字段 + captcha）。
- 成功：`saveSession` + `clearBindTicket` + 进主流程（与绑定成功相同）。
- 账号已建绑定失败：提示绑定未完成，切回/停留在绑定表单并预填用户名（若安全），引导 `wxBind`；不写登录 session。
- 已绑定用户仍静默 `wxLogin`，无注册入口强推。

### 后端 `wxRegister`

1. 校验 `bindTicket`、用户名规范、密码非空、滑块。  
2. 调用与 `register` 相同的创建逻辑。  
3. 创建失败 → 错误，无绑定。  
4. 创建成功 → 用 ticket 对应 openid 写入 `user_wechats`（规则同 `wxBind`：openid/user 唯一）。  
5. 绑定成功 → 消费 ticket + 返回与 `wxBind` 相同的登录结果。  
6. 绑定失败 → **保留用户**，返回明确错误（契约约定文案/标志），**不**发 JWT。

### 文档

- 手册：第 4/11/12 章与能力表改为三端可注册；小程序写明注册即绑定与半失败引导。  
- 宪章：承认 `mobile-h5`；删除「小程序不支持注册」；版本按治理规则 bump。

## Out of Scope

- PC 注册 UI/逻辑改造  
- 微信手机号一键注册、OAuth、忘记密码、解绑换绑  
- 重新定义滑块本身  
- 修改归档 specs 001–015  
- 旧目录 `mobile/` 恢复  
