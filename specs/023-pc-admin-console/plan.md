# 实现计划：PC 运营后台

**功能分支**: `023-pc-admin-console` | **日期**: 2026-11-18 | **规格**: [spec.md](./spec.md)

**输入**: `/specs/023-pc-admin-console/spec.md` 中的功能规格

**说明**: 本文件由 `/speckit-plan` 填写；其定义描述执行工作流。

## 摘要

在 PC 端为 `ADMIN_USERNAME` 指定的唯一管理员提供运营后台：总览（近 7/30 日）、用户与账本列表/详情（可筛选、默认可视未删除）、可检索 AI 审计与用量，以及系统默认支出/收入/支付方式模板的增改删（只影响之后新建账本）。`parse-batch` 的 `billId` 改为必填；通过校验的调用打控制台日志并写入 `ai_call_audits`（`bill_id` 非空）。默认类型迁入 `catalog_defaults`；用户与账本补可空 `created_at`。除默认类型外后台只读。不改 H5/小程序管理入口；解析成功 `data` 形状与日额度算法不变。

技术路径见 [research.md](./research.md)；表与实体见 [data-model.md](./data-model.md)；HTTP 见 [contracts/admin-api.md](./contracts/admin-api.md)。

## 技术上下文

**语言/版本**: TypeScript；后端 Node.js + Koa 2（`server/`）；PC Vue 3 + Vite（`frontend/`）。

**主要依赖**: 既有 Sequelize、MySQL、Redis（仅继续服务 AI 日额度）、koa-router、`ResModel`、PC Element Plus 与现有 layout/路由约定。

**存储**: MySQL 新表 `ai_call_audits`、`catalog_defaults`；`users`/`bills` 增加可空 `created_at`（`ensureAdminSchema` 补列）。Redis 不承担审计历史。

**测试**: 无新测试框架；`server` 执行 `pnpm typecheck`；按 [quickstart.md](./quickstart.md) 手工验收。

**目标平台**: 后端 `/api/v1/admin/*`；PC 静态资源 `/pc/` 下运营页。

**项目类型**: monorepo 增量；主改 `server/modules/admin`、`server/utils/ai/audit`、`server/modules/bill`（建账读模板）、`server/modules/auth`（`isAdmin`）、`frontend/src/views/admin`、手册。

**性能目标**: 家庭规模数据；总览与列表以 SQL 聚合/分页为主，单次打开总览在可接受交互时间内完成（对齐 SC-001 一分钟内人工验收）。

**约束**: 公开契约以兼容扩展为主（登录增 `isAdmin`）；`parse-batch` 成功 `data` 形状不变，但 FR-019 **批准**将 `billId` 从可选改为必填；审计无密钥/prompt；菜单非鉴权；模板改动不波及已有账本；不改 mobile-h5/miniapp 管理入口。

**规模/范围**: 单管理员；列表筛选 + 分页；用户详情最近 20 条 AI；默认类型三类；无封禁/改额度/解绑/流水下钻。

## 宪章检查

*门禁：须在阶段 0 研究前通过；阶段 1 设计后再复核一次。*

对照 `.specify/memory/constitution.md`（v3.4.0）。

| 原则 | 设计前 | 设计后 |
|------|--------|--------|
| I. 存量优先，增量规格化 | 通过。切片仅运营后台 + 模板持久化 + 审计落库；grilling/clarify 边界清晰。 | 通过。见 research/contracts；不做多管理员、自定义日期、流水下钻。 |
| II. 多端边界不可混用 | 通过。改 PC + API；明确不改 H5/小程序/旧 mobile。 | 通过。源码树仅 `server/` + `frontend/src/views/admin` + 手册。 |
| III. 账本隔离与记账权限 | 通过。后台只读汇总，不下钻明细；不提供解绑；不削弱记账人规则。 | 通过。契约禁止流水明细；建账仍走成员创建路径。 |
| IV. 公开契约向后兼容 | 有条件通过。新增 `/admin`；登录增 `isAdmin`；parse-batch 成功形状不变，但规格 FR-019 **显式批准**将 `billId` 从可选改为必填。 | 通过。契约写明收紧范围；缺账本拒绝且不计次；补列可空、可回滚。 |
| V. 密钥与部署约束 | 通过。继续 `ADMIN_USERNAME`；审计脱敏；规格中文。 | 通过。data-model 与契约写明禁止字段；手册补运营说明。 |
| 技术栈落点 | 通过。新领域 `server/modules/admin`；PC `views/admin`。 | 通过。见下方源码树。 |

无未通过的门禁。

### 设计后复核

选定方案与 research 一致：`modules/admin` 承载管理 API；`ensureAdminSchema` 建表加列并种子 `catalog_defaults`；`parse-batch` 强制 `billId`；`writeAiAudit` 双写日志+表；`createBill` 复制未删除模板；登录写 `isAdmin`；PC 仅管理员见「后台」。实现顺序建议：补表与种子 → AI 账本必填 + 审计双写 → admin 只读 API → 默认类型写 API 与建账改造 → 登录 isAdmin 与 PC 页 → 手册与 quickstart 验收。

## 项目结构

### 文档（本功能）

```text
specs/023-pc-admin-console/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── admin-api.md
├── checklists/requirements.md
└── tasks.md                 # /speckit-tasks 再创建
```

### 源码（仓库根）

```text
server/
  app.ts                              # 挂载 admin 路由与允许方法
  database/
    ensureAdminSchema.ts              # 新建：ai_call_audits、catalog_defaults、created_at 补列与种子
    initDatas.ts                      # 仍作种子源；运行时真相改为 catalog_defaults
    models/                           # 增 AI 审计与默认类型模型；User/Bill 加 createdAt
    index.ts                          # 导出新模型；connectDB 调 ensureAdminSchema
  modules/
    admin/                            # 新建：router / service(s) / index
    auth/                             # assertAdmin 复用；登录结果 isAdmin
    bill/service.ts                   # createBill 读未删除模板；空模板拒建
    ai/                               # 调用侧保持；审计经 utils/ai 双写
  utils/ai/audit.ts                   # 持久化封装（日志 + 入库）

frontend/src/
  views/admin/                        # 新建：router、api、总览/列表/详情/默认类型页
  components/layout/hooks/use-layout.ts  # 管理员菜单
  types/user-info.d.ts                # isAdmin 可选字段
  components/login/…                  # 登录结果写入 isAdmin

docs/用户手册.md                      # 运营后台小节

# 明确不改（默认）
miniapp/ / mobile-h5/
server/modules/access 权限语义（后台不走账本成员校验，走管理员校验）
```

**结构决策**: 运营能力独立成 `admin` 领域模块；横切审计仍在 `utils/ai`，与 021 底座一致；补表模式对齐既有 `ensureAssetSchema`，避免依赖尚未引入的迁移框架。

## 复杂度跟踪

无宪章违规，不填本表。
