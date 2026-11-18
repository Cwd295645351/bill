---
description: "PC 运营后台的实现任务列表"
---

# 任务列表：PC 运营后台

**输入**: `/specs/023-pc-admin-console/` 下的设计文档

**前置条件**: plan.md（必须）、spec.md（用户故事必须）、research.md、data-model.md、contracts/

**测试**: 规格未要求自动化测试框架。本列表不写单测/契约测任务。每阶段在 `server` 执行 `pnpm typecheck`；交付前按 [quickstart.md](./quickstart.md) 手工验收。

**组织方式**: 按用户故事分组，以便每个故事可独立实现与验收。

## 格式：`[ID] [P?] [Story] 描述`

- **[P]**: 可并行（不同文件、无未完成依赖）
- **[Story]**: 所属用户故事（US1…US5）
- 描述中须含确切文件路径

## 路径约定

- 后端：`server/`（模块在 `server/modules/`）
- PC：`frontend/src/`
- 契约：`specs/023-pc-admin-console/contracts/admin-api.md`
- 不改 `mobile-h5/`、`miniapp/` 管理入口；不恢复旧 `mobile/`

---

## 阶段 1：准备（共享基础设施）

**目的**: 落下 admin 目录骨架与挂载点，尚不实现业务

- [X] T001 新建 `server/modules/admin/` 目录，放置空的 `router.ts`、`index.ts`（router 前缀 `/api/v1/admin`，暂无路由或仅健康占位）
- [X] T002 在 `server/app.ts` 挂载 admin 模块的 `routes()` 与 `allowedMethods()`；不得改 `cors` 与 `app.keys`

---

## 阶段 2：基础能力（阻塞性前置）

**目的**: 补表/模型/种子、登录 `isAdmin`、管理鉴权辅助、AI 账本必填与审计入库。本阶段完成前不得开始各用户故事业务接口

**⚠️ 重要**: 本阶段完成前，不得开始用户故事实现

- [X] T003 [P] 在 `server/database/models/auth.ts` 为 `users` 增加可空 `createdAt`（`created_at`）；在注册成功路径（`server/modules/auth/service.ts` 创建用户处）写入当前时间；旧行保持 NULL
- [X] T004 [P] 在 `server/database/models/bill.ts` 为 `bills` 增加可空 `createdAt`（`created_at`）；在 `server/modules/bill/service.ts` 的 `createBill` 创建时写入当前时间；旧行保持 NULL
- [X] T005 [P] 新建 AI 审计模型（建议 `server/database/models/ai-audit.ts` 或并入既有 models）：表 `ai_call_audits`；`id` CHAR(36) PK；`user_id` CHAR(36) NOT NULL；`bill_id` CHAR(36) NOT NULL；`capability` VARCHAR(64)；`upstream_requested` BOOLEAN；`outcome` VARCHAR(16) 为 `success`/`error`；`error_category` VARCHAR(64)；`duration_ms` INT；`prompt_tokens`/`completion_tokens`/`total_tokens` INT NULL；`daily_count` INT NULL；`created_at` DATETIME；索引含 `(created_at)`、`(user_id, created_at)`、`(bill_id, created_at)`、`(outcome, created_at)`
- [X] T006 [P] 新建默认类型模型：表 `catalog_defaults`；主键 `(kind, id)`；`kind` 为 `cost`/`income`/`pay_method`；`id` VARCHAR(32)；`name` VARCHAR(64)；`is_del` BOOLEAN 默认 false
- [X] T007 更新 `server/database/models/index.ts` 与 `server/database/index.ts`：导出新模型；`connectDB` 在 `sync` 后调用新补表（依赖 T003–T006）
- [X] T008 新建 `server/database/ensureAdminSchema.ts`：为已有 `users`/`bills` 补可空 `created_at`；`CREATE TABLE IF NOT EXISTS` 建 `ai_call_audits` 与 `catalog_defaults`（约束与 data-model 一致）；若 `catalog_defaults` 为空则用 `server/database/initDatas.ts` 灌入现有编号与名称；可重复执行（对齐 `ensureAssetSchema.ts`）
- [X] T009 抽取/扩展管理鉴权：在 `server/modules/auth/service.ts`（或 `server/modules/admin/` 内封装）提供管理校验，未配置返回「未配置管理员」，非管理员返回「非管理员没有权限」；密钥轮换可继续用其原有更具体文案。管理模块一律用上述短句
- [X] T010 在 `server/modules/auth/router.ts` 的 `writeLoginResult`（及等价登录成功组装处）增加 `isAdmin` 布尔字段；不得下发 `ADMIN_USERNAME`；未配置时恒为 false
- [X] T011 修改 `server/modules/ai/router.ts`：`billId` 改为必填（FR-019）；缺省/空串返回可读说明（如「请选择账本」），不打上游、不计日额度；有值则保持成员校验与后续编排顺序
- [X] T012 修改 `server/utils/ai/audit.ts`（及 `server/utils/ai/index.ts` 导出）：在现有 `[ai-audit]` 日志之后，将通过校验的调用写入 `ai_call_audits`（`bill_id` NOT NULL）；从 `usage` 提取 `prompt_tokens`/`completion_tokens`/`total_tokens`（缺则空）；禁止存密钥/prompt/响应正文；入库失败只打错误日志，不改变业务响应（依赖 T005、T007、T011）
- [X] T013 在 `server/modules/admin/` 实现共用 `requireAdmin(ctx)`（或等价），失败时写 `ResModel` 且 `data` 为 null；供后续全部管理路由复用（依赖 T009）
- [X] T014 在 `server` 目录执行 `pnpm typecheck`（依赖 T007–T013）

