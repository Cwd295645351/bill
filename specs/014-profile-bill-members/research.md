# Research: 014-profile-bill-members

## Decision: 个人信息本迭代只改昵称

- **Rationale**: `users` 已有 `nick_name` / `avatar_url`；手册写明无改昵称页；无头像上传流水线（OSS 仅用于记账照片）；改密需旧密码 + RSA，风险与范围更大。  
- **Alternatives**: 同时改密/头像 URL — 推迟到后续规格。

## Decision: 改昵称必须同步 `bill_users.user_name`

- **Rationale**: 现有大量接口用 `header.nickName` + `userId` 联合匹配 `bill_users`；只改 `users` 会导致「找不到账本」。  
- **Alternatives**: 仅按 userId 匹配并逐步去掉 userName 条件 — 本迭代在 quit/remove 路径先改为按 userId；profile 仍同步 userName，降低历史接口风险。

## Decision: 复用 `POST /bill/quit` 并加固，而非新路径

- **Rationale**: 宪章 IV 兼容；前端/潜在调用方可共用；现有路由已区分「自己=退出 / 他人=移除」，缺的是创建者校验与按 userId 删除。  
- **Alternatives**: `DELETE /bill/members/:id` — 更 REST，但多一条破坏面，本迭代不取。

## Decision: 小程序接改昵称+退出，移除成员仅 PC

- **Rationale**: 用户要求「已有入口一并接上」；mine/bills 已有；无成员管理页。API 仍对全端生效。

## Decision: 不碰 mobile-h5

- **Rationale**: 宪章 II。


## 扩展研究：改密 / 头像 / H5（t50u）

### Decision: 头像复用记账图片 OSS 方案
- 私有桶上传；`users.avatar_url` 存 objectKey（`avatars/{userId}/...`）。
- 登录/资料响应通过 HMAC 签名 URL（`GET /common/avatar/file`）下发，TTL 7 天；JWT unless 放行该路径。
- 不新建表；不改 avatar_url 列类型（STRING 512 足够存 key）。

### Decision: 改密后踢登录
- 与 `POST /logout` 一致清空 `ctx.session`；返回 `requireRelogin: true`；三端清本地会话并跳登录。
- 旧/新密码均为 RSA 密文；服务端 `genPassword` 哈希比对与写入。

### Decision: 宪章 vs 用户（mobile-h5）
- 宪章 II / 部署条款：不得把新功能放进 mobile-h5、不得恢复 H5。
- 用户 t50u：个人信息（昵称/改密/头像）三端都要，含 mobile-h5。
- **处理**：以用户产品指令为准，在既有 `mobile-h5/` 落地本功能；在 plan Constitution Check 记录例外；不新开 015；不改归档 001–013。


## UX 微调（t54u）：资料/改密分 Tab + 默认头像

### Decision: 个人信息弹窗拆成两个 Tab，各自保存
- **个人资料** Tab：头像 + 昵称；仅「保存资料」提交（头像选图可先预览，保存时再上传）。
- **修改密码** Tab：旧/新/确认；仅「保存密码」提交；成功后仍踢登录。
- **Rationale**: 避免一次改密误触资料字段、或改昵称时被密码校验挡住；三端（PC el-tabs / H5 van-tabs / 小程序 van-tabs）对齐。

### Decision: 无头像时用默认 icon 占位
- PC：Element Plus `UserFilled`（右上角、菜单、弹窗预览）。
- H5 / 小程序：Vant `user-o`。
- 不留空白占位，避免预览区 0×0 或灰块无内容。


## 账本退出/移除三端 UI（t56u）

### Decision: 复用 `POST /bill/quit`，三端补齐 UI
- 已有服务端权限：非创建者退出；创建者移除；禁自己/创建者/非创建者移除。
- **PC**：账本卡片退出 + 成员弹窗（已有）。
- **小程序**：账本列表左滑退出（已有）；明细页「成员」弹层移除（本迭代补）。
- **H5**：账本列表左滑退出 + 明细页「成员」弹层移除（本迭代补）。
- 不新开 015；不改归档 001–013。
