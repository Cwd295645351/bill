# Research: 011-mobile-h5-rebuild

## Decision: 独立工程 mobile-h5/ + 部署 /mobile/

- **Choice**: 新建 `mobile-h5/`（Vue 3 + Vite + TypeScript + Vant），Nginx `location /mobile/` 托管构建产物；旧 `mobile/` 与 `/mobile/` 继续永关。
- **Why**: 宪章 v3.0.0 明确允许独立新 H5，并禁止写回旧目录；与 PC（`/pc/`）、小程序（非 Nginx 静态）边界清晰。
- **Reject**: 在 `frontend/` 内用响应式兼做手机站（会把 PC 专属能力与路由缠进移动端，违反多端边界）；恢复或 fork 旧 `mobile/`（宪章禁止）。

## Decision: 登录仅账号密码；无 H5 注册；无微信绑定页

- **Choice**: 调用既有 `POST /api/v1/common/login`（先 `GET /login_config` 取公钥，RSA 加密密码，与 PC `use-login` 同模式）；支持既有 refresh / logout。UI **不提供**注册切换；**不调用** `/wxLogin`、`/wxBind`，不建绑定页。
- **Why**: 用户澄清 Q1=A、Q2=A；与 PC 同账号体系最快打通；微信网页授权依赖公众号配置且非首期必需。
- **Reject**: H5 内注册（扩大攻击面与客服路径，且小程序亦无注册）；微信网页 OAuth 作首期唯一或并列登录（阻塞非微信浏览器）。

## Decision: 零新增业务 API；复用 /api/v1

- **Choice**: 账本、记账、搜索、加入等全部走现有 `bill` / `transaction` /（类型等）路由；H5 只做展示与会话适配。
- **Why**: FR-008 禁止第二套业务语义；降低双口径与回归面。
- **Reject**: 为 H5 另开 BFF 或精简 DTO 专用接口（首期无证据表明现网契约不可用）。

## Decision: 页面集合对齐小程序（去掉 bind）

- **Choice**: Tab：账本 / 记一笔 / 我的；子页：账单详情、新建、编辑、搜索、加入。不移植 PC 资产/预算/计划/AI。
- **Why**: 规格 Assumptions 与小程序 `app.json` 页面列表一致；`pages/bind` 按澄清删除。
- **Reject**: 首期塞入 PC 资产趋势等（超出规格 Out of Scope）。

## Decision: 规格治理

- **Choice**: 全部产物仅 `specs/011-mobile-h5-rebuild/`；禁止修改 `specs/001`–`010`（含 `005-remove-mobile-web` 关停合同继续有效，本特性只**叠加** `/mobile/` 合同）。
- **Why**: 用户与宪章工作流要求；旧关停规格不因新入口而回改原文。