**检查点**: 补表与种子可用；登录含 `isAdmin`；无账本的 parse-batch 被拒；带账本的调用可入库审计

---

## 阶段 3：用户故事 5 - 非管理员无法进入后台（优先级：P1）

**目标**: 普通账号看不到后台入口；管理 API 一律拒绝且无业务数据

**独立测试**: 见 spec 用户故事 5；对照 quickstart 场景 B

### 用户故事 5 的实现

- [X] T015 [P] [US5] 扩展 `frontend/src/types/user-info.d.ts`（及登录写入处）支持 `isAdmin?: boolean`
- [X] T016 [US5] 在 `frontend/src/components/layout/hooks/use-layout.ts`（及必要时 `Layout.vue`）仅当 `isAdmin === true` 时追加「后台」菜单，路由指向 `/layout/admin`
- [X] T017 [US5] 新建 `frontend/src/views/admin/router.ts` 注册 `admin` 子路由；非管理员进入时前端可重定向到账本列表，但不得作为唯一防线（依赖 T016）
- [X] T018 [US5] 确认 `requireAdmin`（T013）已接入将添加的全部 `/api/v1/admin/*` 路由模板；本任务只验鉴权辅助与登录 `isAdmin`。用普通账号打 overview 的拒绝回归并入 T043（依赖 T020 之后）

**检查点**: 非管理员无菜单；未配置 `ADMIN_USERNAME` 时无人 `isAdmin`

---

## 阶段 4：用户故事 1 - 管理员打开运营总览（优先级：P1）🎯 MVP

**目标**: 管理员可看存量指标与近 7/30 日记账/AI 趋势；成功率 = 成功数 ÷ 窗口内全部审计数，分母为 0 时 `successRate` 为 null

**独立测试**: 见 spec 用户故事 1；quickstart 场景 A 总览部分

### 用户故事 1 的实现

- [X] T019 [US1] 在 `server/modules/admin/` 实现总览查询服务（如 `overview-service.ts`）：未删除用户/账本/微信绑定/流水笔数与收支合计；窗口内新建用户/账本（仅 `created_at` 非空）；流水按记账日东八区分桶；AI 按 `ai_call_audits.created_at` 分桶与成功率口径（依赖 T008、T012）
- [X] T020 [US1] 在 `server/modules/admin/router.ts` 实现 `GET /api/v1/admin/overview`，参数 `range=7|30`（默认 7）；先 `requireAdmin`；响应字段对齐 `contracts/admin-api.md`（依赖 T013、T019）
- [X] T021 [P] [US1] 新建 `frontend/src/views/admin/api.ts`，封装 overview 请求
- [X] T022 [US1] 新建总览页（如 `frontend/src/views/admin/OverviewPanel.vue` 或页内 Tab），支持 7/30 切换；无自定义日期；`successRate === null` 固定显示「不适用」（依赖 T021）
- [X] T023 [US1] 组装 `frontend/src/views/admin/` 主页面，默认展示总览；接入 layout 子路由（依赖 T017、T022）

**检查点**: 管理员 1 分钟内可打开总览并核对样例数字

---

## 阶段 5：用户故事 2 - 查看用户与账本（优先级：P1）

**目标**: 用户/账本列表（默认未删除、可筛选、可显示已删除）与详情（用户含账本与最近 20 条 AI；账本含成员昵称；无流水正文）

**独立测试**: 见 spec 用户故事 2

### 用户故事 2 的实现

