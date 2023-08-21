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
