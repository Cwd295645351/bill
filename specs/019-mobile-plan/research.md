# Research: 019-mobile-plan

## 1. 是否新增计划 API

**Decision**: 不新增公开接口；两端直接复用既有 `GET/POST/PUT/DELETE /api/v1/plan`（与 PC `frontend/src/views/plan/api.ts` 相同契约）。

**Rationale**:
- 规格 Assumptions 明确「复用既有计划契约，不发明第二套语义」。
- 服务端已做账本成员校验、标题/内容/优先级必填、逻辑删除、列表过滤 `isDel`/`isBuy`。
- PC 已稳定使用该契约；移动端只补客户端封装与 UI。

**Alternatives considered**:
- 为移动端加 `/plan/mobile/*`：无新语义，违反原则 IV 与存量优先，拒绝。
- 扩展返回「创建者」等字段供移动端展示：规格未要求，拒绝。

## 2. 账本内五入口与两端导航差异

**Decision**:
- 继续使用 017 已落地的**页面级自定义底栏**（H5 `BookTabBar.vue`；小程序 `components/book-tab-bar`）。
- **小程序**：`plan` 路由已指向 `packagePlan/pages/plan`；本切片把占位页换成真实计划 UI，底栏路由表基本不动。
- **H5**：将 `plan` 从 `PC_ONLY` 移出，`router.replace` 到新建 `bill-plan`（`/bill/:id/plan`）；`overview` / `asset` 仍 toast。

**Rationale**:
- 澄清确认：H5 概览/资产继续 toast，不为 H5 补占位页；小程序继续占位页。
- 与预算切片信息架构一致，用户已熟悉五入口。

**Alternatives considered**:
- 本切片同时为 H5 做概览/资产占位页：澄清已选 A 拒绝。
- 改全局 tabBar：破坏主站三入口，拒绝。

## 3. 新建默认优先级

**Decision**: 移动端新建表单默认 `priority = 1`（高），与当前 PC `use-add-info` 重置值一致；**不**跟原型默认「中」。本切片不改 PC。

**Rationale**: 澄清明确选 B，避免「对齐 PC」在默认值上再分叉。

**Alternatives considered**:
- 跟原型默认中：澄清已否决。
- 无默认强制手选：增加摩擦且与 PC 不一致，拒绝。

## 4. 同档排序

**Decision**: 客户端按 `details` 数组顺序分入三档；同档内**保持 push 顺序**（即服务端返回顺序），不做时间/标题重排。

**Rationale**: 澄清选 A；PC `use-list` 即按 `details.forEach` 分桶；SC-003 要求同档相对顺序一致。

**Alternatives considered**:
- 最新在上 / 标题排序：造成与 PC 对照失败，拒绝。

## 5. 字段校验与字数

**Decision**: 客户端仅校验标题、内容 trim 后非空，以及优先级 ∈ {1,2,3}；**不设**移动端专属字数上限。展示层可做换行/截断样式，但不因此拒收保存。

**Rationale**: 澄清选 A；与 PC 表单规则一致。库表虽有 `title` STRING(255) / `context` TEXT，属既有后端边界，不在本切片另发明前端专属上限文案。

**Alternatives considered**:
- 移动端 20/100 或 50/200 字上限：澄清已否决。

## 6. 「已购」与列表可见范围

**Decision**: 移动端不提供「已购」操作；列表完全信任 `GET /plan/list` 已过滤结果（现网过滤 `isDel` 与 `isBuy`）。不在客户端二次发明过滤规则。

**Rationale**: FR-010 与 Edge Cases；与 PC 当前用户可见能力对齐。

**Alternatives considered**:
- 移动端增加「标记已购」：规格明确禁止，拒绝。

## 7. UI 形态（表单 / 删除）

**Decision**:
- 列表：三档竖向分区 + 卡片，对齐原型（非 PC 三列横排）。
- 新增/编辑：底部弹层或等价表单（标题输入、内容输入、优先级 chip）。
- 删除：二次确认对话框；取消不删。
- 成功/失败：toast 展示服务端或本地校验文案。

**Rationale**: 规格 Assumptions 与原型一致；复用两端预算页已有的弹层/对话框模式，降低学习与实现成本。

**Alternatives considered**:
- 独立全屏编辑页：可做但本切片非必须，原型为 sheet，拒绝优先。

## 8. 文档与宪章

**Decision**: 本交付同时更新 `docs/用户手册.md`（FR-011）与 `.specify/memory/constitution.md` 原则 II（计划三端可管理；概览 / 类型配置 / 家庭资产仍 PC），版本 bump（建议 MINOR 3.1.0 → 3.2.0）。

**Rationale**: 与 017 预算先例一致；否则 SC-005 / Gate 失败。

**Alternatives considered**:
- 只改手册不改宪章：治理不允许，拒绝。
