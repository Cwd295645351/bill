# Data Model: 015-slider-captcha

本特性**无新 MySQL 表**。状态仅在 Redis。

## Redis：滑块题目

| 项 | 说明 |
|----|------|
| Key | `bill:captcha:{captchaId}` |
| Value | 缺口横坐标（像素，十进制字符串） |
| TTL | 约 120 秒 |
| 消费 | `GET` 后 `DEL`（成功或失败均删除） |

## 客户端瞬时状态（不落库）

| 端 | 字段 |
|----|------|
| PC / H5 / 小程序 | `captchaId`、`captchaX`（拼图左缘相对背景的像素）、是否已拖动 |

## 与既有实体关系

- **users / JWT / session**：登录成功路径不变；仅增加滑块门槛。  
- **bindTicket**（`bill:wxbind:*`）：与滑块 key 独立；`wxBind` 须两者皆有效。

## 状态转换

1. `createCaptcha` → Redis SET + 返回题目  
2. 用户拖动 → 客户端持有 `captchaX`  
3. 业务提交 → `consumeCaptcha` → 通过则继续 login/register/wxBind；否则业务失败  
4. 过期或已删 key → 失败，须重新拉题
