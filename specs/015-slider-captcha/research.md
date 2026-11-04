# Research: 015-slider-captcha

## Decision: 自建拼图滑块 + Redis，不引入 SaaS

- **Rationale**: 私有记账系统流量小；仓库无现成 GeeTest/Turnstile；要 fail closed 与一次性校验，自建即可控。  
- **Alternatives**: Cloudflare Turnstile / 阿里云 / 极验 — 运维与国内可达性成本更高，本迭代不取。

## Decision: SVG 生成题目，不引入 sharp/canvas

- **Rationale**: Windows/Linux 部署免原生依赖；SVG data-URL 三端均可展示。  
- **Alternatives**: 真实抠图拼图 — 体验更好但依赖图像库，推迟。

## Decision: 校验挂在 login/register/wxBind，而非单独「换票」接口

- **Rationale**: 减少一轮往返；业务提交时一次性消费，难绕过。  
- **Alternatives**: `POST /captcha/verify` 发 short-lived passToken — 多一 hop，本迭代不取。

## Decision: 覆盖 PC 登录+注册、H5 登录、小程序 wxBind；跳过 wxLogin

- **Rationale**: 用户确认三端；静默登录无密码、微信侧已有会话。H5 无注册（011）。  
- **Alternatives**: 仅 PC — 与用户指令不符。

## Decision: captcha 必须 JWT 放行且前端免 token 刷新

- **Rationale**: 登录页常带过期本地会话；若 captcha 走鉴权或触发 refresh，会出现「请重新登录」误伤。  
- **Alternatives**: 登录页清会话后再拉题 — 体验差，且直调 API 仍应公开。
