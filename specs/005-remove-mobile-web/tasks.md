---

description: "移除手机端网页：任务列表"
---

# Tasks: 移除手机端网页

**Input**: `/specs/005-remove-mobile-web/` 下的设计文档

**Prerequisites**: [plan.md](./plan.md)、[spec.md](./spec.md)、[research.md](./research.md)、[data-model.md](./data-model.md)、[contracts/mobile-shutdown.md](./contracts/mobile-shutdown.md)、[quickstart.md](./quickstart.md)

**Tests**: 规格没有要求自动化测试，仓库也没有可用的测试框架。不写测试代码。入口是否关掉、电脑端和小程序是否仍可用，按 [quickstart.md](./quickstart.md) 手工核对。

**Organization**: 先固定「不改公共接口」这条边界，再关停 `/mobile` 并删除 `mobile/`。随后核对电脑端、小程序和历史数据未被波及，最后改使用说明和部署说明。

## 格式：`[ID] [P?] [Story] 描述`

- **[P]**：可以并行（不同文件，且不依赖未完成的任务）
- **[Story]**：所属用户故事（US1～US3）
- 描述里写明文件路径

## 全局约定（所有任务都要遵守）

- 只关静态入口。按 [contracts/mobile-shutdown.md](./contracts/mobile-shutdown.md)：`/mobile`、`/mobile/`、`/mobile/index.html` 及该路径下的静态资源不再被 Nginx 接住，由默认 404 响应。不新增 `error_page`，不返回 301/302，不放说明页。
- 不修改 `/api/v1`。不在 `deploy/nginx-linux.conf`、`deploy/nginx.conf` 的 `location /api/` 里按 Referer 返回 403。不改 `server/`。
- 不改 `frontend/`、`miniapp/`，不新增 `deploy/sql/` 脚本，不删除账号、账本、明细、预算、计划或微信绑定。见 [data-model.md](./data-model.md)。
- 不把 `mobile/` 改成只含一句说明的页面。删除后不得再恢复该目录。
- `specs/001-*` 至 `specs/004-*` 是历史档案，不改。
- 代码注释和文档用简体中文。

---

## 阶段 1：准备工作

**目的**：确认本地开发脚本本来就没有带上手机网页，避免实施时再加回入口。

- [X] T001 核对 `script/dev.js` 与 `script/install.js`：`dev.js` 只并发启动 `frontend` 和 `server`，`install.js` 只安装 `frontend`、`server`、`miniapp`。两文件都不得出现 `mobile`。已是这样则保持原样；若有 `mobile` 命令，删掉该命令，不要改成构建或启动手机网页

---

## 阶段 2：基础（不改公共接口）

**目的**：关停开始前先钉死边界。手机网页没有专用后台接口，`/api/v1` 继续给电脑网页和小程序用。

**⚠️ 关键**：本阶段完成前不要删 Nginx 配置，也不要删 `mobile/`。

- [X] T002 通读 `server/routes/common/index.js`、`server/routes/bill/index.js`、`server/routes/transaction/index.js`、`server/routes/budget/index.js`、`server/routes/overview/index.js`、`server/routes/plan/index.js`、`server/routes/asset/index.js`、`server/routes/billtype/index.js`、`server/routes/ai/index.js` 的 `prefix`。确认没有 `/mobile` 或只给手机网页用的前缀；这些文件本次不改。再读 `deploy/nginx-linux.conf` 与 `deploy/nginx.conf` 的 `location /api/`，确认还没有 Referer 判断。若发现手机网页专用接口，停下来说明，不要删公共接口

**检查点**：公共接口保持原样。可以开始关停入口。

---

## 阶段 3：用户故事 1 - 手机浏览器里的记账网页直接关停（Priority: P1）🎯 MVP

**目标**：打开原来的手机记账地址不再出现记账页面，也不出现说明或跳转。仓库里不能再构建出这个站点。

**独立测试**：两份 Nginx 模板中不存在 `location /mobile`；`mobile/` 目录不存在。对照 [contracts/mobile-shutdown.md](./contracts/mobile-shutdown.md) 的静态入口表，配置里没有 301、没有自定义错误页。

