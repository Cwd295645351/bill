# Implementation Plan: 移动端预算模块

**Branch**: `017-mobile-budget` | **Date**: 2026-11-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-mobile-budget/spec.md`

## Summary

在 **微信小程序** 与 **mobile-h5** 按 `prototypes/miniapp.html` 交付账本内「预算」一级能力：当年汇总、占比饼图、进度卡片、增删改，以及卡片下钻到「搜索记录」（预填支出类型 + 当年起止并自动搜索）。复用既有 `GET/POST/PUT/DELETE /api/v1/budget`，不新增预算语义与表。账本内底部五入口均展示；概览/计划/资产进入未交付占位页并提示到电脑端（小程序可为各模块独立分包）。同步修订用户手册，并 bump 宪章中「预算仅 PC」的过时表述。两端都完成才算本切片 Done；PC 预算主流程不改。

## Technical Context

**Language/Version**: TypeScript（server 已有预算路由；mobile-h5 Vue 3；miniapp 原生 TS）  
**Primary Dependencies**: 既有 `/api/v1/budget`、`/budget/list` 客户端封装；账本详情（支出类型）；两端既有 `record-search`；原型 `prototypes/miniapp.html` 交互基准；**echarts**（H5 直引；小程序经 ec-canvas / echarts-for-weixin，见 research）  
**Storage**: 既有账单内嵌 `budget` / `budget_details`（经 `saveBudget`）；无新表、无迁移  
**Testing**: 手工验收（见 [quickstart.md](./quickstart.md)）；对照 contracts；回归 PC 预算与两端明细/搜索  
**Target Platform**: 微信小程序 + mobile-h5 `/mobile/`；PC `/pc/` 仅回归  
**Project Type**: monorepo（miniapp + mobile-h5 + 共用 API；本切片不改 frontend 功能）  
**Performance Goals**: SC-001 进入账本后约 30 秒内看清进度（正常网络）  
**Constraints**: 复用预算契约；当年自然年固定；不实现概览/计划/资产；不恢复旧 `mobile/`；不发明第二套预算语义  
**Scale/Scope**: 两端各一预算页 + 账本内底栏；搜索页支持预填自动搜；API 客户端增删改封装；手册 + 宪章文档

## Constitution Check

*GATE: 对照 `.specify/memory/constitution.md`（v3.0.0）。*

| 原则 | 判定 | 说明 |
|------|------|------|
| I 存量优先 | 通过 | 新目录 `specs/017-*`；只扩移动端预算；PC/概览/计划/资产/类型配置不动 |
| II 多端边界 | **有意修订** | 宪章仍写「预算…在电脑上操作」「概览、预算、计划…仍以 PC 为准」；本规格将预算升为小程序 + H5 一等能力。须在本交付 **bump 宪章**（与手册 FR-011 同步），明确预算可在三端管理，概览/计划/类型/资产仍以 PC 为准 |
| III 账本隔离与权限 | 通过 | 继续账本成员读写、账本隔离；不削弱记账人/归属人规则；权限与 PC 一致（不按创建者细分） |
| IV 契约兼容 | 通过 | 复用既有 `/budget` CRUD；不删字段、不改响应形状；客户端补全 `details` 使用 |
| V 密钥与部署 | 通过 | 无新密钥；路径仍 `/mobile/` 与小程序打 `/api` |

**Gate**：在「本迭代包含宪章修订（原则 II 预算落点）+ 手册更新」前提下通过（已写入 **FR-011**）。未完成文档对齐不得宣称交付完成（SC-005）。

### Post-Design Re-check

设计选定：零后端新接口；自定义账本内底栏（非全局 tabBar）；下钻走搜索页预填+自动搜；**饼图用 echarts**（为后续概览/资产柱状图、折线图铺路）。不恢复旧 `mobile/`、不引入平行业务栈。与修订后宪章预期一致。Gate 仍通过。

## Project Structure

### Documentation (this feature)

```text
specs/017-mobile-budget/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/budget-api.md
├── checklists/requirements.md
└── tasks.md                 # /speckit-tasks 生成，本命令不创建
```

### Source Code (repository root)

```text
# 后端：本切片默认不改（契约已足够）；仅当发现阻塞缺陷时做最小兼容修复并记入 tasks
server/routes/budget/          # 既有 list/add/edit/delete（只读参考）

