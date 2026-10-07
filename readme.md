# 记账管理系统

此项目支持多人联合记账，拥有记账、预算、概览等功能。

面向终端用户的完整操作说明见 [docs/用户手册.md](docs/用户手册.md)。

## 一、项目结构

`frontent` 为前端页面，通过 `vite` + `vue3` + `tpyescript` 编写，每个页面都是独立的模块，包含独有的 `api.js`、 `router.js` 等元素，框架会自动读取每个页面的 `router.js` 文件并加入到路由当中。

接口请求地址从 `public` 文件下的 `env.js` 读取，本地开发需要自行添加 `env.local.js` 文件进行调试

`server` 为后端服务，使用 `koa2` 框架进行开发

`miniapp` 为微信小程序（原生 + TypeScript + Vant Weapp），与移动端 H5 并存，面向家庭成员记账。用微信开发者工具打开 `miniapp/` 目录，在工具里执行「工具 -> 构建 npm」后编译。开发版直连本机；体验版和正式版的接口根地址写在 `miniapp/.env` 的 `MINIAPP_BASE_URL`（参考 `miniapp/.env.example`），然后在 `miniapp` 目录执行 `npm run sync-env`。该文件和生成的 `env.local.ts` 都不提交。

## 二、安装依赖

```js
pnpm run install_all
```

## 三、运行调试

```js
// 运行
npm run dev
```

## 四、AI 批量解析配置

后端支持 OpenAI Chat Completions 兼容接口，默认使用硅基流动。首次使用时复制示例配置，并填写 API Key：

```bash
cd server
cp .env.example .env
```

```dotenv
AI_API_KEY=替换为新密钥
```

`server/.env` 已被 Git 忽略，禁止把真实密钥写入源码或提交到仓库。生产环境也可以直接通过进程环境变量注入 `AI_API_KEY`。如需切换其他兼容服务，可设置 `AI_BASE_URL` 和 `AI_MODEL`；不设置时默认使用硅基流动及 DeepSeek V3.2。

小程序登录还需要在同一份 `.env` 中配置 `WX_APPID` 与 `WX_SECRET`（微信公众平台的小程序密钥）。首次使用小程序时用账号密码绑定微信，之后静默登录。一个账号只能绑定一个微信，不提供解绑；如需换绑，由管理员直接修改 `user_wechats` 表。

## 五、生产部署

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

3. 填写 `~/bill/server/config/db.js` 的 MySQL / Redis，并在 `~/bill/server/.env` 或进程环境变量中配置 `AI_API_KEY`，再启动后端（默认端口 3000，进程名 `bill-manage`）：

```bash
cd ~/bill/server && pnpm run prd
```

4. 使用 Nginx 托管静态资源并反向代理 `/api`：
   - **Linux**：见 [deploy/linux.md](deploy/linux.md)，配置模板 [deploy/nginx-linux.conf](deploy/nginx-linux.conf)。
   - **Windows**：见 [deploy/windows.md](deploy/windows.md)，配置复制到 `nginx/conf/bill.conf`，静态文件放到 `nginx/html/bill/`。

访问地址：PC 为 `/pc/`，移动端为 `/mobile/`，API 为 `/api/v1/...`。生产环境 `VITE_BASEURL` 为空字符串时，浏览器与 Nginx 同源访问 `/api`，无需再经 Koa 提供静态页面。

## node版本

使用 `node18` 以上版本，使用 `pnpm` 进行安装
