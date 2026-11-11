# 研究记录：统一 AI 调用底座（E1）

**功能分支**: `021-ai-client-foundation` | **日期**: 2026-11-11

## 1. AiClient 落点与职责边界

**决策**: 新建 `server/utils/ai/`（`client` / `audit` / `rateLimit` / `errors`），由 `server/routes/ai` 编排；批量解析的提示词与结果收敛仍留在 `routes/ai/controller.ts`。

**理由**: 宪章要求复用 `routes/<模块>` 与可共享工具层；超时、错误归类、审计、限流是横切能力，后续 parse-one / chat 应只换业务提示与结果处理，不复制 HTTP 调用。现网 `parseBatch` 已内联 `fetch` + AbortController，抽出客户端即可零回归迁移。

**备选方案**:

- 全部堆在 `routes/ai/controller.ts` → 拒绝：后续能力会复制超时/审计/限流。
- 新建独立 `server/routes/ai-gateway` 服务进程 → 拒绝：过度工程，违反存量优先。
- 放入 `database/services` → 拒绝：无持久化领域模型，不属于 DB service。

## 2. 额度存储与并发安全

**决策**: 使用既有 Redis 客户端（`server/utils/redis` 的 `client`）。Key：`bill:ai:daily:{userId}:{yyyyMMdd}`，其中日期为 **Asia/Shanghai** 自然日。流程：配置检查通过后 `INCR`；若结果大于上限则 `DECR` 并返回限流（净不计次）；否则发起上游；上游成功/失败均保持该次占用。TTL 设到「次日东八区 0 点」或至少 48h 兜底，避免泄漏。Redis 连接/命令失败时**失败关闭**：不打上游、不计次、返回可理解提示并审计 `rate_limit_unavailable`（不得放行）。

**理由**: 规格要求按登录用户、日额度、不计未配置与限流拒绝、已决定发起上游则计次；多实例部署下内存计数不可靠，项目已依赖 Redis（session/验证码）。`INCR` 后超限再 `DECR` 可避免并发「全部放过」。费用保护优先于短暂不可用。

**备选方案**:

- 进程内 Map → 拒绝：多进程/重启丢计数，费用保护失效。
- MySQL 计数表 → 拒绝：规格允许日志级审计、不强制新表；日计数用 Redis 更合适。
- 先 GET 再 SET → 拒绝：竞态窗口大。
- Redis 故障时放行 → 拒绝：与 FR-005 费用保护冲突。

## 3. 何时计次 / 何时不计

**决策**（对齐澄清结论）：

| 情况 | 计次 | 上游 | 审计 |
|------|------|------|------|
| 未配置 `AI_API_KEY` | 否 | 否 | 是（`not_configured`） |
| 已超日额度 | 否 | 否 | 是（`rate_limited`） |
| Redis 不可用 | 否 | 否 | 是（`rate_limit_unavailable`） |
| 已占用额度后上游成功 | 是 | 是 | 是（`success`） |
| 已占用额度后上游失败/超时/非 2xx | 是 | 是 | 是（对应错误类） |
| 请求体校验失败（空文本等） | 否 | 否 | 否（或可选 debug；本期不要求） |

批量解析：**每次 HTTP 解析请求计 1 次**，与行数无关（现有行数上限 100 保持不变，属输入校验，不改变计次）。

**理由**: 直接落实规格澄清记录；避免未配置/限流误扣，同时防止上游抖动无限重试白嫖。

## 4. 审计形态

**决策**: 结构化单行日志，固定前缀如 `[ai-audit]`，JSON 字段至少含：`ts`、`userId`、`billId`（可空）、`capability`（如 `parse-batch`）、`upstreamRequested`（boolean）、`outcome`、`errorCategory`、`durationMs`、`usage`（可空）。**禁止**输出 API Key、Authorization、完整 prompt/响应正文（可用 length 或截断 hash，本期默认不落正文）。

**理由**: 规格以可检索日志为最低交付；仓库现以 `console` 为主，不引入新日志框架。独立审计表与管理后台明确非本期。

**备选方案**:

- 新建 `ai_call_logs` 表 → 延期：规格假设已排除。
- 只打非结构化中文 → 拒绝：不利于按 userId/billId 检索（SC-004）。

## 5. billId 与鉴权

**决策**: `parse-batch` **新增可选**请求体字段 `billId`。若提供：用 JWT 覆盖后的 `userid` 做账本成员校验，非成员直接业务错误且不调上游、不计次。若不提供：行为与现网一致仍可解析，审计 `billId` 为空（兼容旧客户端）。PC `use-parse.ts` **本期改为传入当前账本 id**，以满足可追溯验收。

**理由**: 现网路由未读 billId，但 SC-004 要求有账本上下文时可定位；可选字段保持契约兼容。userId 一律 `ctx.header.userid`（JWT 注入），禁止信任体里的身份字段。

**备选方案**:

- 强制 billId → 可能打断未升级客户端；本期选可选 + PC 主动传。
- 从 session 推断唯一账本 → 用户可多账本，不可靠。

## 6. 错误文案与前端

**决策**: 保持 `ResModel`：`retCode !== 0` + `message` 字符串。未配置文案保持「AI 服务未配置，请联系管理员」；新增限流文案如「AI 调用过于频繁，请明天再试或稍后再试」。PC 已有 `ElMessage.error(response?.message || …)`，**无需为限流单独改组件逻辑**；手册 6.7 补一句过频说明（FR-010）。

**理由**: 契约向后兼容；用户可见变化主要是新 message，PC 已透传。

## 7. 超时与扩展预留

**决策**: 批量解析超时保持 **5 分钟**（与现网 / Nginx 对齐）。`AiClient.chatCompletions` 接受可选 `timeoutMs`、`tools`/`tool_choice` 参数，本期 parse-batch 不传 tools。默认日额度 `AI_DAILY_LIMIT` 缺省 **60**；不做每分钟突发限流。

**理由**: 规格 FR-002/FR-006（日额度唯一窗口、无突发限流）；对话类更短超时留给后续切片。

## 8. 明确不做

**决策**: 不交付 parse-one / 年报 / chat Agent / 可写工具；不改批量保存落库规则；不改 H5/小程序；不恢复旧 `mobile/`。

**理由**: FR-011 与宪章 I/II。
