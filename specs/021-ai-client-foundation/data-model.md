# 数据模型：统一 AI 调用底座（E1）

**功能分支**: `021-ai-client-foundation` | **日期**: 2026-11-11

本切片**不新增 MySQL 表、不改列**。以下为运行时概念实体（日志 / Redis），供实现与验收对齐。

## 实体

### AI 调用请求（运行时）

一次经统一入口处理的模型调用意图。

| 字段 | 说明 |
|------|------|
| userId | 登录用户；来自 JWT 注入头，不可由请求体伪造 |
| billId | 可选；有则须为该用户所属账本 |
| capability | 能力标识，本期固定 `parse-batch` |
| inputMeta | 非敏感元数据（如行数、文本长度）；**不含**密钥与完整正文落审计 |

### AI 调用审计记录（日志行）

| 字段 | 说明 |
|------|------|
| ts | ISO 时间或可排序时间戳 |
| userId | 必填 |
| billId | 可空 |
| capability | 如 `parse-batch` |
| upstreamRequested | 是否已（或已决定）请求外部 AI |
| outcome | `success` / `error` |
| errorCategory | 见下方枚举；成功可空或 `none` |
| durationMs | 入口处理耗时 |
| usage | 可空；上游返回的 prompt/completion tokens 等摘要 |
| dailyCount | 可选；占用后的当日计数，便于排查 |

**脱敏**：不得包含 `AI_API_KEY`、Authorization、完整 prompt/模型原文。

### 用户 AI 额度窗口（Redis）

| 字段 | 说明 |
|------|------|
| userId | 登录用户 |
| dayKey | 东八区自然日 `yyyyMMdd` |
| count | 已占用次数（仅上游路径） |
| limit | 上限，默认 60，来自配置 |

Redis Key 约定：`bill:ai:daily:{userId}:{dayKey}`。

## 错误类别（errorCategory）

| 类别 | 含义 | 计次 | upstreamRequested |
|------|------|------|-------------------|
| `not_configured` | 未配置 API Key | 否 | false |
| `rate_limited` | 日额度已满 | 否 | false |
| `rate_limit_unavailable` | Redis 等额度存储不可用（失败关闭） | 否 | false |
| `timeout` | 上游超时 | 是 | true |
| `upstream_http` | 上游非 2xx | 是 | true |
| `upstream_invalid` | 响应无法解析/收敛失败 | 是 | true |
| `forbidden_bill` | billId 非成员 | 否 | false |
| `none` | 成功 | 是 | true |

## 状态与流转（额度）

```text
[收到 parse-batch]  （编排顺序固定，实现不得颠倒）
    │
    ├─ 1. 校验 body 失败 → 直接业务错误（不计次、可不打审计）
    ├─ 2. billId 非成员 → 审计 forbidden_bill → 返回错误
    ├─ 3. 未配置 → 审计 not_configured → 返回错误
    ├─ 4a. Redis/额度读写失败 → 审计 rate_limit_unavailable → 返回错误（失败关闭）
    ├─ 4b. INCR 后 > limit → DECR → 审计 rate_limited → 返回错误
    └─ 5. 已占用额度
           ├─ 上游成功 → 审计 success → 返回草稿数组
           └─ 上游失败 → 审计对应错误类 → 返回错误（额度保留）
```

## 与现网业务数据关系

- **不写** `transactions`：解析只出草稿，落库仍走既有批量保存确认流。
- **不改** 账本成员、类型、分摊等表结构。
- 批量解析结果元素形状保持：`index`、`costTypeId`、`costTypeName`、`money`、`date`（收敛规则不变）。
