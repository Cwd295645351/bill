#### 记账

`frontent` 为前端页面，通过 `vite` 构建，每个页面都是独立的模块，包含独有的 `api.js`、 `router.js` 等元素，框架会自动读取每个页面的 `router.js` 文件并加入到路由当中。

接口请求地址从 `public` 文件下的 `env.js` 读取，本地开发需要自行添加 `env.local.js` 文件进行调试

使用方法：

```js
// 安装依赖
pnpm i

// 运行
npm run dev

// 打包
npm run build
```