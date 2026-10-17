# 部署文档

部署说明和 Nginx 配置都放在本目录。仓库根目录的 [readme.md](../readme.md) 只保留项目简介和入口链接。

| 文档 | 说明 |
|------|------|
| [linux.md](linux.md) | Linux / 腾讯云 Ubuntu 完整部署 |
| [windows.md](windows.md) | Windows 官方 nginx.exe 本机部署 |
| [nginx-linux.conf](nginx-linux.conf) | Linux Nginx 模板 |
| [nginx.conf](nginx.conf) | Windows Nginx 模板 |
| [sql/](sql/) | 已上线环境的数据库升级、回滚脚本 |

## 微信小程序

小程序源码在仓库 `miniapp/`，不经过 Nginx 托管静态页，只请求现有 `/api`。

1. 服务器 `.env`（或进程环境变量）增加 `WX_APPID`、`WX_SECRET`，重启 `bill-manage`。`sequelize.sync()` 会自动创建 `user_wechats` 表。
2. 确认 Nginx 已启用 HTTPS，且证书域名已完成 ICP 备案。
3. 微信公众平台 -> 开发管理 -> 服务器域名，将 `request`、`uploadFile`、`downloadFile` 合法域名都填现有接口的 HTTPS 域名（与 `request` 相同，不带路径和端口）。不要把对象存储域名写进该步骤。
4. 复制 `miniapp/.env.example` 为 `miniapp/.env`，把 `MINIAPP_BASE_URL` 写成 `https://你的域名`，在 `miniapp` 目录执行 `npm run sync-env`。`project.config.json` 的 `appid` 改成正式 AppID。`.env` 与生成的 `env.local.ts` 不要提交。
5. 用微信开发者工具打开 `miniapp/`，菜单「工具 -> 构建 npm」，上传体验版。开发版可在工具中勾选「不校验合法域名」，直连本机 `http://127.0.0.1:3000`。
6. 服务端 `.env` 配置 `OSS_REGION`、`OSS_BUCKET`、`OSS_ACCESS_KEY_ID`、`OSS_ACCESS_KEY_SECRET`、`OSS_URL_SECRET`（只放服务端，禁止提交真实密钥），重启后 `sequelize.sync()` 会创建 `transaction_images` 表。

## 数据库升级脚本

`sequelize.sync()` 只会新建缺失的表，不会修改已有表的列。已上线的库改列时，要先手工执行 `sql/` 下的脚本，再发布新代码。全新安装的环境由 `sync()` 直接按模型建表，不需要执行。

### 004 支出归属人支持多选

| 脚本 | 作用 |
|------|------|
| [sql/004-multi-belong-users-upgrade.sql](sql/004-multi-belong-users-upgrade.sql) | `transactions.belong_user_id` 加宽到 1024，`belong_user_name` 加宽到 2048，不改数据，可重复执行 |
| [sql/004-multi-belong-users-rollback.sql](sql/004-multi-belong-users-rollback.sql) | 多人归属降级为「全部」，再把两列改回 36、64 |

发布顺序（不能调换）：

1. 备份 `transactions` 表。
2. 执行升级脚本，用脚本末尾的查询核对两列长度为 1024、2048。
3. 发布服务端和电脑端（电脑端是静态页，必须和服务端一起上线）。
4. 立即提交小程序新版本审核并发布。新版本启动时会强制更新。

先发代码、后执行脚本时，记一笔多人支出会因为超出列长度而失败。

这一版接口删掉了旧的 `belongUserId` 字段：服务端上线后，旧版本小程序再新增、编辑记账会被拒绝，提示「当前版本过旧，请更新后再记账」。从服务端上线到小程序审核通过，旧版本小程序暂时不能记账，这是预期行为。

回滚必须成套进行：

- 小程序新版本**发布前**，可以单独回滚服务端和电脑端。
- 小程序新版本**发布后**，要回滚服务端，必须同时在微信公众平台把小程序回退到旧版本。只回滚服务端时，新版本小程序只发新字段，旧服务端读不到，单人支出会被存成「全部」。
- 回滚数据库：先回退代码，再导出多人归属的行（脚本注释里有查询），然后执行回滚脚本。回滚后这些记账会变成按全员比例分摊。
