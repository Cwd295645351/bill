# 实现计划：统一 AI 调用底座（E1）

**功能分支**: `021-ai-client-foundation` | **日期**: 2026-11-11 | **规格**: [spec.md](./spec.md)

**输入**: `/specs/021-ai-client-foundation/spec.md` 中的功能规格

**说明**: 本文件由 `/speckit-plan` 填写；其定义描述执行工作流。

## 摘要

在现有 `server/routes/ai` 批量解析之上抽取统一 **AiClient**（超时、错误归类、可选工具调用预留），并把 **结构化审计日志** 与 **每用户东八区自然日额度**（默认 60，可配置；无短时突发限流）接到同一入口。路由编排固定顺序：输入校验 → 可选 `billId` 成员校验 → 未配置检测 → Redis 日额度占用 → 上游调用 → 审计。Redis 不可用时失败关闭（拒请求、不打上游、不计次）。现有 `POST /api/v1/ai/parse-batch` 成功响应形状与主流程保持兼容；PC 传入当前 `billId`，限流等新错误经既有 `ElMessage` 透出 `message`。不同步交付一句话记账、年报、对话助手。审计以日志为最低交付，不新建业务表。

## 技术上下文

**语言/版本**: TypeScript；后端 Node.js + Koa 2（`server/`）。PC 前端 Vue 3（`frontend/`）仅做最小联调改动。

**主要依赖**: 既有 `fetch` + OpenAI Chat Completions 兼容上游；既有 `koa-redis` / `server/utils/redis` 客户端；`ResModel` 响应约定；环境变量 `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL`，新增可选 `AI_DAILY_LIMIT`。

**存储**: 无新 MySQL 表。额度计数存 Redis（按用户 + 东八区日期）；审计写结构化日志（stdout/`console`，可检索前缀）。

**测试**: 仓库无强制自动化测试门禁；按 [quickstart.md](./quickstart.md) 手工验收：零回归、未配置、限流、审计字段与无密钥泄漏。

**目标平台**: 后端 API；用户可感知入口仍为电脑网页 `/pc/` 记账「批量解析」。

**项目类型**: monorepo 增量；主改动 `server/utils/ai/` + `server/routes/ai/` + `server/config/ai.ts`；PC `frontend/src/views/record/` 最小改动；`docs/用户手册.md` 同步限流说明。

**性能目标**: 批量解析超时仍与现网一致（5 分钟量级，对齐 Nginx）；限流检查在调用上游前完成，P95 额外开销可忽略（单次 Redis）。

**约束**: 公开契约向后兼容；密钥不进仓库/日志；额度只计真实上游调用；批量解析按请求计 1 次；不做短时突发限流；Redis 故障失败关闭；不改落库确认流；H5/小程序默认不改。

**规模/范围**: 家庭账本；每用户每日默认 60 次 AI 调用；本期仅批量解析一个消费者。

## 宪章检查

*门禁：须在阶段 0 研究前通过；阶段 1 设计后再复核一次。*

对照 `.specify/memory/constitution.md`（v3.3.0）。

| 原则 | 设计前 | 设计后 |
|------|--------|--------|
| I. 存量优先，增量规格化 | 通过。切片仅 E1 底座；明确不做 A1/B1/C1/D1。 | 通过。见 research / contracts；不扩 Agent Runtime 或年报。 |
| II. 多端边界不可混用 | 通过。默认改 API；PC 仅 billId + 错误展示；不改 H5/小程序/旧 mobile。 | 通过。落点见下方源码；手册只补 PC 批量解析相关句。 |
| III. 账本隔离与记账权限 | 通过。解析仍不落库；传入 billId 时校验成员；userId 来自 JWT。 | 通过。契约写明 billId 可选但若传则成员校验；禁止模型自填身份。 |
| IV. 公开契约向后兼容 | 通过。保留 `parse-batch` 路径与成功 `data` 数组形状；新增可选 `billId`；新错误仅改 `message`。 | 通过。见 [contracts/ai-parse-batch.md](./contracts/ai-parse-batch.md)。 |
| V. 密钥与部署约束 | 通过。继续环境变量；审计禁止密钥；规格中文强制用语已在 clarify 落实。 | 通过。审计字段清单与脱敏写入 data-model / contracts。 |

无未通过的门禁。

### 设计后复核

选定方案：`server/utils/ai/` 提供 `AiClient` + 审计 + Redis 日额度；`parse-batch` 按「校验 → billId → 未配置 → INCR → 上游 → 审计」编排；额度 INCR-before-call、超限 DECR 回滚；Redis 异常失败关闭；未配置 / 限流 / Redis 不可用均不计次；PC `use-parse` 传入当前账本 id；手册补充限流提示；`index.ts` 注释标明后续能力只换提示词与结果处理（SC-005）。门禁在实现与手册同步后关闭。

## 项目结构

### 文档（本功能）

```text
specs/021-ai-client-foundation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ai-parse-batch.md
├── checklists/requirements.md
└── tasks.md
```

### 源码（仓库根）

```text
server/config/ai.ts                 # 导出 dailyLimit（AI_DAILY_LIMIT，默认 60）等
server/utils/ai/
├── client.ts                       # AiClient：chatCompletions、timeout、错误归类
├── audit.ts                        # 结构化审计日志（无密钥）
├── rateLimit.ts                    # Redis 日额度：检查/占用/超限回滚
├── errors.ts                       # 错误类别枚举与用户可见文案映射
└── index.ts                        # 聚合导出
server/routes/ai/
├── controller.ts                   # parseBatch 改为走 AiClient；保留提示词与结果收敛
└── index.ts                        # 注入 userId；可选 billId + 成员校验；限流/审计编排

frontend/src/views/record/
├── hooks/use-parse.ts              # 请求体增加当前 billId
└── （api.ts 路径不变）

docs/用户手册.md                    # 6.7：补充「调用过频请稍后再试」

# 明确不改（默认）
miniapp/ / mobile-h5/               # 本期无 AI 入口
server 其他业务模块                 # 不改落库与分摊
新建 AI 审计表 / 管理后台           # 不做
```

**结构决策**: 横切能力放 `server/utils/ai/`，业务路由仍在 `server/routes/ai/`，符合宪章「routes + 可复用 utils/services」分层；不新开平行 AI 服务进程。

## 复杂度跟踪

无宪章违规，不填本表。
