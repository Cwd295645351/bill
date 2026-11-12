# 任务列表：统一 AI 调用底座（E1）

**输入**: `/specs/021-ai-client-foundation/` 下的设计文档

**前置条件**: plan.md、spec.md、research.md、data-model.md、contracts/

**测试**: 规格未要求自动化测试；验收以 [quickstart.md](./quickstart.md) 手工路径为准，本列表不含单测/契约测试任务。

**组织方式**: 按用户故事分组，便于独立实现与验收。

## 格式：`[ID] [P?] [Story] 描述`

- **[P]**: 可并行（不同文件、无未完成依赖）
- **[Story]**: 所属用户故事（US1–US4）
- 描述含确切文件路径

## 路径约定

按 plan.md：后端 `server/`，PC `frontend/src/views/record/`，手册 `docs/用户手册.md`。

---

## 阶段 1：准备（共享基础设施）

**目的**: 建立 `server/utils/ai/` 目录与导出骨架，不改对外行为

- [x] T001 创建目录与空模块文件 `server/utils/ai/errors.ts`、`server/utils/ai/client.ts`、`server/utils/ai/audit.ts`、`server/utils/ai/rateLimit.ts`、`server/utils/ai/index.ts`
- [x] T002 在 `server/utils/ai/index.ts` 聚合导出占位符号，确保可被后续路由引用且当前不改变 `server/routes/ai` 行为

**检查点**: 目录与导出就绪，现网批量解析仍走旧代码路径

---

## 阶段 2：基础能力（阻塞性前置）

**目的**: 完成横切模块实现（尚可不挂到 parse-batch 成功主路径以外的编排）

**⚠️ 重要**: 本阶段完成前，不得开始依赖完整底座的用户故事收尾联调

- [x] T003 [P] 在 `server/utils/ai/errors.ts` 定义错误类别枚举（`not_configured` / `rate_limited` / `rate_limit_unavailable` / `timeout` / `upstream_http` / `upstream_invalid` / `forbidden_bill` / `none`）及用户可见文案映射（未配置保持「AI 服务未配置，请联系管理员」；限流为「过于频繁/稍后再试」类；Redis 不可用为「服务繁忙/稍后再试」类）
- [x] T004 [P] 在 `server/config/ai.ts` 增加 `dailyLimit`：读取环境变量 `AI_DAILY_LIMIT`，缺省 **60**；继续导出 `apiKey` / `baseURL` / `model`
- [x] T005 在 `server/utils/ai/client.ts` 实现 `AiClient.chatCompletions`：支持 `timeoutMs`（批量默认 5 分钟）、AbortController、HTTP/超时/解析类错误归类；可选 `tools`/`tool_choice` 参数预留但本期可不使用；**禁止**在日志中输出 API Key
- [x] T006 [P] 在 `server/utils/ai/audit.ts` 实现结构化审计：前缀 `[ai-audit]`；字段含 `ts`、`userId`、`billId`（可空）、`capability`、`upstreamRequested`、`outcome`、`errorCategory`、`durationMs`、`usage`（可空）；禁止密钥与完整 prompt/响应正文
- [x] T007 [P] 在 `server/utils/ai/rateLimit.ts` 基于 `server/utils/redis` 的 `client` 实现日额度：Key `bill:ai:daily:{userId}:{yyyyMMdd}`（东八区自然日）；`INCR` 后若大于上限则 `DECR` 并返回超限（原子占用，满足并发贴边不得全部放过）；TTL 至次日东八区 0 点或 ≥48h；默认上限来自 `AI_DAILY_LIMIT`；**不做**短时突发限流；Redis 连接/命令失败时抛出或返回可识别错误供路由失败关闭（不计次、不打上游）

**检查点**: 基础模块可独立 import；parse-batch 对外行为仍可由阶段 3 起逐步切换

---

## 阶段 3：用户故事 1 - 批量解析零回归（优先级：P1）🎯 MVP

**目标**: 现有电脑端批量解析经 AiClient 调用上游，成功响应形状与确认落库流程不变

**独立测试**: 已配置 AI 时，多行解析 → 可编辑草稿 → 批量保存；未确认不落库（quickstart V1）

