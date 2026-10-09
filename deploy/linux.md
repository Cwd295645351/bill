# 记账管理系统部署文档

**Vue 3（PC + 移动端）+ Koa 2 + MySQL + Redis**，通过 Nginx 托管静态资源并反向代理 API。

适用于 **Ubuntu 22.04 LTS**（腾讯云等）。其他发行版请将 `apt` 换成对应包管理器。

---

## 目录

1. [架构与目录](#1-架构与目录)
2. [系统准备](#2-系统准备)
3. [安装 Node.js 与 pnpm](#3-安装-nodejs-与-pnpm)
4. [安装 MySQL](#4-安装-mysql)
5. [安装 Redis](#5-安装-redis)
6. [安装 Nginx](#6-安装-nginx)
7. [上传代码](#7-上传代码)
8. [配置数据库连接](#8-配置数据库连接)
9. [本地构建并推送前端](#9-本地构建并推送前端)
10. [启动后端（PM2）](#10-启动后端pm2)
11. [配置 Nginx](#11-配置-nginx)
12. [开放防火墙端口](#12-开放防火墙端口)
13. [验证部署](#13-验证部署)
14. [后续维护](#14-后续维护)
15. [常见问题排查](#常见问题排查)

---

## 1. 架构与目录

仓库由三个独立包组成：

| 本地目录 | 说明 | 服务器落点 |
|----------|------|------------|
| `frontend/` | PC 端，**源码留在本地** | `frontend/dist` → `/var/www/bill/pc/` |
| `mobile/` | 移动端 H5，**源码留在本地** | `mobile/dist` → `/var/www/bill/mobile/` |
| `server/` | 后端 API（Koa 2） | `~/bill/server/`，PM2 进程 `bill-manage`，端口 `3000` |
| `deploy/nginx-linux.conf` | Nginx 模板 | `~/bill/nginx-linux.conf`，再拷到 `/etc/nginx/conf.d/bill.conf` |

下文路径均按腾讯云 Ubuntu 默认用户 `ubuntu` 书写：`~` 即 `/home/ubuntu`。

```
开发机（源码仓库，例如 E:\my-codes\bill）
├── frontend/                 # 只在本地构建
├── mobile/
├── server/
└── deploy/nginx-linux.conf

服务器
├── /home/ubuntu/bill/        # 即 ~/bill
│   ├── server/               # 后端源码
│   ├── backup/               # mysqldump
│   └── nginx-linux.conf      # 从本地 deploy/ 上传
├── /var/www/bill/
│   ├── pc/                   # 本地 frontend/dist
│   └── mobile/               # 本地 mobile/dist
└── /etc/nginx/conf.d/bill.conf
```

访问关系：

- `https://你的域名/pc/` → `/var/www/bill/pc/`
- `https://你的域名/mobile/` → `/var/www/bill/mobile/`
- `https://你的域名/api/v1/...` → Nginx 反代到 `127.0.0.1:3000`

生产环境前端与 API **同源**：`frontend/.env.production` 中 `VITE_BASEURL=""`，`mobile/public/config.js` 中 `baseURL: ''`（回落到 `location.origin`），请求走 `/api`，由 Nginx 转发，无需再让 Koa 提供静态页。

运行时依赖：

- **MySQL**：业务数据（库名默认 `bill`，启动时会自动建库并 `sync` 表结构）
- **Redis**：Session 存储（`~/bill/server/app.js` 通过 `koa-redis` 连接）

Node 版本：**18 及以上**，包管理器：**pnpm**。

---

## 2. 系统准备

腾讯云 Ubuntu 镜像通常**禁止 root SSH**，用 `ubuntu` 账号登录即可。需要管理员权限时在命令前加 `sudo`（会提示输入 ubuntu 的密码），不必也不应切到 root 登录。

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget vim unzip
```

## 3. 安装 Node.js 与 pnpm

推荐用 `nvm` 安装 Node.js，再全局安装 pnpm。

```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

# 安装 Node 18 LTS 或更高
nvm install 18
nvm alias default 18

# 验证
node -v   # 应 >= v18
npm -v

# 安装 pnpm
npm install -g pnpm
pnpm -v
```

## 4. 安装 MySQL

```bash
sudo apt install -y mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql
sudo mysql_secure_installation
```

按提示操作：

- 设置 root 密码（**记好**）
- 移除匿名用户 → `Y`
- 禁止 root 远程登录 → `Y`
- 移除测试数据库 → `Y`
- 刷新权限 → `Y`

建议单独建一个业务账号（不要用 root 跑应用）：

```sql
sudo mysql -u root -p
CREATE USER 'bill'@'localhost' IDENTIFIED BY '你的强密码';
GRANT ALL PRIVILEGES ON bill.* TO 'bill'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

库名 `bill` 可在首次启动后端时自动创建，也可手动执行：

```sql
CREATE DATABASE IF NOT EXISTS bill CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

> 若需要远程连 MySQL（不推荐），再改 `bind-address` 并放行安全组。

## 5. 安装 Redis

后端 Session 依赖 Redis，必须安装并保持运行。

```bash
sudo apt install -y redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server   # Ubuntu 上 redis.service 只是别名，enable 必须用 redis-server
redis-cli ping   # 应返回 PONG
```

默认无密码即可，与 `server/.env` 未设置 `REDIS_HOST` / `REDIS_PORT` 时的默认值（`127.0.0.1:6379`）一致。若开启 `requirepass`，需同步改后端连接配置。

## 6. 安装 Nginx

```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
sudo systemctl status nginx
```

此时访问公网 IP 应能看到 Nginx 默认页。

## 7. 上传代码

**前端源码不放到服务器**。后端和配置在 `~/bill/`，前端静态包在 `/var/www/bill/`。

```bash
mkdir -p ~/bill/server ~/bill/backup
sudo mkdir -p /var/www/bill/pc /var/www/bill/mobile
# /var/www 属 root，改给当前用户后 SFTP 才能上传
sudo chown -R "$USER:$USER" /var/www/bill
```

用 Tabby SFTP：

- 本地 `server/`（不要带 `node_modules`、`logs`）→ `~/bill/server/`
- 本地 `deploy/nginx-linux.conf` → `~/bill/nginx-linux.conf`
- 前端 `dist` 见第 9 节 → `/var/www/bill/pc/`、`/var/www/bill/mobile/`

依赖在服务器上执行：

```bash
cd ~/bill/server
pnpm install
```

前端静态包见 [第 9 节](#9-本地构建并推送前端)。

## 8. 配置数据库连接

数据库账号和密钥都写在 **`~/bill/server/.env`**。`MYSQL_USER`、`MYSQL_PASSWORD` 必填。`JWT_SECRET`、`PASSWORD_SALT`、`AES_KEY`、`AES_IV` 也必填（后两项各 16 字节）。主机、端口、库名不填时分别为 `127.0.0.1`、`3306`、`bill`：

```dotenv
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=bill
MYSQL_PASSWORD=你的强密码
MYSQL_DATABASE=bill
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

首次启动时 `~/bill/server/database/index.js` 会：

1. `CREATE DATABASE IF NOT EXISTS bill`
2. `sequelize.authenticate()`
3. `sequelize.sync()` 建表

若 MySQL 连不上，进程会直接退出。

## 9. 本地构建并推送前端

在**开发机**上构建，不要把 `frontend/`、`mobile/` 源码放到服务器。

仓库根目录的 `pnpm run install_all` **只安装** `frontend` 和 `server`，移动端需单独安装。

```bash
# 以下均在本地仓库根目录执行
pnpm install --prefix frontend
pnpm install --prefix mobile

cd frontend && pnpm build   # 产物 frontend/dist
cd ../mobile && pnpm build  # 产物 mobile/dist
```

构建前确认生产配置：

- PC：`frontend/.env.production` 保持 `VITE_BASEURL=""`、`VITE_VERSION="v1"`
- 移动端：`mobile/public/config.js` 保持 `baseURL: ''`、`version: 'v1'`
- 两个前端的 Vite `base` 均为 `./`，可挂在 `/pc/`、`/mobile/` 子路径下

把 `dist` 推到 `/var/www/bill/pc/`、`/var/www/bill/mobile/`（与 `deploy/nginx-linux.conf` 一致）。目录已在第 7 节建好则跳过：

```bash
sudo mkdir -p /var/www/bill/pc /var/www/bill/mobile
sudo chown -R "$USER:$USER" /var/www/bill
```

本机用 rsync / scp / SFTP 上传 **dist 目录内的文件**（不是整个 frontend 工程）：

```bash
# 在开发机仓库根目录执行，公网 IP 换成实际值
rsync -a --delete frontend/dist/ ubuntu@公网IP:/var/www/bill/pc/
rsync -a --delete mobile/dist/   ubuntu@公网IP:/var/www/bill/mobile/
```

也可用 Tabby SFTP：本地 `frontend/dist/*` → `/var/www/bill/pc/`，本地 `mobile/dist/*` → `/var/www/bill/mobile/`。上传后确认目录里有 `index.html`。

## 10. 启动后端（PM2）

`server` 已把 `pm2` 作为依赖，生产脚本会读取 `~/bill/server/pm2.conf.json`。

```bash
cd ~/bill/server
pnpm install

# 可选：先手动跑一次确认能连上 MySQL / Redis
pnpm start            # 等价于 node bin/www，默认端口 3000
# 正常后 Ctrl+C 停止

# 生产守护进程（进程名 bill-manage，入口 server.js → bin/www）
pnpm run prd
```

`pnpm run prd` 实际执行：`cross-env NODE_ENV=production pm2 start pm2.conf.json`。

常用命令：

```bash
npx pm2 status
npx pm2 logs bill-manage
npx pm2 restart bill-manage
npx pm2 save
npx pm2 startup          # 开机自启，按提示复制执行生成的命令
```

日志文件：`~/bill/server/logs/err.log`、`~/bill/server/logs/out.log`；生产访问日志：`~/bill/server/logs/access.log`。

> 不要用 `pm2 start app.js --name koa-api`。正确入口是 `server.js`，进程名是 `bill-manage`。

## 11. 配置 Nginx

仓库已提供 Linux 模板：[nginx-linux.conf](nginx-linux.conf)。

行为：

- `80` → `301` 跳转到 HTTPS
- `443` 提供站点
- `/pc/` → `/var/www/bill/pc/`
- `/mobile/` → `/var/www/bill/mobile/`
- `/api/` → `http://127.0.0.1:3000`（**不要**改成 `http://localhost:3000/` 带尾斜杠的写法，否则会把 `/api` 前缀剥掉）

将本地 `deploy/nginx-linux.conf` 先传到 `~/bill/nginx-linux.conf`，再拷进 Nginx 配置目录：

```bash
sudo cp ~/bill/nginx-linux.conf /etc/nginx/conf.d/bill.conf
sudo vim /etc/nginx/conf.d/bill.conf
```

必须修改：

1. 两处 `server_name localhost;` 改成你的域名或公网 IP
2. `ssl_certificate` / `ssl_certificate_key` 改成真实证书路径（模板里的 `../ssl/localhost.pem` 是本机示例，Linux 上不可直接用）

启用站点并重载：

```bash
# 若存在 default 站点且占用 80/443，可先关掉以免冲突
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl reload nginx
```

### SSL（Let's Encrypt）

有域名时：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your_domain.com
```

证书路径一般是：

```nginx
ssl_certificate     /etc/letsencrypt/live/your_domain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/your_domain.com/privkey.pem;
```

暂无证书、需要先用 HTTP 验证时：删掉 80 端口的 `return 301`，把 443 的 `server` 改成 `listen 80;` 并去掉全部 `ssl_*`，验证通过后再切回 HTTPS。

## 12. 开放防火墙端口

腾讯云控制台 → 安全组中放行：

| 端口 | 用途 | 建议 |
|------|------|------|
| 22 | SSH | 已开 |
| 80 | HTTP（跳转 HTTPS / 申请证书） | 必须开 |
| 443 | HTTPS | 必须开 |
| 3000 | Koa | **不要对公网开放**，只给本机 Nginx 反代 |

## 13. 验证部署

1. 浏览器打开 `https://你的域名/pc/`，应看到 PC 端页面。
2. 打开 `https://你的域名/mobile/`，应看到移动端页面。
3. 开发者工具 → Network：登录等请求应为 `/api/v1/common/...`，状态码正常。
4. 出 404 / 502 时检查：
   - `sudo nginx -t` 与站点是否生效
   - `npx pm2 status`（在 `~/bill/server` 下）进程是否 online
   - `npx pm2 logs bill-manage`
   - 安全组是否放行 80/443
   - `~/bill/server/.env` 中的 `MYSQL_USER` / `MYSQL_PASSWORD`、Redis 是否可达

## 14. 后续维护

### 代码更新

```bash
# 前端：开发机仓库根目录重新 pnpm build，再覆盖静态目录
rsync -a --delete frontend/dist/ ubuntu@公网IP:/var/www/bill/pc/
rsync -a --delete mobile/dist/   ubuntu@公网IP:/var/www/bill/mobile/

# 后端：更新 ~/bill/server 后
cd ~/bill/server
pnpm install
npx pm2 restart bill-manage
```

改了 `~/bill/server/.env` 也必须重启 PM2。

### 监控与日志

```bash
npx pm2 monit
npx pm2 logs bill-manage
journalctl -u nginx -f
df -h
```

### 数据库备份与恢复

备份（在服务器上执行，文件落到 `~/bill/backup/`）：

```bash
mkdir -p ~/bill/backup
mysqldump -u bill -p --no-tablespaces bill > ~/bill/backup/bill-$(date +%F).sql
```

`-p` 会提示输入 `bill` 账号密码。`--no-tablespaces` 避免 MySQL 8 因缺少全局 `PROCESS` 权限报错（`bill` 只有 `bill.*` 库权限时很常见）。建议把 `.sql` 再拷到本机，不要只留在云服务器上。

`>` 会立刻创建目标文件，即使 dump 失败目录里也会有一个文件。备份成功后应能看到 `CREATE TABLE`，且文件不是几十字节的空壳：

```bash
ls -lh ~/bill/backup/
tail -n 20 ~/bill/backup/bill-$(date +%F).sql
```

恢复会**覆盖**当前 `bill` 库中的表数据，先确认备份文件无误，并暂停后端以免写入冲突：

```bash
cd ~/bill/server
npx pm2 stop bill-manage

# 将 bill-2026-08-26.sql 换成实际文件名
mysql -u bill -p bill < ~/bill/backup/bill-2026-08-26.sql

npx pm2 start bill-manage
```

库不存在时，可先让后端启动一次自动建库，或手动执行：

```sql
CREATE DATABASE IF NOT EXISTS bill CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

再跑上面的 `mysql < ...sql`。

### 优化建议

- 模板已开启 Gzip（`deploy/nginx-linux.conf`）
- 可用 Redis 缓存热点查询
- 静态资源可再接 CDN

---

## 常见问题排查

| 问题现象 | 可能原因 | 解决方法 |
|----------|----------|----------|
| 访问 IP 仍是 Nginx 默认页 | `conf.d/bill.conf` 未生效，或 default 站点占用 | 检查配置、关掉 default、`nginx -t` 后 reload |
| 打开根路径 `/` 没有页面 | 站点只挂了 `/pc/` 和 `/mobile/` | 访问 `/pc/` 或 `/mobile/` |
| 前端空白 / 静态资源 404 | `dist` 未同步到 `/var/www/bill/pc` 或 `/var/www/bill/mobile` | 确认有 `index.html`，且 Nginx 可读（目录属主为 ubuntu 即可） |
| API 502 Bad Gateway | 后端未启动或端口不是 3000 | `npx pm2 status`、看 `~/bill/server/logs` |
| API 404 且路径少了 `/api` | `proxy_pass` 写成了 `http://localhost:3000/`（带尾斜杠） | 使用仓库模板：`proxy_pass http://bill_api;` |
| MySQL connect failed，进程退出 | `.env` 中 `MYSQL_USER` / `MYSQL_PASSWORD` 错误或 MySQL 未启动 | 修正后重启，`systemctl status mysql` |
| Redis 相关报错 / 登录态异常 | Redis 未启动 | `redis-cli ping`，`sudo systemctl start redis-server` |
| HTTPS 证书错误 | 仍使用模板里的 localhost 证书路径 | 换成 Let's Encrypt 或自有证书 |

---

部署完成后，PC 走 `/pc/`，移动端走 `/mobile/`，API 走同源 `/api/v1/`。
