# Data Model: 014-profile-bill-members

## users（已有）

| 字段 | 本功能 |
|------|--------|
| id | 身份 |
| username | 不改 |
| password | 不改 |
| nick_name | **可改** |
| avatar_url | 只读返回，不提供上传/编辑入口 |
| incomes / expenses | 只读展示 |
| is_del | 不改 |

校验（nick_name）：trim 后长度 1～20，`^[\u4E00-\u9FA5A-Za-z0-9_]+$`。

## bill_users（已有）

| 字段 | 本功能 |
|------|--------|
| bill_id + user_id | 成员关系主键语义 |
| user_name | 改昵称时按 user_id **全量更新**；退出/移除时删除整行 |

## bills（已有）

| 字段 | 本功能 |
|------|--------|
| creator | 退出/移除权限判定；不可通过本功能转移 |

## 状态转换

- 加入（已有）→ 成员  
- 成员 —退出→ 非成员（非创建者）  
- 成员 —被创建者移除→ 非成员  
- 创建者 —不可退出；移除自己/创建者拒绝  
- 删除账本（已有）仍仅创建者
