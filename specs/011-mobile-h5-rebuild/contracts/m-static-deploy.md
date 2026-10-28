# Contract: `/mobile/` 静态托管（新建 mobile-h5）

## 生产静态托管 `/mobile/`

| 请求 | 行为 |
|------|------|
| `GET /mobile/` | 返回 H5 `index.html`（SPA） |
| `GET /mobile` | 301 到 `/mobile/` |
| `GET /mobile/*` 前端路由 | `try_files` 回退到 `/mobile/index.html` |
| `GET /mobile/` 下 JS/CSS 等 | 200，静态资源 |

发布目录：

- Windows：`nginx/html/bill/mobile/` ← `mobile-h5/dist`
- Linux：`/var/www/bill/mobile/` ← `mobile-h5/dist`

Vite `base` 与 vue-router `createWebHistory` 必须为 `/mobile/`。

## 过渡路径 `/m/`

| 请求 | 行为 |
|------|------|
| `GET /m`、`/m/` | 301 → `/mobile/` |

## 旧源码目录

旧目录 `mobile/` 保持冻结。对外 URL `/mobile/` 由新建 `mobile-h5` 托管，不是恢复旧应用。