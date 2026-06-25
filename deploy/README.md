# 生产环境部署说明

## Windows（官方 nginx.exe 包）

### 目录结构

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
├── ssl/                        ← ssl 证书文件
├── logs/
└── nginx.exe
```

后端 API 仍由 Node 提供，默认 `http://127.0.0.1:3000`。

### 部署步骤

**1. 构建前端**

```bash
cd E:/bill/frontend && pnpm build
cd E:/bill/mobile && pnpm build
```

**2. 复制静态文件到 nginx**

```bash
# 将 D:\tools\nginx 替换为你的 nginx 安装路径
mkdir D:\tools\nginx\html\bill\pc
mkdir D:\tools\nginx\html\bill\mobile
xcopy /E /Y E:\bill\frontend\dist\* D:\tools\nginx\html\bill\pc\
xcopy /E /Y E:\bill\mobile\dist\* D:\tools\nginx\html\bill\mobile\
```

**3. 启用站点配置**

```bash
copy E:\bill\deploy\nginx.conf D:\tools\nginx\conf\bill.conf
```

编辑 `conf/nginx.conf`，在 `http { ... }` 块**末尾**增加一行：

```nginx
include bill.conf;
```

**4. 启动后端**

```bash
cd E:/bill/server
pnpm install
npm run prd
```

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

### 访问地址

| 端 | 地址 |
|----|------|
| PC | http://localhost/ |
| 移动端 | http://localhost/mobile/ |
| API | http://localhost/api/v1/... |

### 上传目录（可选）

- **方案 A**：把 `server/uploads/` 内容同步到 `nginx/html/uploads/`
- **方案 B**：在 `bill.conf` 中取消注释「方案 B」，将 `alias` 改为你的项目路径，例如 `E:/bill/server/uploads/`

> Windows 下 Nginx 路径请使用**正斜杠** `/`，不要用反斜杠 `\`。

---

## Linux（参考）

```
/var/www/bill/
├── pc/          # frontend/dist
├── mobile/      # mobile/dist
└── uploads/     # 可选
```

将 [nginx-linux.conf](nginx-linux.conf) 复制到 `/etc/nginx/conf.d/bill.conf` 后 `nginx -t && systemctl reload nginx`。

后端：`cd server && npm run prd`（默认端口 3000）。
