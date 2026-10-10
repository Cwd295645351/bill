# 部署文档

部署说明和 Nginx 配置都放在本目录。仓库根目录的 [readme.md](../readme.md) 只保留项目简介和入口链接。

| 文档 | 说明 |
|------|------|
| [linux.md](linux.md) | Linux / 腾讯云 Ubuntu 完整部署 |
| [windows.md](windows.md) | Windows 官方 nginx.exe 本机部署 |
| [nginx-linux.conf](nginx-linux.conf) | Linux Nginx 模板 |
| [nginx.conf](nginx.conf) | Windows Nginx 模板 |

## 微信小程序

小程序源码在仓库 `miniapp/`，不经过 Nginx 托管静态页，只请求现有 `/api`。

1. 服务器 `.env`（或进程环境变量）增加 `WX_APPID`、`WX_SECRET`，重启 `bill-manage`。`sequelize.sync()` 会自动创建 `user_wechats` 表。
2. 确认 Nginx 已启用 HTTPS，且证书域名已完成 ICP 备案。
3. 微信公众平台 -> 开发管理 -> 服务器域名，将 `request`、`uploadFile`、`downloadFile` 合法域名都填现有接口的 HTTPS 域名（与 `request` 相同，不带路径和端口）。不要把对象存储域名写进该步骤。
4. 复制 `miniapp/.env.example` 为 `miniapp/.env`，把 `MINIAPP_BASE_URL` 写成 `https://你的域名`，在 `miniapp` 目录执行 `npm run sync-env`。`project.config.json` 的 `appid` 改成正式 AppID。`.env` 与生成的 `env.local.ts` 不要提交。
5. 用微信开发者工具打开 `miniapp/`，菜单「工具 -> 构建 npm」，上传体验版。开发版可在工具中勾选「不校验合法域名」，直连本机 `http://127.0.0.1:3000`。
6. 服务端 `.env` 配置 `OSS_REGION`、`OSS_BUCKET`、`OSS_ACCESS_KEY_ID`、`OSS_ACCESS_KEY_SECRET`、`OSS_URL_SECRET`（只放服务端，禁止提交真实密钥），重启后 `sequelize.sync()` 会创建 `transaction_images` 表。
