# Windows 部署说明

适用于本机用官方 `nginx.exe` 包部署。

## 架构要点

- PC：`frontend/dist` → Nginx `/pc/`
- 移动端：`mobile/dist` → Nginx `/mobile/`
- API：Koa（`server`，默认 `127.0.0.1:3000`）→ Nginx `/api/`
- 生产前端 `VITE_BASEURL=""` / 移动端 `baseURL: ''`，与 Nginx 同源，不要把 `/api` 前缀用 `proxy_pass .../` 剥掉

## 目录结构

在 **nginx 安装根目录**（与 `nginx.exe` 同级）下放置前端产物：

```
nginx/                          ← 例如 D:\tools\nginx
├── conf/
│   ├── nginx.conf              ← 主配置
│   └── bill.conf               ← 从本项目 deploy/nginx.conf 复制过来
├── html/
│   └── bill/
│       ├── pc/                 ← frontend/dist 全部文件
│       └── mobile/             ← mobile/dist 全部文件
├── ssl/                        ← ssl 证书文件（模板使用 localhost.pem / localhost.key）
├── logs/
└── nginx.exe
```

后端 API 由 Node 提供，默认 `http://127.0.0.1:3000`。连接信息改 `server/config/db.js` 的 `MYSQL_CONF` / `REDIS_CONF`（无 `.env`）。

## 部署步骤

**1. 构建前端**

```bash
cd E:/my-codes/bill/frontend && pnpm build
cd E:/my-codes/bill/mobile && pnpm build
```

**2. 复制静态文件到 nginx**

```bash
# 将 D:\tools\nginx 替换为你的 nginx 安装路径
mkdir D:\tools\nginx\html\bill\pc
mkdir D:\tools\nginx\html\bill\mobile
xcopy /E /Y E:\my-codes\bill\frontend\dist\* D:\tools\nginx\html\bill\pc\
xcopy /E /Y E:\my-codes\bill\mobile\dist\* D:\tools\nginx\html\bill\mobile\
```

**3. 启用站点配置**

```bash
copy E:\my-codes\bill\deploy\nginx.conf D:\tools\nginx\conf\bill.conf
```

编辑 `conf/nginx.conf`，在 `http { ... }` 块**末尾**增加一行：

```nginx
include bill.conf;
```

**4. 启动后端**

确保本机 MySQL、Redis 已运行，并已填写 `server/config/db.js`。

```bash
cd E:/my-codes/bill/server
pnpm install
pnpm run prd
```

进程名：`bill-manage`（见 `server/pm2.conf.json`）。

**5. 启动 / 重载 Nginx**

在 nginx 安装目录打开终端：

```bash
cd D:\tools\nginx
nginx.exe -t
nginx.exe
# 修改配置后重载：
nginx.exe -s reload
# 停止：
nginx.exe -s stop
```

> Windows 下 Nginx 路径请使用**正斜杠** `/`，不要用反斜杠 `\`。

## 访问地址

当前 [nginx.conf](nginx.conf) 将 80 强制 301 到 HTTPS：

| 端 | 地址 |
|----|------|
| PC | https://localhost/pc/ |
| 移动端 | https://localhost/mobile/ |
| API | https://localhost/api/v1/... |

根路径 `/` 没有页面，请走 `/pc/` 或 `/mobile/`。