- [X] T024 [US2] 在 `server/modules/admin/` 实现用户列表/详情服务：关键词匹配 `username` 或 `nick_name`；`includeDeleted` 默认 false；用户收支读 `users.incomes`/`expenses`；详情 `bills[{id,name,isCreator}]` + `recentAi` 最多 20 条按时间倒序
- [X] T025 [US2] 实现账本列表/详情服务：关键词匹配账本 `name`；`includeDeleted` 默认 false；`creatorName` 优先创建者昵称、缺省回退用户名；流水笔数与收支对未删除流水聚合（支出 `type=1`，其余为收入）；详情仅 `members[{userId,userName}]`，不得返回流水明细数组
- [X] T026 [US2] 在 `server/modules/admin/router.ts` 增加 `GET /admin/users`、`GET /admin/users/:id`、`GET /admin/bills`、`GET /admin/bills/:id`；分页 `page` 从 1、`pageSize` 默认 20 上限 100；均先 `requireAdmin`（依赖 T013、T024、T025）
- [X] T027 [P] [US2] 扩展 `frontend/src/views/admin/api.ts` 对接用户与账本接口
- [X] T028 [US2] 实现 PC 用户列表/详情 UI（筛选、显示已删除、分页、详情抽屉或子页）；不得展示备注/prompt/单笔流水正文（依赖 T027）
- [X] T029 [US2] 实现 PC 账本列表/详情 UI（同上约束）（依赖 T027）

**检查点**: 可完成「列表 → 详情」路径且无明细正文泄漏

---

## 阶段 6：用户故事 3 - 查看 AI 审计与用量（优先级：P1）

**目标**: 审计列表倒序翻页，支持关键词与 `outcome` 筛选；字段完整；无密钥/prompt

**独立测试**: 见 spec 用户故事 3；先用带 `billId` 的成功/失败解析造数

### 用户故事 3 的实现

- [X] T030 [US3] 在 `server/modules/admin/` 实现 AI 审计列表查询：按 `created_at` 倒序；`keyword` 匹配发起用户 username/nickName；`outcome` 可选 `success`/`error`；列表项含契约字段且 `billId` 必有值
- [X] T031 [US3] 在 `server/modules/admin/router.ts` 增加 `GET /api/v1/admin/ai-audits`；先 `requireAdmin`（依赖 T013、T030）
- [X] T032 [P] [US3] 扩展 `frontend/src/views/admin/api.ts` 对接审计列表
- [X] T033 [US3] 实现 PC AI 审计列表 UI（关键词、成败筛选、分页）；确认不渲染 prompt/密钥（依赖 T032）
- [X] T034 [US3] 手工验证：不传 `billId` 的 parse-batch 失败、不入库、不出现在审计列表；PC `use-parse` 带账本的成功/失败调用出现在列表与总览 AI 区（依赖 T011、T012、T020、T031）

**检查点**: 上线后带账本的成功/失败调用 100% 可在列表找到

---

## 阶段 7：用户故事 4 - 管理新建账本的默认类型（优先级：P2）

**目标**: 默认支出/收入/支付方式增改删只影响之后新建账本；软删可切换只读查看、不可恢复；每类至少一项；编号不复用

**独立测试**: 见 spec 用户故事 4；quickstart 场景 C

### 用户故事 4 的实现

- [X] T035 [US4] 在 `server/modules/admin/`（或公开给 bill 的只读函数）实现 `listActiveCatalogDefaults()`：仅 `is_del=false`；按 kind 分组
- [X] T036 [US4] 实现默认类型列表/新增/改名/软删服务：`name` 最长 64；同类未删除名称唯一；每类至少保留 1 条未删除；新 `id` = 同类（含已删除）最大数字 id+1，段位延续 1001/2001/3001；已删除不可改名不可恢复；`includeDeleted` 默认 false
- [X] T037 [US4] 在 `server/modules/admin/router.ts` 增加 `GET/POST /admin/catalog-defaults`、`PUT .../:kind/:id`、`POST .../:kind/:id/delete`；先 `requireAdmin`；无恢复接口（依赖 T013、T036）
- [X] T038 [US4] 修改 `server/modules/bill/service.ts` 的 `createBill`：三类类型改为从 `listActiveCatalogDefaults()` 复制；任一类未删除为空则拒绝建账并回滚，说明可读；不再运行时直读 `initDatas` 作为唯一真相（种子仍可来自 initDatas）（依赖 T035、T008）
- [X] T039 [P] [US4] 扩展 `frontend/src/views/admin/api.ts` 对接默认类型接口
- [X] T040 [US4] 实现 PC 默认类型管理 UI（三类 Tab、显示已删除开关、增改删）；无拖拽排序；不含概览规则（依赖 T039）