### 用户故事 1 的实现

- [X] T003 [P] [US1] 修改 `deploy/nginx-linux.conf`：删除 `location /mobile/`（`alias /var/www/bill/mobile/;` 与 `try_files` 回落 `/mobile/index.html` 那一段）和 `location = /mobile`（`return 301 /mobile/;`）。保留 `location /pc/`、`location = /pc`、`location /api/` 的原文。不要新增 `error_page`，不要把 `/mobile` 写成 `return 301` 或 `return 302`，不要在 `/api/` 增加 `if`
- [X] T004 [P] [US1] 修改 `deploy/nginx.conf`：删除「移动端 H5」注释以及 `location /mobile/`（`alias html/bill/mobile/;`）和 `location = /mobile`（`return 301 /mobile/;`）。文件头注释里的目录树去掉 `mobile/ ← mobile/dist`。`location /pc/` 与 `location /api/` 保持原文，约束与 T003 相同
- [X] T005 [P] [US1] 删除整个 `mobile/` 目录，包括 `mobile/package.json`、`mobile/pnpm-lock.yaml`、`mobile/src/`、`mobile/public/`、`mobile/index.html` 和构建配置。不要留下说明用的 `index.html`，也不要改成跳转到 `/pc/`
- [X] T006 [US1] 依赖 T003、T004。对照 `specs/005-remove-mobile-web/contracts/mobile-shutdown.md` 检查 `deploy/nginx-linux.conf` 与 `deploy/nginx.conf`：全文不再有 `location /mobile`、`return 301 /mobile/`、`/mobile/index.html`；`location /api/` 仍是 `proxy_pass http://bill_api;`，没有 Referer 条件。未部署到服务器时，本任务只核对模板文本

**检查点**：仓库里的入口定义已经关掉，手机网页源码已删除。电脑端配置块还在。

---

## 阶段 4：用户故事 2 - 已有的账和另外两个入口保持原样（Priority: P1）

**目标**：下线不改账务数据，不改电脑网页和小程序的行为。记账人、归属人、分享码和微信绑定规则不动。

**独立测试**：`frontend/`、`miniapp/`、`server/` 没有本次改动，没有新的 SQL。`/pc/` 与 `/api/` 的 Nginx 配置与删 `/mobile` 之前一致。按 [quickstart.md](./quickstart.md) 第 2 节，电脑网页能登录并看到原账本，小程序仍能自动登录并记一笔。

### 用户故事 2 的实现

- [X] T007 [P] [US2] 确认本次没有修改 `frontend/`、`miniapp/`、`server/`，也没有新建 `deploy/sql/` 下的脚本。用 `git diff --stat -- frontend miniapp server deploy/sql` 核对；输出应为空。不要为了「顺便」改登录、记账或绑定。核对结果：这三个目录和 `deploy/sql/` 没有本次改动。`miniapp/miniprogram/config/env.ts` 里 develop 地址从局域网 IP 改成 `localhost` 是本次开始前就有的本地改动，未再动它
- [X] T008 [P] [US2] 依赖 T003、T004。核对 `deploy/nginx-linux.conf` 与 `deploy/nginx.conf` 里 `location /pc/`、`location = /pc`、`location /api/` 的 `alias`、`try_files`、`proxy_pass`、超时时间与改动前一致。只允许少了 `/mobile` 相关行
- [X] T009 [US2] 按 `specs/005-remove-mobile-web/quickstart.md` 第 2 节手工核对：电脑网页打开 `/pc/` 登录原账本，成员人数和明细笔数与下线前一致，概览能查询；小程序用已绑定账号打开，不需重新绑定，能补记再删除自己刚记的一笔。没有可用环境时，在本任务下注明未跑，不要改业务代码来「配合」验收。未跑：本机没有已部署的站点和小程序调试会话，没有登录电脑网页或小程序

**检查点**：关停没有碰到账本数据和另外两个客户端。

---

