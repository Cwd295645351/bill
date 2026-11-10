# Implementation Plan: 移动端计划模块

**Branch**: `019-mobile-plan` | **Date**: 2026-11-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-mobile-plan/spec.md`

## Summary

在 **微信小程序** 与 **mobile-h5** 按 `prototypes/miniapp.html` 交付账本内「计划」一级能力：顶栏备忘说明、高 / 中 / 低三档分组列表、新增 / 编辑 / 删除（新建默认优先级「高」）。复用既有 `GET/POST/PUT/DELETE /api/v1/plan`，不新增计划语义与表。账本内底部五入口均展示；点「计划」进真实页；「概览 / 资产」小程序进未交付占位页，H5 继续 toast（不为 H5 新建占位路由）。同步修订用户手册，并 bump 宪章中「计划仅 PC」的过时表述。两端都完成才算本切片 Done；PC 计划主流程不改；不暴露「已购」入口；不实现概览 / 家庭资产 / 养老计划。

## Technical Context

**Language/Version**: TypeScript（server 已有计划路由；mobile-h5 Vue 3；miniapp 原生 TS）  
**Primary Dependencies**: 既有 `/api/v1/plan`；两端既有 `BookTabBar` / `book-tab-bar`；小程序已有 `packagePlan` 占位页；原型 `prototypes/miniapp.html` 计划屏交互基准；Vant / Vant Weapp 表单与对话框  
**Storage**: 既有 `bill_plan_buys`（经 `savePlanBuy`）；无新表、无迁移  
**Testing**: 手工验收（见 [quickstart.md](./quickstart.md)）；对照 contracts；回归 PC 计划与两端预算 / 明细 / 底栏  
**Target Platform**: 微信小程序 + mobile-h5 `/mobile/`；PC `/pc/` 仅回归  
**Project Type**: monorepo（miniapp + mobile-h5 + 共用 API；本切片不改 frontend 功能）  
**Performance Goals**: SC-001 进入账本后约 30 秒内看清某条计划（正常网络）  
**Constraints**: 复用计划契约；同档不重排；无移动端专属字数上限；不实现概览 / 资产业务；不恢复旧 `mobile/`；不发明第二套计划语义  
**Scale/Scope**: 两端各一计划页（小程序替换占位）；H5 路由 + API 客户端；底栏「计划」可导航；手册 + 宪章文档

## Constitution Check

*GATE: 对照 `.specify/memory/constitution.md`（v3.2.0；analyze 补救已 bump 原则 II）。*

| 原则 | 判定 | 说明 |
|------|------|------|
| I 存量优先 | 通过 | 新目录 `specs/019-*`；只扩移动端计划；PC / 概览 / 资产 / 类型配置不动；预算既有能力不动 |
| II 多端边界 | 通过 | v3.2.0 已写明计划可在 PC + mobile-h5 + 小程序管理；概览 / 类型配置 / 家庭资产仍以 PC 为准。交付仍须同步用户手册（FR-011 / T023） |
| III 账本隔离与权限 | 通过 | 继续账本成员读写、账本隔离；不削弱记账人 / 归属人规则；权限与 PC 一致（不按创建者细分） |
| IV 契约兼容 | 通过 | 复用既有 `/plan` CRUD；不删字段、不改响应形状；列表继续只消费服务端已过滤的可见条目 |
| V 密钥与部署 | 通过 | 无新密钥；路径仍 `/mobile/` 与小程序打 `/api` |

**Gate**：宪章原则 II 已对齐；**手册更新（T023）** 仍为交付硬门禁（SC-005 / FR-011）。未完成手册不得宣称交付完成。

### Post-Design Re-check

设计选定：零后端新接口；复用既有账本内底栏；小程序在 `packagePlan` 将占位改为真实 UI；H5 新增 `/bill/:id/plan` 并从 `BookTabBar` 导航；概览 / 资产保持「小程序占位 + H5 toast」。不恢复旧 `mobile/`、不引入平行业务栈。与 v3.2.0 宪章一致。Gate 在手册落地后完全关闭。

## Project Structure

### Documentation (this feature)

```text
specs/019-mobile-plan/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/plan-api.md
├── checklists/requirements.md
└── tasks.md                 # /speckit-tasks 生成，本命令不创建
```

### Source Code (repository root)

```text
# 后端：本切片默认不改（契约已足够）；仅当发现阻塞缺陷时做最小兼容修复并记入 tasks
server/routes/plan/            # 既有 list/add/edit/delete（只读参考）