### 用户故事 1 的实现

- [x] T008 [US1] 将 `server/routes/ai/controller.ts` 中上游 `fetch` 改为调用 `AiClient.chatCompletions`；保留 `buildBatchPrompt`、`parseModelResponse`、`normalizeParsedResults` 及现有行数/类型收敛语义
- [x] T009 [US1] 确保 `server/routes/ai/index.ts` 成功时仍返回 `ResModel(result, '批量解析成功')`，`data` 数组字段 `index` / `costTypeId` / `costTypeName` / `money` / `date` 不删不改名（见 contracts/ai-parse-batch.md）
- [x] T010 [US1] 确认输入校验上限仍生效且**不计 AI 日额度**：`MAX_TEXT_LENGTH=20000`、`MAX_LINE_COUNT=100`、`MAX_LINE_LENGTH=500` 等现网常量保留在 `server/routes/ai/index.ts`

**检查点**: 已配置环境下批量解析主路径与改造前一致（允许模型非确定性差异）

---

## 阶段 4：用户故事 2 - AI 未配置时的友好失败（优先级：P1）

**目标**: 未配置或上游超时/失败时返回可读中文提示，不写明细、未配置不计次

**独立测试**: 清空 `AI_API_KEY` 后解析，提示联系管理员且无新明细（quickstart V2）

### 用户故事 2 的实现

- [x] T011 [US2] 在 `server/routes/ai` 编排中于调用上游前检测 `AI_API_KEY` 未配置：返回既有未配置文案、`upstreamRequested=false`、**不**调用 Redis 占用额度、**不**请求上游（须排在额度占用之前，见下方编排约定）
- [x] T012 [US2] 将超时 / 上游 HTTP 失败 / 响应无法解析映射为 `errors.ts` 中对应类别与用户可见 `message`，经 `ResModel(null, message, 'error')` 返回；PC 继续依赖现有 `ElMessage.error(response?.message)`（`frontend/src/views/record/hooks/use-parse.ts` 无需为未配置/限流单独改组件；验收时确认限流与未配置 `message` 均能弹出）

**检查点**: 未配置与上游失败路径可读、无脏数据；未配置不计日额度

---

## 阶段 5：用户故事 3 - 过频调用被拦住（优先级：P2）

**目标**: 每用户东八区自然日额度；超额拒绝且不计次、不打上游

**独立测试**: 将 `AI_DAILY_LIMIT` 临时调小，打满后拒绝；用户 B 不受 A 影响（quickstart V3）

### 用户故事 3 的实现

- [x] T013 [US3] 在 `server/routes/ai/index.ts`（或薄封装）于「将调用上游」之前调用 `rateLimit`：仅登录用户 `ctx.header.userid`（JWT 注入）计量；批量解析**每次请求计 1 次**与行数无关；须排在未配置检测之后
- [x] T014 [US3] 实现计次规则：未配置失败、限流拒绝、Redis 不可用失败关闭均**不计次**；已 `INCR` 占用后的上游成功/失败/超时**保留占用**；超限路径 `DECR` 回滚后返回限流文案且不请求上游；Redis 异常映射 `rate_limit_unavailable` 并失败关闭
- [x] T015 [US3] 在 `docs/用户手册.md` 的「6.7 AI 批量解析」补充过频/稍后再试说明（FR-010）

**检查点**: 日额度行为符合澄清结论；手册已提及过频

---

## 阶段 6：用户故事 4 - 调用可追溯（优先级：P2）

**目标**: 成功/失败/限流/未配置均可检索审计；可选 `billId`；无密钥泄漏

**独立测试**: 日志检索 `[ai-audit]`，含 userId/billId/类别，无 Key（quickstart V4）

### 用户故事 4 的实现

- [x] T016 [US4] 在 `server/routes/ai/index.ts` 为 parse-batch 增加可选 body 字段 `billId`：若提供则校验调用者为账本成员（复用既有成员校验能力，如 `assertBillMember` 或等价查询）；非成员返回业务错误、不计次、不打上游，审计 `forbidden_bill`；须排在未配置/额度占用之前
- [x] T017 [US4] 在所有经统一入口的结局路径调用 `audit.ts`（成功、未配置、限流、额度存储不可用、超时、上游错误、非法账本），正确设置 `upstreamRequested` 与 `errorCategory`
- [x] T018 [US4] 修改 `frontend/src/views/record/hooks/use-parse.ts`：请求体在已进入账本时传入当前 `billId`（路径/API `parse-batch` 不变）

