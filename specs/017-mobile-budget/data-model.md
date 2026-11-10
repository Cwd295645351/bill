# Data Model: 017-mobile-budget

本特性**无新 MySQL 表**；复用账本内既有年度预算结构（经 `billService.saveBudget` 持久化）。下列为客户端与契约使用的逻辑模型。

## 实体：年度预算汇总（YearBudget）

对应 `GET /budget/list` 在指定 `billId + date(年)` 下的返回体。

| 字段 | 类型 | 说明 |
|------|------|------|
| date | number（逻辑年） | 请求参数；页面固定当前自然年 |
| totalBudget | number | 当年各类型预算金额合计 |
| currCost | number | 当年已发生支出合计（年度支出） |
| details | BudgetDetail[] | 按支出类型的预算条目；可空 |

**空态**: `details` 为空或不存在时，UI 显示「今年还没有预算」，不展示饼图。

## 实体：预算条目（BudgetDetail）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 编辑/删除主键；列表返回后必须保留 |
| costTypeId | string | 支出类型 ID；新增后不可改 |
| costTypeName | string | 展示名；类型改名由既有 PC/后端同步 |
| budget | number | 预算金额；必须 > 0 |
| cost | number | **派生**：该年该类型已发生支出合计；非用户手填 |

### 校验规则（与现网一致）

- 同一 `billId + date + costTypeId` 最多一条；重复新增 → 服务端拒绝（如「已存在相关预算」）。
- `money` / `budget` 必须为正数；≤0 客户端拦截，服务端亦应拒绝空/非法。
- 删除条目只移除预算行，**不**删除或修改 `transaction`。
- 仅账本成员可读写；非成员 → 服务端错误。

### 客户端派生（展示）

| 派生项 | 规则 |
|--------|------|
| 进度比例 | `cost / budget`；预算为 0 时按 0 处理（正常路径预算 > 0） |
| 进度条宽度 | `min(比例, 1) * 100%` |
| 状态文案/色 | FR-004：&lt;25% 较宽裕；25%～50% 正常；50%～75% 注意节奏；75%～90% 接近上限；≥90% 即将或已经超支 |
| 饼图切片 | 各 `budget` 占 `totalBudget` 比例；仅当有 details 时渲染 |

## 实体：支出类型（CostType，只读复用）

来自账本详情 `costTypes`。

| 规则 | 说明 |
|------|------|
| 可用于新增 | 未隐藏，且当年尚无对应 BudgetDetail |
| 已隐藏 | 不可出现在新增列表；已有预算条目仍可编辑金额/删除 |

## 实体：账本（Bill）

预算按账本隔离；页面始终带 `billId`。本切片不改变成员/邀请模型。

## 下钻查询（SearchPrefill，非持久化）

从预算卡片进入搜索页时的瞬时参数：

| 字段 | 值 |
|------|-----|
| billId | 当前账本 |
| type | `1`（支出） |
| costTypeId / 分类 | 该预算的支出类型 |
| beginDate | 当前自然年 01-01 |
| endDate | 当前自然年 12-31 |
| autoSearch | 是（进入即搜） |

## 关系

```text
Bill 1 ── * YearBudget(date)
              └── * BudgetDetail ── 1 CostType
Transaction(type=支出, costTypeId, date∈年) ──派生──> BudgetDetail.cost
```

## 状态与生命周期

```text
[无该年条目] --新增--> [有 BudgetDetail]
[有 BudgetDetail] --改金额--> [有 BudgetDetail]（cost 不变除非流水变化）
[有 BudgetDetail] --确认删除--> [移除该 detail；记账不变]
```

无独立「草稿」持久化；表单取消即丢弃。
