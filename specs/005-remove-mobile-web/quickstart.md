# Quickstart: 移除手机端网页

验收关停结果。不包含实现代码。数据是否保留，对照 [data-model.md](./data-model.md)；入口与接口的期望，对照 [contracts/mobile-shutdown.md](./contracts/mobile-shutdown.md)。

## 前提

- 已按新的 `deploy/nginx-linux.conf` 或 `deploy/nginx.conf` 重载 Nginx。
- 服务器上的手机网页静态目录已删除（Linux 示例：`/var/www/bill/mobile/`；Windows 示例：`nginx/html/bill/mobile/`）。先重载配置，再删目录。
- 准备一个下线前就存在的账本：记下成员人数和明细笔数。电脑网页和小程序仍能登录。
- 下面的 `https://域名` 换成实际站点。本机 Windows 部署可用 `https://localhost`。

## 1. 旧地址打不开

```bash
curl -k -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://域名/mobile
curl -k -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://域名/mobile/
curl -k -s -D - -o mobile-body.html https://域名/mobile/
```

期望：

- 三个请求都是 `404`，`redirect_url` 为空。
- `mobile-body.html` 里没有登录框、账本名称、金额，也没有「小程序」「请用电脑」等引导。
- 再请求 `https://域名/mobile/index.html`，同样是 404。

浏览器打开 `https://域名/mobile/#/某账本`：地址栏停在这个地址，页面不是记账内容，也不会变成 `/pc/`。

## 2. 电脑网页和小程序仍可用

- 电脑网页打开 `/pc/`，登录，进入对照账本。成员人数、明细笔数与下线前一致。打开概览，能查出结果。
- 小程序用已绑定账号打开，不需要重新绑定。进入同一账本，笔数一致。补记一笔后再删除，只有记账人能删掉自己刚记的这笔。
- 全程不要从 `/mobile/` 进入。

## 3. 说明不再指向手机网页

只读 `docs/用户手册.md` 和 `readme.md`：

- 没有「打开 `/mobile/`」或「移动端可以登录、查看、删除、加入账本」。
- 第一次使用写的是电脑网页注册。
- 手机上记账只写微信小程序，并写明不能在小程序里注册。
- 部署文档不再要求构建 `mobile/` 或同步到 `/mobile/`。

`mobile/` 目录在仓库中不存在。`frontend/`、`miniapp/`、`server/` 没有为本次下线改业务行为。