**检查点**: 改模板后新账本跟新名单；旧账本与流水名称不变

---

## 阶段 8：打磨与横切

**目的**: 手册、类型检查、端到端验收

- [X] T041 [P] 更新 `docs/用户手册.md`：补充「运营后台」说明（仅 `ADMIN_USERNAME` 对应账号、不对普通成员开放）；必要时在 AI 批量解析节注明必须选择/传入账本
- [X] T042 在 `server` 执行 `pnpm typecheck`；按项目既有方式检查 `frontend` 类型
- [X] T043 按 `specs/023-pc-admin-console/quickstart.md` 完整跑场景 A–D，勾选 SC-001…SC-006；含普通账号请求 `GET /api/v1/admin/overview` 被拒且无数据（补完 T018 回归）
- [X] T044 确认未改 `mobile-h5/`、`miniapp/` 管理入口；普通记账与日限额算法零回归；核对管理 UI/API 无封禁用户、删账本、移除成员、解绑微信、改 AI 日额度等写入口（FR-016）

---

## 依赖与执行顺序

### 阶段依赖

- **准备（阶段 1）**: 无依赖
- **基础能力（阶段 2）**: 依赖准备——**阻塞**全部用户故事
- **US5（阶段 3）**: 依赖基础能力（登录 `isAdmin`）；可与 US1 并行起 PC 壳，但菜单应在总览可点前就绪
- **US1（阶段 4）**: 依赖基础能力 + US5 路由壳；MVP 核心
- **US2 / US3（阶段 5–6）**: 依赖基础能力与 admin 鉴权；可互并行（不同服务文件时）
- **US4（阶段 7）**: 依赖基础能力中的 `catalog_defaults`；可在只读故事后做
- **打磨（阶段 8）**: 依赖计划交付的故事完成

### 用户故事依赖

- **US5**: 不依赖业务列表，但依赖 T010/T013
- **US1**: 依赖审计表与聚合；不依赖 US2/US4
- **US2**: 依赖用户/账本 `created_at` 与审计表（详情最近 AI）；不依赖 US4
- **US3**: 依赖 T011/T012；与 US1 总览 AI 区共享数据源
- **US4**: 依赖种子表；改 `createBill` 时注意与并行中的账本列表无写冲突

### 并行机会

- T003–T006 模型可并行
- T015 与后端 US1 服务可并行（前后端）
- US2 的 T024/T025 可并行
- US2 与 US3 在服务文件拆分后可两人并行
- T041 手册可与 UI 打磨并行

---

## 并行示例：基础能力之后

```bash
# 开发者 A：US1 总览 API + 页
任务: T019–T023

# 开发者 B：US2 用户/账本 API
任务: T024–T026

# 开发者 C：US3 审计列表（审计入库已在阶段 2）
任务: T030–T033
```

---

## 实施策略

### 先做 MVP（US5 门禁 + US1 总览）

1. 阶段 1–2：补表、AI 账本必填、审计入库、`isAdmin`
2. 阶段 3：非管理员看不见/进不去
3. 阶段 4：总览可演示
4. **停下验收** quickstart A（总览）+ B

### 增量交付

1. 加入 US2 → 用户/账本运营查看
2. 加入 US3 → 审计台账（与总览 AI 互相印证）
3. 加入 US4 → 默认类型运营
4. 打磨：手册 + quickstart 全量

### 多人并行策略

1. 共同完成阶段 1–2
2. 其后按上节并行示例拆分 US1/US2/US3；US4 单人串行改 `createBill` 更安全

---

## 备注

- 规格未要求自动化测试，故无 TDD 任务
- 每个管理路由必须先管理员校验；菜单隐藏不是鉴权
- `billId` 必填是对 021 的显式契约收紧，实现时同步改 `server/modules/ai/router.ts` 注释/编排说明
- `initDatas.ts` 仅作空表种子，运行时真相为 `catalog_defaults`
- 可在任一检查点停下做独立验收

---

## Phase 9: Convergence

- [X] T045 在 `frontend/src/views/admin/AiAuditsPanel.vue` 增加「当日序号」列并渲染 `dailyCount`（空显示 —）per FR-008 / US3/AC1 (missing)
- [X] T046 将 `frontend/src/views/admin/UsersPanel.vue` 与 `BillsPanel.vue` 中空 `createdAt` 的展示文案由「—」改为「未知」per FR-011 / US1/AC3 (contradicts)
- [X] T047 修正 `server/modules/admin/overview-service.ts` 的 `wechatBindCount`：仅统计关联未删除用户（`users.is_del = false`）的微信绑定 per FR-004 (partial)
