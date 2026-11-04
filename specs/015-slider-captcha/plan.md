# Implementation Plan: 登录注册滑块校验

**Branch**: `015-slider-captcha` | **Date**: 2026-11-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-slider-captcha/spec.md`

## Summary

为 PC 登录/注册、mobile-h5 登录、小程序 `wxBind` 增加自建拼图滑块。新增 `GET /api/v1/common/captcha`；在 `login` / `register` / `wxBind` 请求体增加 `captchaId`、`captchaX` 并由 Redis 一次性校验。JWT unless 放行 captcha；PC axios 将 captcha 列入免刷新名单。不改静默 `wxLogin`。

## Technical Context

**Language/Version**: TypeScript（server Koa + PC Vue3 + mobile-h5 Vue3 + miniapp）  
**Primary Dependencies**: 现有 server / frontend / mobile-h5 / miniapp；`koa-redis` + `uuid`  
**Storage**: Redis key `bill:captcha:{id}`（TTL ~120s）；无新 MySQL 表  
**Testing**: 手工（拉题、错滑、省略字段、成功路径、静默登录无滑块）  
**Target Platform**: API + PC `/pc/` + mobile-h5 `/mobile/` + 微信小程序绑定页  
**Project Type**: monorepo web + H5 + miniapp  
**Constraints**: 不改归档 specs 001–014；不引入验证码 SaaS；不新增原生图像依赖  
**Scale/Scope**: common 路由与 captcha 工具；三端登录/绑定 UI 组件

## Constitution Check

- **I 存量优先**：新目录 `specs/015-*`；增量行为；手册可后续补滑块说明（本迭代以接口与三端 UI 为主）。  
- **II 多端边界**：用户明确三端（含 H5 登录、小程序绑定）；仅在既有工程落地，不新开平行栈。  
- **III 账本隔离**: 不涉及账本数据。  
- **IV 契约兼容**: 新增 captcha 路径；login/register/wxBind **新增必填字段**（破坏性但产品要求 fail closed）；响应字段不删。  
- **V 密钥**: 不新增密钥种类；复用 Redis。  

Gate：通过（契约字段新增已在 spec 标明）。

## Project Structure

### Documentation

```text
specs/015-slider-captcha/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/captcha-api.md
├── tasks.md
└── checklists/requirements.md
```

### Source (expected touch)

```text
server/utils/captcha.ts
server/utils/redis.ts              # 复用 client
server/routes/common/index.ts
server/types/domain.ts             # ApiInput 扩展
server/app.ts                      # JWT unless
frontend/.../login/SliderCaptcha.vue
frontend/.../login/Login.vue
frontend/.../login/hooks/use-login.ts
frontend/.../login/api.ts
frontend/.../api-services/.../axios.ts  # EXCLUDE_URL
mobile-h5/src/components/SliderCaptcha.vue
mobile-h5/src/views/login/LoginView.vue
mobile-h5/src/api/common.ts
miniapp/miniprogram/components/slider-captcha/
miniapp/miniprogram/pages/bind/
miniapp/miniprogram/apis/index.ts
```

## Design

### 题目生成

服务端用 SVG 生成背景（含缺口阴影）与拼图块；缺口横坐标写入 Redis；响应下发 data-URL 图片与 `y`/`width`/`height`/`puzzleSize`。

### 校验

业务接口调用 `consumeCaptcha(captchaId, captchaX)`：缺字段 →「请完成滑块验证」；无 key / 偏差过大 →「滑块验证失败或已过期」；通过后删 key。

### 鉴权放行

`GET /api/v1/common/captcha` 与 `login_config` 一样进入 koa-jwt `unless`；PC 请求拦截 `EXCLUDE_URL` 含 `/captcha`，避免过期会话刷新令牌误伤登录页。

## Out of Scope

第三方 SaaS、静默登录加滑块、登录失败锁定、改归档规格。