mobile-h5/
├── src/api/plan.ts            # 新增：list/add/edit/delete
├── src/views/plan/PlanView.vue
├── src/components/BookTabBar.vue   # plan 从 PC_ONLY 移出，导航到 bill-plan
├── src/views/budget/BudgetView.vue # 底栏可切到计划（既有组件即可）
└── src/router/index.ts        # /bill/:id/plan

miniapp/
└── miniprogram/
    ├── apis/index.ts          # planList / planAdd / planEdit / planDelete
    ├── packagePlan/pages/plan/index.{ts,wxml,wxss,json}  # 占位 → 真实计划页
    └── components/book-tab-bar/   # 已指向 packagePlan；无需改路由表

docs/用户手册.md               # 去掉「计划仅 PC / 移动端不能管理」
.specify/memory/constitution.md # 原则 II：计划可三端；概览/类型/资产仍 PC
```

**Structure Decision**: 能力落在 `mobile-h5/` 与 `miniapp/packagePlan`；全局主 tab 仍为账本 / 记一笔 / 我的；账本内五入口为页面级自定义底栏（017 已落地）。不改 `frontend/` 计划页；不碰旧 `mobile/`。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| （已关闭）相对旧宪章「计划仅电脑」 | analyze 补救已 bump 至 v3.2.0；手册仍待 T023 | — |
| 两端各实现计划 UI | 澄清：两端都必须完成才算交付 | 只做一端 → 违反 FR-001 / US3 / SC-002 |
| H5 概览/资产仍 toast、小程序仍占位 | 澄清 A；缩小本切片变更面 | 本切片同时为 H5 补占位页 → 超出计划范围且无业务交付 |

## Design

### 信息架构

- 进入账本后：`记账` / `预算`（既有）与 `计划`（本切片）用同一套 `BookTabBar` 切换。
- 点 `概览` / `资产`：小程序进未交付占位页；H5 toast「请到电脑端查看或管理」；不置灰、不隐藏。
- 计划页：顶栏提示（不自动记账）+ 三档竖向分组（高红 / 中橙 / 低绿）+ 卡片（标题、内容、编辑、删除）+ 底部「新增计划」。
- 表单：标题、内容、优先级 chip；新建默认 `priority=1`（高）；弹层 / ActionSheet 风格对齐原型与现有移动端预算表单习惯。

### 数据与 API

- 读：`GET /plan/list?billId` → `count` / `details[]`（服务端已过滤 `isDel` 与 `isBuy`）。
- 写：`POST/PUT/DELETE /plan`（字段与 PC 一致，见 contracts）。
- 客户端分组：按 `priority` 1/2/3 分桶；**同档内保持 `details` 遍历顺序**，不按时间或标题重排。
- 校验：标题 / 内容 trim 后非空；无移动端专属字数上限；优先级必须为 1|2|3。

### 文档

- 手册（FR-011 / T023）：能力表与正文改为小程序 / H5 可查看与管理计划；仍标明类型配置、概览分摊、家庭资产仅 PC。宪章原则 II 已于 analyze 补救 bump 至 3.2.0。

## Out of Scope

- 移动端概览、家庭资产、资产内「养老计划」、类型配置  
- PC 计划页 UI / 流程改造（含默认优先级若仍为高则保持；不强制改 PC）  
- 「已购」标记入口与第二套计划存储 / API  
- 为 H5 新建概览 / 资产占位路由  
- 恢复旧 `mobile/` 目录  
- 自动化全量单测强制覆盖  