## 阶段 5：用户故事 3 - 给人看的说明不再指向手机网页（Priority: P2）

**目标**：使用说明和部署说明不再把手机网页写成可以打开的入口。这些文字不放到 `/mobile/` 上。

**独立测试**：只读更新后的 `docs/用户手册.md` 和 `readme.md`。第一次使用指向电脑网页注册；手机上记账只写微信小程序，并写明小程序不能注册。部署步骤不再构建或上传 `mobile/`。

### 用户故事 3 的实现

- [X] T010 [P] [US3] 修改 `readme.md`：项目结构里小程序不再写「与移动端 H5 并存」。生产部署删掉 `cd mobile && pnpm build`，以及表格中 `mobile/dist/*` → `/var/www/bill/mobile/` 那一行。访问地址只保留 PC `/pc/` 和 API `/api/v1/...`，去掉「移动端为 `/mobile/`」
- [X] T011 [P] [US3] 修改 `deploy/linux.md`：删掉构建 `mobile/`、`mkdir` `/var/www/bill/mobile`、`rsync` 到该目录、Nginx 将 `/mobile/` 指到该目录，以及「打开 `https://域名/mobile/` 应看到移动端」的验收。站点根路径的说明改为访问 `/pc/`。保留 `/pc/` 与 `/api` 的步骤
- [X] T012 [P] [US3] 修改 `deploy/windows.md`：删掉 `mobile/dist`、`nginx/html/bill/mobile`、`pnpm build`（mobile）和访问 `https://localhost/mobile/` 的说明。目录树和地址表只保留电脑端 `/pc/`。根路径说明改为走 `/pc/`
- [X] T013 [P] [US3] 修改 `deploy/README.md`：数据库升级一节里「旧版本小程序和手机网页再新增、编辑会被拒绝」改为只描述旧版本小程序。不要再把手机网页写成仍会调用记账接口的客户端，也不要新增「请改用小程序」的页面说明
- [X] T014 [P] [US3] 修改 `docs/用户手册.md`，使手机网页不再是可用客户端，且不要在文中留下「请打开 `/mobile/`」：
  - 文首客户端列表去掉移动端 H5
  - 目录删除「移动端使用指南」，其后章节号顺延，并改掉文内指向旧第 11 章的锚点
  - 第 1 章模块表去掉「移动端」列；日常补记改为微信小程序或电脑端
  - 快速开始、登录、退出、个人信息中删除打开 `/mobile/`、移动端登录和移动端退出的步骤
  - 删除原第 10 章「移动端使用指南」全文，不要换成「已下线，请用小程序」的短章
  - 权限表里「加入账本」「删除账本」去掉移动端，只保留 PC 与小程序
  - 常见问题：没有注册入口的答案改为先在电脑注册，小程序绑定一次；打不开的答案只核对 `/pc/`，不要再写 `/mobile/`
  - 附录 C 去掉「移动端」列；附录 D 去掉移动端地址行

**检查点**：新读者按手册找不到手机网页入口，部署文档也不会把该站点再装回去。

---

## 阶段 6：收尾

**目的**：对照验收步骤做一次总核对，并清掉现行文档里的残留入口。

- [X] T015 按 `specs/005-remove-mobile-web/quickstart.md` 第 1 节和第 3 节收口。第 1 节：若已把新 Nginx 模板重载到环境并删除服务器上的 `mobile` 静态目录（Linux `/var/www/bill/mobile/`，Windows `nginx/html/bill/mobile/`），用其中的 `curl` 确认 `/mobile`、`/mobile/`、`/mobile/index.html` 为 404、无跳转、正文不是记账页也不是迁移说明。没有部署环境时，改为再读两份 Nginx 模板，确认它们满足同一合同，并在任务旁注明未对线上执行 curl。第 3 节：`docs/用户手册.md`、`readme.md`、`deploy/linux.md`、`deploy/windows.md`、`deploy/README.md` 不再要求打开或发布手机网页；`mobile/` 不在仓库中。未对线上执行 curl。两份模板已无 `location /mobile`、无 `return 301 /mobile/`、无自定义错误页，`/api/` 仍是 `proxy_pass http://bill_api;`。上述文档已不再要求打开发布手机网页
- [X] T016 [P] 在 `readme.md`、`deploy/`、`docs/用户手册.md` 中搜索 `/mobile/`、`mobile/dist`、`移动端 H5`。现行说明不得再把手机网页写成可登录、可查看、可删除或可加入账本的入口。不要修改 `specs/001-*` 至 `specs/004-*` 和 `.specify/memory/constitution.md`

