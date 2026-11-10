# Research: 017-mobile-budget

## 1. 是否新增预算 API

**Decision**: 不新增公开接口；两端直接复用既有 `GET/POST/PUT/DELETE /api/v1/budget`（与 PC `frontend/src/views/budget/api.ts` 相同契约）。

**Rationale**:
- 规格 Assumptions 明确「复用既有预算契约，不发明第二套语义」。
- 服务端已做账本成员校验、同年同类型唯一、删除不影响记账。
- 移动端明细页已在用 `GET /budget/list` 算「剩余预算」，扩展 CRUD 成本最低。

**Alternatives considered**:
- 为移动端加 `/budget/mobile/*`：无新语义，违反原则 IV 与存量优先，拒绝。
- GraphQL/聚合接口一次返回类型+预算：可减请求，但超出切片且两端已有 `getBillDetail`，拒绝。

## 2. 账本内五入口实现方式

**Decision**: 使用**页面级自定义底栏组件**（H5：`BookTabBar.vue`；小程序：`components/book-tab-bar`），挂在 `bill-detail` 与 `budget`（及将来概览等）上；**不改**全局 `tabBar`（账本 / 记一笔 / 我的）。

**Rationale**:
- 原型的五入口是「进账本之后」的上下文导航，与主站三 tab 职责不同。
- 微信原生 `tabBar` 条目有限且与现网三入口冲突；强行改全局会破坏未进账本的主路径。
- 未交付的概览/计划/资产进入占位页并提示到电脑端；自定义底栏切换模块；小程序可按模块分包。

**Alternatives considered**:
- 改全局 tabBar 为五入口：破坏主站信息架构，拒绝。
- 仅在预算页显示底栏、明细页不显示：无法从记账切到预算，拒绝。
- 用原生全局 tabBar 承载账本五入口：与主站三 tab 冲突，拒绝；账本内自定义底栏 + 模块分包/占位页为预期。

## 3. 下钻目标：搜索页 + 自动搜索

**Decision**: 卡片空白处跳转两端既有「搜索记录」页；query 预填 `type=1`、`costTypeId`、当年 `beginDate`/`endDate`，并触发一次自动搜索（澄清 B→A）。不跳转账本明细列表。

**Rationale**:
- 澄清明确选择搜索页而非明细；自动搜索对齐「看进度→对流水」闭环与 SC-004。
- 两端 `record-search` 已具备分类/日期/类型筛选与空态，增量是「读 query + autoSearch」。

**Alternatives considered**:
- 打开明细并筛类型（接近 PC `jumpRecord` / 原型 toast 后 `go('detail')`）：澄清已否决。
- 仅预填不自动搜：澄清已否决。
- 打开记一笔预选类型：无法核对历史花费，拒绝。

## 4. 饼图与进度条技术选型

**Decision**: **引入 echarts** 做预算占比饼图；进度条仍用普通视图宽度百分比（封顶 100%）。  
- **mobile-h5**：直接依赖 `echarts`（版本对齐 PC，现网为 `^5.4.2`），预算页按需 `import`。  
- **miniapp**：引入微信侧 echarts 适配（如 `echarts-for-weixin` / `ec-canvas`），封装可复用的图表组件，本切片先用饼图。  
两端图表配置（series / legend / 颜色）尽量同构，便于后续概览、资产复用柱状图与折线图。

**Rationale**:
- 产品后续移动端概览、资产等会用到饼图、柱状图、折线图；本切片先落地图表基建，避免先自绘再整体替换。
- PC 已用 echarts，口径与视觉可控性更好，多端配置可对齐。
- 进度条与状态色阶仍按 FR-004 在客户端计算，不依赖图表库。

**Alternatives considered**:
- CSS `conic-gradient` / 自绘 canvas：本切片包体更小，但后续概览/资产仍要引入 echarts，等于做两套，拒绝。
- 本切片不做饼图：违反 FR-002，拒绝。

## 5. 年份与花费口径

**Decision**: 移动端固定当前自然年 `new Date().getFullYear()` 作为 `date`；展示 `totalBudget` / `currCost` / 各 `details.budget|cost`；不提供跨年切换。

**Rationale**: 规格与原型一致；与 PC 默认年口径一致即可满足 SC-003。花费由服务端预算详情派生，客户端不手算改写。

**Alternatives considered**:
- 移动端做年份选择器：规格明确另开，拒绝。
- 客户端自行按流水重算花费：易与 PC 漂移，拒绝。

## 6. 类型列表来源

**Decision**: 新增表单的可选支出类型 = 账本详情 `costTypes` 中未隐藏项，减去当年预算 `details` 已占用的 `costTypeId`。

**Rationale**: 与 PC 行为及 Edge Cases 一致；两端已有 `getBillDetail`。

**Alternatives considered**:
- 单独 billtype 列表接口：多余请求，拒绝。

## 7. 文档与宪章

**Decision**: 本交付同时更新 `docs/用户手册.md`（FR-011）与 `.specify/memory/constitution.md` 原则 II（预算三端可管理；概览/计划/类型/资产仍 PC），版本 bump。

**Rationale**: 宪章仍写「预算在电脑上操作」会导致后续 plan 的 Constitution Check 无法诚实通过；016 已有「产品落点变更同步宪章」先例。

**Alternatives considered**:
- 只改手册：宪章红灯残留，拒绝。

## 8. 后端改动边界

**Decision**: 默认零后端代码变更。若联调发现既有缺陷阻塞移动端（例如非当前公历年的花费回填边界），仅做最小兼容修复并在 tasks 单列，不借机重构。

**Rationale**: 原则 I；PC 已生产使用同一契约。

**Alternatives considered**:
- 借机重写 budget service：无规格授权，拒绝。
