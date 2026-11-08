# API Contracts: 016-mobile-miniapp-register

Base: `/api/v1`。密码字段均为客户端 RSA 加密后的密文（与现网 login/register/wxBind 相同）。滑块字段与 015 相同。

## 既有：`POST /common/register`（H5 / PC 复用，契约不变）

**Auth**: 无需登录（JWT unless）。

**Body**:

```json
{
  "username": "alice01",
  "password": "<RSA密文>",
  "nickName": "可选昵称",
  "captchaId": "uuid",
  "captchaX": 128
}
```

**Success** `retCode: 0`：返回新建用户摘要（如 `id` / `username` / `nickName`），**不**返回 accessToken。

**Errors**（示例）: 用户名不符合规范、用户名已存在、密码强度不足、滑块失败/过期、密钥未初始化。

> H5 客户端成功后必须回到登录流程，不得自行当作已登录。

---

## 新增：`POST /common/wxRegister`

小程序「注册即绑定」。**Auth**: 无需登录（JWT unless）。

**Body**:

```json
{
  "bindTicket": "<wxLogin 下发的一次性票据>",
  "username": "alice01",
  "password": "<RSA密文>",
  "nickName": "可选昵称",
  "captchaId": "uuid",
  "captchaX": 128
}
```

**Success** `retCode: 0`（账号已创建且绑定成功）:

响应 data 形状与成功的 `wxBind` 对齐，至少包含：

```json
{
  "needBind": false,
  "accessToken": "...",
  "refreshToken": "...",
  "expiresIn": 86400,
  "userInfo": { }
}
```

（字段名以现网 `writeLoginResult` / `wxBind` 成功体为准，本契约要求**同形**，便于客户端复用 `saveSession`。）

**Errors**:

| 场景 | 行为 |
|------|------|
| bindTicket 缺失/无效/过期 | 失败；不创建用户 |
| 用户名/密码/滑块校验失败 | 失败；不创建用户 |
| 用户名已存在 | 失败；不创建用户、不绑定 |
| 当前 openid 已绑定其他账号 | 失败；不创建用户（或若已误创建须按实现保证不发登录态，优先在创建前检测 openid） |
| 目标逻辑：openid 空闲但写入绑定失败 | **保留已创建用户**；`retCode != 0`；**无** accessToken；`message` 须让用户理解「账号已创建，请使用该账号完成绑定」；建议 data 可含 `{ accountCreated: true, username }` 供客户端预填（可选，有则客户端应用） |
| 该 username 对应用户已绑定其他微信 | 按「账号已占用绑定」失败；若本请求刚创建的用户尚无绑定关系则不应出现此支 |

**不变量**:
- 成功路径不得要求客户端再调一次 `wxBind`。
- 半失败路径不得返回可用主流程登录态。
- 不得削弱「一 user_id / 一 openid」唯一约束。

---

## 不变接口（回归）

| 接口 | 期望 |
|------|------|
| `POST /common/login` | 行为不变；H5/PC 继续使用 |
| `POST /common/wxBind` | 行为不变；半失败后的补绑路径 |
| `POST /common/wxLogin` | 行为不变；已绑定静默登录、未绑定发 `bindTicket` |
| `GET /common/captcha` | 行为不变；`wxRegister`/`register` 提交前拉题 |

## 鉴权

`POST /common/wxRegister` 必须加入与 `register` / `wxBind` 同类的未登录放行名单，避免开户被 JWT 误伤。
