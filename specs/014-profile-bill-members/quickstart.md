# Quickstart: 014-profile-bill-members

## 前提

- 本机 `E:\my-codes\bill`  
- server：`cd server && pnpm dev`  
- PC：`cd frontend && pnpm dev`（通常 http://localhost:4000/）  
- 两个测试账号：A 创建账本并邀请，B 加入

## 验证昵称

1. A 登录 PC → 头像 → 修改个人信息 → 改昵称保存。  
2. 头像菜单立刻显示新名；刷新仍正确。  
3. 进入原账本，成员列表中 A 为新名。  
4. 小程序 A「我的」同样可改昵称。

## 验证退出

1. B 在 PC 账本卡片退出并确认 → 列表无该账本。  
2. A 打开成员管理 → 无 B。  
3. A 无「退出」；若调 API 退出自己 → 提示创建者不能退出。  
4. 小程序 B 账本列表退出同样生效。

## 验证移除

1. 再邀请 B 加入。  
2. A 成员管理移除 B → 成功。  
3. B 无法再进该账本。  
4. A 不能移除自己。
