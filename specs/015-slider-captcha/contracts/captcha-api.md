# API Contracts: 015-slider-captcha

Base: `/api/v1`。

## GET `/common/captcha`

获取滑块题目。**无需登录**（须在 JWT `unless` 放行）。

**Success** `retCode: 0`

```json
{
  "captchaId": "uuid",
  "backgroundImage": "data:image/svg+xml;base64,...",
  "puzzleImage": "data:image/svg+xml;base64,...",
  "y": 40,
  "width": 300,
  "height": 150,
  "puzzleSize": 42,
  "targetX": 128,
  "tolerance": 6,
  "expiresIn": 120
}
```

**Errors**: 生成失败时 `retCode != 0`（如 Redis 不可用）。

## 扩展：`POST /common/login`

既有字段不变；**新增必填**：

```json
{
  "username": "...",
  "password": "<RSA密文>",
  "captchaId": "uuid",
  "captchaX": 128
}
```

`captchaX`：拼图左边缘相对背景左侧的像素。校验失败错误文案示例：`请完成滑块验证` / `滑块验证失败或已过期`。通过后才进入既有密码校验。

## 扩展：`POST /common/register`

同 login，在既有 `username` / `password` / `nickName` 上增加 `captchaId`、`captchaX`；失败不创建用户。

## 扩展：`POST /common/wxBind`

同 login，在既有 `bindTicket` / `username` / `password` 上增加 `captchaId`、`captchaX`。

## 明确不扩展

`POST /common/wxLogin` — 不要求滑块字段。
