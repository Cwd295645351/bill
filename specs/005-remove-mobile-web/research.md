# Research: 移除手机端网页

## 1. 旧地址怎么关

**Decision**: 从 `deploy/nginx-linux.conf` 和 `deploy/nginx.conf` 删除 `location /mobile/` 与 `location = /mobile`。不新增 `error_page`，不返回 301/302，不放说明 HTML。删掉 location 之后，这些路径不再被任何规则接住，由 Nginx 默认 404 响应。

**Rationale**:

- 规格要求直接关停：不能看到记账页，不能改成「请用小程序」说明，也不能跳到电脑网页。现在的 `location = /mobile` 是 301 到 `/mobile/`，`location /mobile/` 再用 `try_files` 回落到 `index.html`。这两段都必须去掉，只删磁盘文件而留着 location，回落规则仍会去找页面。
- 手机网页使用 `createWebHashHistory()`。账本、流水、搜索、加入账本都在 `#` 后面，浏览器请求的路径只有 `/mobile/` 或 `/mobile/index.html`。服务器看不到 hash。关掉这两个路径，就覆盖规格里的旧链接。
- 默认 404 正文是 Nginx 自带的英文错误页，不是产品说明，符合「不留说明」。

**Alternatives considered**:

- 留 location 但把目录清空：`try_files` 仍会内部回落到 `/mobile/index.html`，行为依赖文件是否还在，不稳定。
- 返回自定义 404 页面，写上改去小程序：规格已经否决说明页。
- 301 到 `/pc/`：规格明确禁止跳转。

## 2. 要不要拦住已经打开的页面

**Decision**: 不拦。不按 Referer 拒绝 `/api`，不改 Nginx 的 `/api/`，也不改 Node。只关掉静态入口并删除 `mobile/`。

**Rationale**:

- 当前没有用户在使用手机网页，不存在停在删除确认或加入账本页、下线后继续提交的情况。
- 手机网页没有专用接口。`/api/v1` 是电脑网页和小程序仍在使用的公共接口，不能为了一个没有人用的入口去拦请求。

**Alternatives considered**:

- 在 Nginx 按 Referer 对 `/api/` 返回 403：没有实际用户，多一条规则，还可能误伤来源异常的正常请求。已放弃。
- 在 Koa 里按来源拒绝，或作废全部登录态：同样没有用户需要保护，而且会碰到电脑网页和小程序。已放弃。

## 3. 源码和数据怎么处理

**Decision**: 删除整个 `mobile/` 目录。不改 `server/`、`frontend/`、`miniapp/`，不写 SQL。`script/dev.js` 与 `script/install.js` 今天就没有带上 mobile，保持不动。`specs/001` 到 `specs/004` 作为历史档案不改。

**Rationale**:

- 宪章 2.0.0 规定 `mobile/` 不再维护，不得把功能加回去，也不得恢复入口。留下源码，下次仍可能被 `pnpm build` 后拷回服务器。
- 手机网页没有单独的表或接口。账号、账本、明细、预算、计划和微信绑定都是三端共用数据，删源码不会删账。
- 开发脚本本来就不启动、不安装 mobile，不必为了「干净」再改一轮脚本。

**Alternatives considered**:

- 只停 Nginx、源码留在仓库：入口关了，但目录仍像一个可发布的客户端，和宪章冲突。
- 把 `mobile/` 改成只含一句说明的 `index.html`：这就是被否决的说明页。

## 4. 哪些说明要改

**Decision**: 改面向使用者和部署的现行文档：`docs/用户手册.md`、`readme.md`、`deploy/README.md`、`deploy/linux.md`、`deploy/windows.md`。用户手册删掉第 10 章，并改简介、快速开始、登录与退出、权限表、常见问题和附录 C、附录 D，使手机上的路径只剩微信小程序，完整功能只写电脑网页。这些文字不部署到 `/mobile/`。

**Rationale**: 规格故事 3 要求使用说明不再引导打开手机网页。部署文档若仍写「构建 mobile 并同步到 `/var/www/bill/mobile/`」，下次上线会把入口装回去。

**Alternatives considered**:

- 只改用户手册：运维文档会继续指示发布手机网页。
- 改历史规格里的「手机网页不改」：那些规格记录的是当时的范围，不是现行说明。
