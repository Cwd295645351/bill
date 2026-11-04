# Implementation Plan: 个人信息与账本成员进出

**Branch**: `014-profile-bill-members` | **Date**: 2026-11-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-profile-bill-members/spec.md`

## Summary

补齐能力：① 个人信息（昵称 + 改密 + 头像），三端 PC / 小程序 / mobile-h5；② 非创建者退出账本；③ 创建者移除其他成员。复用并加固 `POST /api/v1/bill/quit`；`PUT /common/profile`（昵称）；新增 `PUT /common/password`、`POST /common/avatar`、`GET /common/avatar/file`。头像复用 ali-oss 私有桶与 HMAC 签名查看（与记账图片同模式，前缀 avatars/）。改密成功清 session。小程序不做成员管理页。

## Technical Context

**Language/Version**: TypeScript（server Koa + PC Vue3 + miniapp）  
**Primary Dependencies**: 现有 server/frontend/miniapp 栈  
**Storage**: MySQL `users`、`bill_users`；PC sessionStorage `userInfo`；小程序 storage  
**Testing**: 手工（权限边界 + 改昵称后仍可进账本）  
**Target Platform**: API + PC `/pc/` + 微信小程序 + mobile-h5 `/mobile/`  
**Project Type**: monorepo web + miniapp + H5  
**Constraints**: 不改归档 specs 001–013；不乱动无关 package.json/.gitignore；用户要求三端含 H5（见宪章例外）  
**Scale/Scope**: common/bill 路由与控制器；PC Layout + Bill；miniapp mine + bills；mobile-h5 MineView；用户手册

## Constitution Check

- **I 存量优先**：目录 `specs/014-*` 扩展；行为增量；手册冲突先改手册。  
- **II 多端边界（例外）**：宪章写明不得把新功能放进 mobile-h5 / 不得恢复 H5。用户 t50u 明确要求 PC + 小程序 + mobile-h5。**处理**：以用户产品指令为准，仅在既有 `mobile-h5/` 落地本功能的个人信息入口，不新开平行技术栈、不改归档规格。此例外记入本 plan。  
- **III 账本隔离**：退出/移除只删 `bill_users` 行；不改记账人、不删明细。  
- **IV 契约兼容**：保留 `POST /bill/quit`；扩展 profile；新增 password/avatar 路径；响应字段只增不删。  
- **V 密钥**：复用 OSS_URL_SECRET / passwordSalt / 既有 RSA；不新增密钥种类。  

Gate：在记录宪章 II 例外后通过。

## Project Structure

### Documentation

```text
specs/014-profile-bill-members/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/api.md
├── tasks.md
└── checklists/requirements.md
```

### Source (expected touch)

```text
server/routes/common/index.ts
server/routes/common/controller.ts
server/routes/bill/index.ts
server/routes/bill/controller.ts
frontend/src/components/layout/Layout.vue
frontend/src/components/layout/hooks/use-layout.ts
frontend/src/components/layout/api.ts
frontend/src/views/bill/Bill.vue
frontend/src/views/bill/hooks/use-bill.ts
frontend/src/views/bill/api.ts
frontend/src/utils/common-info/index.ts   # 可选：setUserInfo/patchUserInfo
miniapp/miniprogram/apis/index.ts
miniapp/miniprogram/pages/mine/*
miniapp/miniprogram/pages/bills/*
docs/用户手册.md
mobile-h5/src/views/mine/MineView.vue
mobile-h5/src/api/common.ts
mobile-h5/src/stores/session.ts
server/database/services/avatarService.ts
```

## Design

### Profile（昵称 / 密码 / 头像）

- `PUT /api/v1/common/profile`：`{ nickName }`；同步 bill_users.user_name；返回 USER_ATTRS（avatarUrl 为签名查看 URL）。
- `PUT /api/v1/common/password`：`{ oldPassword, newPassword }`（RSA 密文，同登录）；校验旧密；新密强度同注册；`genPassword` 哈希；成功 `ctx.session=null`，返回 `requireRelogin: true`。
- `POST /api/v1/common/avatar`：multipart `file`；校验类型/10MB；OSS `avatars/{userId}/{uuid}.ext`；`users.avatar_url` 存 objectKey；返回富化 USER_ATTRS。
- `GET /api/v1/common/avatar/file?userId&exp&sig`：HMAC 签名打开头像字节（同记账图片模式，TTL 7 天）。
- 三端同一入口：PC Layout 弹窗；小程序「我的」；H5 MineView。成功改昵称/头像后 patch 本地用户信息；改密后清会话跳登录。

### Quit / Remove（加固现有 quit）

- 继续 `POST /api/v1/bill/quit`，body：`{ id: billId, userId: targetUserId }`。  
- `targetUserId === 当前用户` → `quitBill`：若 `bill.creator === userId` 拒绝「创建者不能退出账本」；否则按 **userId+billId** 删除 `bill_users`（不再强依赖 nickName 匹配，避免改名后无法退出）。  
- `targetUserId !== 当前用户` → `removePerson`：校验操作者是创建者；目标存在于账本；目标不是创建者；禁止操作者==目标走错分支；按 userId+billId 删除。  
- 路由层传入 `operatorId = header.userid`。

### PC UI

- Layout 头像菜单：在「加入账本」旁增加「修改个人信息」。  
- Bill 卡片：非创建者显示退出；创建者增加「成员」入口，弹窗列出 `getBillDetail`/`store.bill.users`，对非创建者显示移除（确认框）。列表页可对当前卡片先 `getBillDetail` 再弹成员。

### Miniapp UI

- bills：非创建者左滑或单元格操作「退出」。  
- mine：改昵称入口。  
- 不做移除成员 UI。

## Out of Scope

改密、头像上传、账本转让/解散新流程、H5、小程序成员管理页、归档规格正文。