mobile-h5/
├── package.json               # 增加 echarts（对齐 PC ^5.4.2）
├── src/api/budget.ts          # 新增：list/add/edit/delete（或从 transaction 迁出 getBudget）
├── src/views/budget/BudgetView.vue
├── src/components/BookTabBar.vue   # 账本内五入口；未交付入口进占位或等价提示
├── src/components/charts/     # 可选：饼图封装，供后续概览/资产复用
├── src/views/bill-detail/BillDetailView.vue  # 挂载 BookTabBar；记账高亮
├── src/views/record-search/RecordSearchView.vue  # query 预填 + 可选自动搜索
└── src/router/index.ts        # /bill/:id/budget 或平行预算路由

miniapp/
├── package.json / miniprogram_npm  # echarts + 微信适配（ec-canvas 等），构建 npm
└── miniprogram/
    ├── apis/index.ts          # budgetAdd / budgetEdit / budgetDelete；list 已有
    ├── pages/budget/index.{ts,wxml,wxss,json}
    ├── components/book-tab-bar/   # 账本内五入口
    ├── components/ec-canvas/ 或 charts/  # echarts 适配封装
    ├── pages/bill-detail/     # 挂载底栏
    ├── pages/record-search/   # onLoad 接收预填参数并自动搜索
    └── app.json               # 注册 pages/budget（非全局 tabBar）

docs/用户手册.md               # 去掉「预算仅 PC / 移动端不能编辑」
.specify/memory/constitution.md # 原则 II：预算可三端；概览/计划/类型/资产仍 PC
```

**Structure Decision**: 能力落在 `mobile-h5/` 与 `miniapp/`；全局主 tab 仍为账本/记一笔/我的；账本内五入口为页面级自定义底栏。不改 `frontend/` 预算页；不碰旧 `mobile/`。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 相对宪章 v3.0.0「预算仅电脑」 | 规格与原型要求移动端可管预算；澄清确认两端 Done | 只改客户端不改宪章 → Constitution Check 永久红灯，手册/宪章继续打架 |
| 两端各实现预算 UI | 澄清：两端都必须完成才算交付 | 只做一端 → 违反 FR-001 / US4 / SC-002 |
| 账本内自定义五入口底栏 | 原型信息架构；全局 tabBar 已被主站占用 | 把预算塞进全局 tab → 破坏现有三 tab，且概览等未交付入口无处安放 |
| 本切片引入 echarts（含小程序适配） | 预算饼图需要；后续概览/资产还要柱状图、折线图，提前统一基建 | 先自绘饼图 → 下一切片再引 echarts，重复劳动且两套视觉 |

## Design

### 信息架构

- 进入账本后：`记账`（既有明细）与 `预算`（新页）用同一套 `BookTabBar` 切换。
- 点 `概览` / `计划` / `资产`：进入未交付占位页并提示到电脑端；不置灰、不隐藏；小程序可用独立分包预留。
- 预算页：当年固定；汇总 + echarts 占比饼图（有 details 时）+ 卡片列表 + 底部「新增预算」。
- 图表：本切片只交付饼图；柱状图/折线图组件可预留封装位，实现可放到后续概览/资产规格。

### 数据与 API

- 读：`GET /budget/list?billId&date=YYYY` → `totalBudget` / `currCost` / `details[]`。
- 写：`POST/PUT/DELETE /budget`（字段与 PC 一致，见 contracts）。
- 新增可选类型：来自账本详情 `costTypes`（未隐藏），并排除当年 `details` 已占用的 `costTypeId`。
- 状态文案与色阶：客户端按 FR-004 区间计算（与原型/PC 展示逻辑对齐）。

### 下钻（澄清 B + A）

- 点击卡片非编辑/删除区域 → 打开 `record-search`，query 至少含：`billId`、`type=1`、`costTypeId`、`beginDate`、`endDate`（当年首末日）、`autoSearch=1`（或等价约定）。
- 搜索页 `onLoad`/`onMounted`：应用预填后立即执行既有搜索逻辑；无结果走既有空态。

### 文档

- 手册 + 宪章（FR-011）：能力表与正文改为小程序/H5 可查看与管理当年预算；仍标明类型配置、概览、计划、资产仅 PC；原则 II 改为预算可在 PC + H5 + 小程序管理，版本按治理 bump。

## Out of Scope

- 移动端概览、计划、家庭资产、类型配置、跨年切换器  
- PC 预算页 UI/流程改造  
- 新预算 API 或第二套预算存储  
- 恢复旧 `mobile/` 目录  
- 自动化全量单测强制覆盖  
