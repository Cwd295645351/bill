# 记账管理系统

此项目支持多人联合记账，拥有记账、预算、概览等功能。

## 一、项目结构

`frontent` 为前端页面，通过 `vite` + `vue3` + `tpyescript` 编写，每个页面都是独立的模块，包含独有的 `api.js`、 `router.js` 等元素，框架会自动读取每个页面的 `router.js` 文件并加入到路由当中。

接口请求地址从 `public` 文件下的 `env.js` 读取，本地开发需要自行添加 `env.local.js` 文件进行调试

`server` 为后端服务，使用 `koa2` 框架进行开发

## 二、安装依赖

```js
pnpm run install_all
```

## 三、运行调试

```js
// 运行
npm run dev
```

## 四、生产部署

完整步骤见 [deploy/README.md](deploy/README.md)。摘要如下：

1. 构建前端

```bash
cd frontend && pnpm build   # 产物在 frontend/dist
cd mobile && pnpm build     # 产物在 mobile/dist
```

2. 将构建产物部署到服务器（路径与 `deploy/nginx-linux.conf` 一致，可按需调整）：

| 来源 | 部署目录（示例） |
|------|------------------|
| `frontend/dist/*` | `/var/www/bill/pc/` |
| `mobile/dist/*` | `/var/www/bill/mobile/` |

3. 填写 `~/bill/server/config/db.js` 的 MySQL / Redis，启动后端（默认端口 3000，进程名 `bill-manage`）：

```bash
cd ~/bill/server && pnpm run prd
```

4. 使用 Nginx 托管静态资源并反向代理 `/api`：
   - **Linux**：见 [deploy/linux.md](deploy/linux.md)，配置模板 [deploy/nginx-linux.conf](deploy/nginx-linux.conf)。
   - **Windows**：见 [deploy/windows.md](deploy/windows.md)，配置复制到 `nginx/conf/bill.conf`，静态文件放到 `nginx/html/bill/`。

访问地址：PC 为 `/pc/`，移动端为 `/mobile/`，API 为 `/api/v1/...`。生产环境 `VITE_BASEURL` 为空字符串时，浏览器与 Nginx 同源访问 `/api`，无需再经 Koa 提供静态页面。

## node版本

使用 `node18` 以上版本，使用 `pnpm` 进行安装
