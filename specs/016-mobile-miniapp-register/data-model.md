# Data Model: 016-mobile-miniapp-register

本特性**无新 MySQL 表**；复用既有用户与微信绑定实体及 Redis 票据。

## 实体：用户账号（`users`）

| 字段（逻辑） | 说明 |
|--------------|------|
| id | 主键 |
| username | 唯一登录名；创建时校验 3–20 位 `\w` |
| password | 加盐哈希；明文从不落库；注册时 RSA 解密后做强度校验 |
| nickName | 展示名；空则回落为 username |
| isDel 等 | 既有字段；本特性不改语义 |

**校验（与现网 register 一致）**:
- 用户名已被占用 → 拒绝创建  
- 密码：长度 ≥ 8，且含小写、大写、数字  

## 实体：微信绑定（`user_wechats`）

| 字段（逻辑） | 说明 |
|--------------|------|
| user_id | 唯一：一账号至多绑一个微信 |
| openid | 唯一：一微信至多绑一个账号 |
| unionid | 既有；本特性不新增强制 |

**不变量**: 产品不提供解绑；本特性不得引入一微信多账号。

## Redis：绑定凭证（既有）

| 项 | 说明 |
|----|------|
| 语义 | `wxLogin` 未绑定时下发的一次性 `bindTicket` ↔ openid |
| 消费 | 成功绑定（`wxBind` / `wxRegister` 成功路径）后消费；失败路径是否消费遵循现网 `wxBind` 对无效/冲突的既有行为，避免误杀仍可用的 ticket |

## Redis：滑块（既有，015）

| 项 | 说明 |
|----|------|
| Key | `bill:captcha:{captchaId}` |
| 消费 | `wxRegister` / `register` 提交时 `consumeCaptcha`，一次性 |

## 关系

```text
User 1 ── 0..1 UserWechat ── 1 openid
         ▲
         └── H5/PC：仅 User（密码登录）
         └── 小程序成功路径：User + UserWechat（注册即绑定或绑定已有）
```

## 状态转换：小程序开户

```text
[未绑定 + 持有 bindTicket]
        │
        ├─ wxBind(已有账号) ──成功──► [已登录 + 已绑定]
        │
        └─ wxRegister(新账号)
              │
              ├─ 校验/滑块/用户名冲突失败 ──► 仍未绑定；无新用户
              ├─ 用户已创建 + 绑定成功 ──► [已登录 + 已绑定]
              └─ 用户已创建 + 绑定失败 ──► [未登录 + 未绑定 + 账号已存在]
                                            引导走 wxBind
```

## 状态转换：H5 开户

```text
[未登录] ─ register 成功 ─► [未登录，可登录]
         ─ register 失败 ─► [未登录，无新用户]
随后 login 成功 ─► [已登录]
```

## 客户端瞬时状态（不落库）

| 端 | 状态 |
|----|------|
| H5 | `mode: login \| register`；表单字段；滑块弹窗 |
| 小程序绑定页 | `mode: bind \| register`；`bindTicket`；滑块弹窗 |
