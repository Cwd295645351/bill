# Contract: H5 复用现有 API（无新业务路由）

本文件约定移动端 H5 **消费**的现网接口形状。响应信封继续为现有 `ResModel`（`retCode` / `message` / `data`）。认证头与 PC 一致（登录后带用户标识与令牌，按现网中间件要求）。

## 认证（common）

| 方法 | 路径 | H5 用途 |
|------|------|---------|
| GET | `/api/v1/common/login_config` | 取 RSA 公钥，加密密码 |
| POST | `/api/v1/common/login` | 账号密码登录；成功返回 accessToken、refreshToken、expiresIn、userInfo |
| PUT | `/api/v1/common/refreshToken` | 刷新令牌 |
| POST | `/api/v1/common/logout` | 退出 |

### 首期明确不调用

| 方法 | 路径 | 原因 |
|------|------|------|
| POST | `/api/v1/common/register` | FR-011：H5 无注册入口（接口可对 PC 仍存在，H5 UI 不得暴露） |
| POST | `/api/v1/common/wxLogin` | FR-012：无微信登录 |
| POST | `/api/v1/common/wxBind` | FR-012：无绑定流程 |

登录失败：停留登录页，展示可读 `message`，不进入业务页。

## 账本（bill）

| 方法 | 路径 | H5 用途 |
|------|------|---------|
| GET | `/api/v1/bill/list` | 账本列表 |
| GET | `/api/v1/bill` | 账本/账单详情上下文 |
| POST | `/api/v1/bill/join` | 邀请码加入 |

邀请、创建账本等 PC 能力首期可不在 H5 暴露；若详情页需要成员信息，仅读现网已返回字段。

## 记账（transaction）

| 方法 | 路径 | H5 用途 |
|------|------|---------|
| POST | `/api/v1/transaction/list` | 流水列表 / 搜索筛选 |
| POST | `/api/v1/transaction/` | 新建 |
| PUT | `/api/v1/transaction/` | 编辑（仅创建者；否则业务错误） |
| DELETE | `/api/v1/transaction/` | 删除（同上） |
| GET | `/api/v1/transaction/currentMonthCost` | 可选：详情汇总 |

类型列表等依赖现网 `billtype`（或详情已带类型）时，按小程序同等调用，不新造类型语义。

## 兼容性

- **不改**上述路径的既有请求/响应必选字段。
- 若实现中发现缺字段阻塞 H5，须另开规格增量扩展（优先可选字段），不得在本特性静默改破坏性形状。
- 不按 User-Agent / Referer 拒绝 H5；与宪章「API 共用」一致。
