# 研究记录：PC 运营后台

**功能分支**: `023-pc-admin-console` | **日期**: 2026-11-18

## 1. 管理员领域模块落点

**决策**: 新增 `server/modules/admin`，前缀 `/api/v1/admin`。路由与查询/默认类型写操作同居该目录，对外只经 `index.ts`。账本创建改为读取默认类型模板时，通过 catalog 或 admin 公开的只读模板接口，避免 bill 模块直接查表绕过领域边界；推荐在 `server/modules/admin` 或独立的 `catalog` 扩展中导出 `listActiveCatalogDefaults()`，由 `bill/service.createBill` 调用。

**理由**: 宪章要求业务按领域放在 `server/modules`；运营后台是新领域，不应塞进 `auth` 或散落在各业务模块。

**备选方案**: 把只读统计塞进现有 `auth`/`bill` 路由——否决，权限面与职责会膨胀。另起独立进程——否决，规模过小且破坏 monorepo 部署约定。

## 2. 管理员鉴权复用

**决策**: 复用 `ADMIN_USERNAME` + 已登录 `userId` 查 `users.username` 的判定（现有 `assertAdmin`）。管理接口失败说明统一为「未配置管理员」与「非管理员没有权限」（与规格 FR-017 含义一致）。密钥轮换接口可继续使用其现有更具体文案，或逐步改为同一套短句，但不把 `ADMIN_USERNAME` 下发给客户端。登录成功响应增加布尔字段 `isAdmin`。

**理由**: 规格明确唯一管理员、不建角色表；菜单隐藏不是鉴权，每个管理请求仍服务端校验。

**备选方案**: users 表加角色列 / 独立管理员登录——grilling 已否决。

## 3. AI 审计持久化

**决策**: 新建表 `ai_call_audits`，`bill_id` **NOT NULL**。同时将 `POST /api/v1/ai/parse-batch` 的 `billId` 从可选收紧为**必填**（规格显式批准的契约收紧）：缺省或空串在输入/账本校验阶段拒绝，不打上游、不计日额度；有值则继续现有成员校验。通过校验后的应审计调用：**先打 `[ai-audit]` 控制台日志，再写入 MySQL**（此时必有 `userId`+`billId`）。写入失败只记错误日志，不得回滚已成功的 AI 业务响应。从 `usage` 提取 token 整数，禁止存 prompt/响应正文。旧日志不回灌。Redis 日额度算法不变。成功 `data` 数组形状不变。PC 已传 `billId`；若 H5/小程序日后接解析，也必须传。

**理由**: 运营审计与表约束要求每条可检索记录归属账本；入口必填可避免「解析成功但后台看不见」的空洞。

**备选方案**: 接口仍可选、仅入库时跳过无账本——已否决（调用也必须带账本）。`bill_id` 可空——已否决。只存每日汇总 / 只读 Redis——已否决。

## 4. 默认类型模板存储

**决策**: 新建表 `catalog_defaults`（`kind` + `id` + `name` + `is_del`）。启动补表后若表空，用 `server/database/initDatas.ts` 灌入现有编号与名称。`createBill` 只复制 `is_del = false` 的三类模板；任一类为空则拒绝建账。软删不可恢复；编号在含已删除行的同类最大数字上加 1；支出/收入/支付方式编号段延续 1001/2001/3001。`initDatas.ts` 保留作种子源，不再作为运行时唯一真相。

**理由**: 规格要求模板可运营维护且只影响新建账本；现网硬编码无法后台改。

**备选方案**: 改名同步已有账本——grilling 已否决。直接改源码发版——无法运营自助。

## 5. 创建时间补列

**决策**: `users.created_at`、`bills.created_at` 可空 DATETIME。`sequelize.sync()` 不改旧列，用 `ensureAdminSchema`（对齐 `ensureAssetSchema`）`ALTER TABLE ... ADD COLUMN`。注册/建账时写入 `NOW()`；旧行保持 NULL，界面「未知」。窗口内「新建用户/账本」只统计非空且落在窗口内的行。

**理由**: 规格禁止伪造历史注册日；现表无时间戳。

**备选方案**: 不加列、不做新建趋势——clarify 已选补列向前。

## 6. 统计与列表查询策略

**决策**: 总览存量用 COUNT / SUM 聚合；近 7/30 日流水按 `transactions.date`（记账日毫秒）映射东八区自然日分桶；AI 按 `ai_call_audits.created_at` 分桶。成功率 = 窗口内 `outcome = success` 数 ÷ 全部审计数；分母为 0 时返回 `successRate: null`，前端固定显示「不适用」。账本列表 `creatorName` 优先创建者昵称，缺省回退用户名。列表默认 `includeDeleted=false`；分页 `page`（从 1）+ `pageSize`（默认 20，上限 100）。用户关键词匹配 `username` 或 `nick_name`；账本匹配 `name`；审计关键词匹配发起用户的用户名/昵称，另支持 `outcome=success|error`。

**理由**: 与澄清记录一致；避免全表拉到内存再筛（规模家庭级，但聚合仍放 SQL）。

**备选方案**: 自定义日期——已否决。列表无筛选——clarify 已选全筛。

## 7. PC 页面组织

**决策**: `frontend/src/views/admin/` 按现有约定提供 `router.ts` / `api.ts` / 页面组件；路由挂到 `/layout/admin`。`use-layout` 仅在本地用户信息 `isAdmin === true` 时追加「后台」菜单。页内 Tab 或子路由：总览、用户、账本、AI 审计、默认类型。用户/账本详情用抽屉或子页均可，以实现简洁为准。

**理由**: 宪章要求 PC 页面自带 router/api；不改 H5/小程序。

**备选方案**: 独立 `/admin` 登录壳——规格要求沿用现有登录。

## 8. 手册与兼容

**决策**: 实现后在 `docs/用户手册.md` 增加「运营后台」小节，写明仅部署指定管理员可见、普通成员无入口。登录响应新增可选字段 `isAdmin`，属向后兼容扩展。不改既有记账/解析成功响应形状。

**理由**: 宪章 I/IV：用户可见行为以手册为准；公开契约扩展优先加可选字段。
