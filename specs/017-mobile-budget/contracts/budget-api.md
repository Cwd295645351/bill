# API Contracts: 017-mobile-budget

Base: `/api/v1`。本切片**复用**既有预算接口，形状与 PC 对齐；下列为移动端必须遵守的契约摘要。鉴权：需登录；`userid` 请求头与现网一致。

## `GET /budget/list`

查询某账本某自然年预算。

**Query**:

| 参数 | 必填 | 说明 |
|------|------|------|
| billId | 是 | 账本 ID |
| date | 是 | 四位年份，如 `2026` |

**Success** `retCode: 0`，`data` 至少包含：

```json
{
  "totalBudget": 12000,
  "currCost": 3500.5,
  "details": [
    {
      "id": "detail-id",
      "costTypeId": "type-id",
      "costTypeName": "餐饮",
      "budget": 3000,
      "cost": 1200.5
    }
  ]
}
```

- 无该年数据时：允许返回 `totalBudget: 0`、`currCost: 0`、`details: []`（或等价空列表）。
- 移动端 UI **必须**消费 `details`（明细页现有调用可继续只读汇总字段）。

**Errors**: 账本不存在、非成员、缺参、年份不规范。

---

## `POST /budget`

新增当年某支出类型预算。

**Body**:

```json
{
  "billId": "…",
  "date": 2026,
  "costTypeId": "…",
  "money": 3000
}
```

**Success** `retCode: 0`：新增成功（data 可空）。

**Errors**（客户端需可展示服务端 `message`，不做文案改写）: 缺参、非成员、金额非法、该年该类型已存在（现网文案「已存在相关预算」）。

---

## `PUT /budget`

编辑已有预算金额（不可改类型）。

**Body**:

```json
{
  "id": "detail-id",
  "billId": "…",
  "date": 2026,
  "money": 3500
}
```

**Success** `retCode: 0`。

**Errors**: id 不存在、非成员、缺参、金额非法。

---

## `DELETE /budget`

删除预算条目。

**Query**: `id`、`billId`、`date`（与现网一致）。

**Success** `retCode: 0`。删除**不得**导致记账明细被删。

**Errors**: id 不存在、非成员、缺参。

---

## 关联只读（非本模块新契约）

| 用途 | 接口 |
|------|------|
| 可选支出类型、成员 | 既有账本详情（如 `GET` 账本详情） |
| 下钻搜索结果 | 既有记账列表/搜索接口（`record-search` 页已用） |

本切片不修改上述接口形状。

---

## 客户端 UI 契约（非 HTTP）

### 账本内底栏

- 五项：记账 / 概览 / 预算 / 计划 / 资产；当前页高亮。
- 概览、计划、资产：点击 → 进入未交付占位页并提示到电脑端；不置灰不隐藏；不得宣称业务已交付。

### 搜索下钻

从预算进入搜索页时，客户端路由/query 须能表达：

| 逻辑字段 | 要求 |
|----------|------|
| billId | 当前账本 |
| type | 支出 |
| costTypeId | 卡片对应类型 |
| beginDate / endDate | 当前自然年首末日，格式 `YYYY-MM-DD`（如 `2026-01-01`～`2026-12-31`） |
| autoSearch | `1` 表示进入后自动执行一次搜索 |

具体 query 键名由两端实现统一（tasks T012）：`billId`、`type`、`costTypeId`、`beginDate`、`endDate`、`autoSearch`。页面标题可沿用现网「搜索记账」等文案；验收以 FR-007 行为为准：预填正确且无需再点「搜索」即出结果或空态。