---

## 依赖与执行顺序

### 阶段依赖

- **准备工作（阶段 1）**：无前置，可立即开始
- **基础（阶段 2）**：依赖阶段 1。未确认「没有专用接口、不拦 `/api`」之前，不要删入口
- **用户故事（阶段 3 起）**：都依赖阶段 2
  - 故事 1 与故事 3 改的是不同文件，基础完成后可以并行
  - 故事 2 的「业务目录无改动」可与故事 1 并行；其中核对 Nginx 的 `/pc/`、`/api/` 要等故事 1 的配置改完
- **收尾（阶段 6）**：依赖打算交付的全部故事

### 用户故事之间

- **用户故事 1（P1）**：基础完成后即可开始，不依赖故事 2、3
- **用户故事 2（P1）**：不依赖故事 3。它验证的是故事 1 没有误改电脑端、小程序和接口
- **用户故事 3（P2）**：不依赖故事 1 的代码也能改文档，但发布前应在入口已经关掉之后再通读，避免文档还指向一个仍可打开的站点

### 故事内部

- 故事 1：两份 Nginx 与删除 `mobile/` 可同时做；T006 必须在 T003、T004 之后
- 故事 2：T007 与 T008 可同时做；T009 使用现有环境手工看，不写代码
- 故事 3：五份文档各改各的，可同时做
- 不安排自动化测试

### 可并行的部分

- T003、T004、T005 彼此文件不同，可同时做
- T010、T011、T012、T013、T014 可同时做
- T007 可与 T003～T005 同时做
- T016 只搜文档，可与 T015 的配置阅读同时做；若 T015 要上服务器 curl，须等 Nginx 模板和静态目录都已按 quickstart 处理

---

## 并行示例：用户故事 1

```text
同时进行：
- T003 改 deploy/nginx-linux.conf，只删 /mobile 两段
- T004 改 deploy/nginx.conf，只删 /mobile 两段
- T005 删除 mobile/ 目录

然后：
- T006 对照 contracts/mobile-shutdown.md 检查两份模板
```

---

## 实施策略

### 先做 MVP（用户故事 1）

1. 完成阶段 1、阶段 2
2. 完成阶段 3，关掉模板里的入口并删除源码
3. **停下来核对**：两份 Nginx 不再接住 `/mobile`，`mobile/` 已不在仓库
4. 同一版本接着做阶段 4。故事 2 也是 P1，不能只关入口却不确认电脑端和小程序仍可用

### 增量交付

1. 阶段 1～2：边界固定，业务代码还没动
2. 故事 1：入口从模板和源码中消失
3. 故事 2：确认账和另外两端没变
4. 故事 3：手册和部署文档不再把人带去 `/mobile/`
5. 阶段 6：按 quickstart 收口

### 并行

基础完成后：

- 一人改两份 Nginx 并删除 `mobile/`（故事 1）
- 另一人改 `readme.md`、`deploy/*.md`、`docs/用户手册.md`（故事 3）
- 故事 2 在故事 1 的 Nginx 改动落地后做 diff 和手工核对

---

## 备注

- [P] 表示不同文件、且不依赖未完成任务
- 故事标签只出现在阶段 3～5
- 当前没有用户在使用手机网页，不要为「页面还开着」增加接口拦截
- 线上删除静态目录和重载 Nginx 写在 quickstart 里，由部署时执行；本任务列表改的是仓库中的模板、源码和文档
- 每完成一个故事就可以按该故事的独立测试停下来核对