**编排约定（实现 `index.ts` 时强制）**: 按 [data-model.md](./data-model.md) 固定顺序——① 输入校验 → ② 可选 `billId` 成员校验 → ③ 未配置检测 → ④ Redis 日额度占用（含不可用失败关闭）→ ⑤ 上游调用 → ⑥ 审计；合并 US2/US3/US4 时不得颠倒。

**检查点**: 审计可按用户与账本定位；PC 已传 billId；抽检日志无密钥

---

## 阶段 7：打磨与横切

**目的**: 端到端验收与边界收口

- [x] T019 按 [quickstart.md](./quickstart.md) 跑通 V1–V6（含恢复合理 `AI_DAILY_LIMIT`；V3 含并发贴边说明；确认 PC 限流 `message` 可弹出）
- [x] T020 回归：空文本/超行数等输入校验错误不计额度；批量保存确认流与权限不变；确认未改 H5/小程序与未新增公开 AI 路径
- [x] T021 [P] 在 `server/utils/ai/index.ts`（或 `client.ts` 文件头注释）写明扩展约定：后续 AI 能力只注册业务提示词与结果处理，复用超时/错误归类/审计/限流（对应 SC-005）

**检查点**: 规格 SC-001–SC-005 与契约兼容项可勾选关闭

---

## 依赖与执行顺序

### 阶段依赖

- **准备（阶段 1）**: 无依赖
- **基础能力（阶段 2）**: 依赖阶段 1——**阻塞**后续故事中的底座联调
- **用户故事 1–4（阶段 3–6）**: 依赖阶段 2；建议顺序 US1 → US2 → US3 → US4（路由编排递增）；US3/US4 在模块已就绪时可部分并行改不同文件
- **打磨（阶段 7）**: 依赖 US1–US4 完成；T021 可与 T019/T020 并行

### 用户故事依赖

- **US1（P1）**: 依赖 T005 客户端；交付零回归主路径
- **US2（P1）**: 依赖 T003 错误映射；可与 US1 同路由文件串行收尾
- **US3（P2）**: 依赖 T007 限流模块
- **US4（P2）**: 依赖 T006 审计模块；PC `billId` 可与后端并行
- **路由合并**: US2–US4 改同一 `index.ts` 时必须遵守阶段 6「编排约定」

### 并行机会

- T003、T004、T006、T007 在 T001/T002 后可并行
- T018（前端 billId）可与 T016/T017（后端）并行
- T015（手册）可与 T013/T014 并行
- T021（SC-005 扩展约定注释）可与 T019/T020 并行

---

## 并行示例：基础模块

```bash
# 阶段 2 可同时推进（不同文件）：
任务: "T003 server/utils/ai/errors.ts"
任务: "T004 server/config/ai.ts"
任务: "T006 server/utils/ai/audit.ts"
任务: "T007 server/utils/ai/rateLimit.ts"
```

---

## 实施策略

### 先做 MVP（用户故事 1）

1. 完成阶段 1–2  
2. 完成阶段 3（US1）并按 V1 验收  
3. 再叠 US2 → US3 → US4 → 打磨  

### 增量交付

1. 准备 + 基础 → 底座可引用  
2. US1 → 零回归  
3. US2 → 未配置友好失败  
4. US3 → 日额度 + 手册  
5. US4 → 审计 + billId  
6. quickstart 全量验收（含 SC-005 扩展约定）  

---

## 备注

- 规格未要求自动化测试，故无自动化测试任务；验收用 quickstart  
- 不得新增 `parse-one` / `chat` / 审计查询 API / AI 审计表  
- 密钥仅环境变量；日志禁止 Key / Authorization  
- FR-012 已并入 FR-006；突发限流非本期验收  
- 每完成一逻辑组可提交；在检查点停下独立验收故事  
