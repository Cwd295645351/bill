# API Contracts: 014-profile-bill-members

Base: `/api/v1`，需登录（Bearer + 服务端注入 userid），除非注明。

## PUT `/common/profile`

更新当前登录用户昵称。

**Request**

```json
{ "nickName": "新昵称" }
```

**Success** `retCode: 0` — USER_ATTRS；`avatarUrl` 为可展示的签名查看 URL（或空）。

副作用：所有 `bill_users` 中该 `user_id` 的 `user_name` 同步为新昵称。

## PUT `/common/password`

修改登录密码。

**Request**

```json
{ "oldPassword": "<RSA密文>", "newPassword": "<RSA密文>" }
```

**Success** `retCode: 0`

```json
{ "requireRelogin": true }
```

副作用：清除服务端 session（与 logout 一致）；客户端须清本地会话并跳转登录。

**Errors**: 旧密码错误；新密码强度不合规（≥8，含大小写与数字）；未登录。

## POST `/common/avatar`

上传头像（multipart/form-data，字段名 `file`）。

**Success** `retCode: 0` — USER_ATTRS（含新 `avatarUrl` 签名 URL）。

**Errors**: 非图片 / 超过 10MB / OSS 失败。

## GET `/common/avatar/file`

按签名打开头像字节（可不带登录头，供 img/CSS 直接访问）。

Query: `userId`, `exp`, `sig`。

成功：`Content-Type` 为图片类型，body 为字节。失败：403。

## POST `/bill/quit`（加固既有）

**Request**

```json
{ "id": "<billId>", "userId": "<targetUserId>" }
```

### 退出（`userId` === 当前用户）

- 成功：解除自己与账本关系。
- 错误：创建者不能退出；未加入；账本不存在。

### 移除（`userId` !== 当前用户）

- 仅当当前用户为该账本 `creator`。
- 禁止移除创建者；禁止目标不在账本中。
- 成功：解除目标与账本关系。

**兼容说明**：仍接受既有 body 字段；实现改为按 `userId`+`billId` 匹配成员行，不再依赖请求头昵称与目标 `user_name` 一致。
