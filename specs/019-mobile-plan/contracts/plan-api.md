# API Contracts: 019-mobile-plan

Base: `/api/v1`。本切片**复用**既有计划接口，形状与 PC 对齐；下列为移动端必须遵守的契约摘要。鉴权：需登录；`userid` 请求头与现网一致。

## `GET /plan/list`

查询某账本可见计划列表。

**Query**:

| 参数 | 必填 | 说明 |
|------|------|------|
| billId | 是 | 账本 ID |

**Success** `retCode: 0`，`data` 至少包含：

```json
{
  "count": 2,
  "details": [
    {
      "id": "plan-id",
      "title": "换洗衣机",
      "context": "想换一台洗烘一体",
      "priority": 1
    }
  ]
}
```

- 服务端返回的 `details` **仅含**未删除且未「已购」的条目；客户端 MUST 按数组顺序消费，MUST NOT 再按时间 / 标题排序。
- 无可见计划时：允许 `count: 0`、`details: []`（或等价空列表）。
- 字段 `isBuy` / `isDel` 若出现在响应中，移动端展示可忽略；不得据此在本切片提供「已购」操作。

**Errors**: 账本不存在、非成员、缺参。

---

## `POST /plan`

新增计划。

**Body**:

```json
{
  "billId": "…",
  "title": "换洗衣机",
  "context": "想换一台洗烘一体",
  "priority": 1
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| billId | 是 | 账本 ID |
| title | 是 | 非空标题 |
| context | 是 | 非空内容 |
| priority | 是 | `1` 高 / `2` 中 / `3` 低；新建 UI 默认传 `1` |

**Success** `retCode: 0`：新增成功（data 可空或为 true）。

**Errors**（客户端需可展示服务端 `message`）: 缺参、非成员、标题/内容/优先级为空。

---

## `PUT /plan`

编辑已有计划。

**Body**:

```json
{
  "id": "plan-id",
  "billId": "…",
  "title": "周末短途",
  "context": "还没定日期",
  "priority": 2
}
```

**Success** `retCode: 0`。

**Errors**: id 不存在、非成员、缺参、标题/内容/优先级为空。

---

## `DELETE /plan`

删除计划（逻辑删除，不可恢复）。

**Query**: `id`、`billId`（与现网一致）。

**Success** `retCode: 0`。删除**不得**导致记账明细被删。

**Errors**: id 不存在、非成员、缺参。

---

## 客户端约定（非新 HTTP 契约）

| 约定 | 说明 |
|------|------|
| 分组 | `priority` → 高/中/低三档；三档始终渲染 |
| 同档顺序 | 保持 list `details` 顺序 |
| 默认优先级 | 新建表单默认 `1` |
| 字数 | 除非空外不设移动端专属上限 |
| 已购 | 本切片不调用、不暴露标记已购的接口能力 |

## 兼容性

- 本切片**不修改**服务端路由与响应形状。
- 若联调发现阻塞缺陷，允许最小兼容修复，但不得引入第二套计划语义；修复须记入 tasks 并回归 PC。
