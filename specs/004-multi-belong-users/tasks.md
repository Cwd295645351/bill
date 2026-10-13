---

description: "支出归属人支持多选：任务列表"
---

# Tasks: 支出归属人支持多选

**Input**: `/specs/004-multi-belong-users/` 下的设计文档

**Prerequisites**: [plan.md](./plan.md)、[spec.md](./spec.md)、[research.md](./research.md)、[data-model.md](./data-model.md)、[contracts/transaction-belong-users.md](./contracts/transaction-belong-users.md)、[quickstart.md](./quickstart.md)

**Tests**: 规格没有要求自动化测试，仓库也没有测试框架（research 第 10 节）。下面不安排测试代码，只在各阶段末尾安排按 [quickstart.md](./quickstart.md) 手工核对的任务。

**Organization**: 先完成「接口字段替换」这一基础阶段，此时各端行为与今天相同、只是字段换成 `belongUserIds`。之后按用户故事逐个加多人能力，每个故事都能单独验收。

## 格式：`[ID] [P?] [Story] 描述`

- **[P]**：可以并行（不同文件，且不依赖未完成的任务）
- **[Story]**：所属用户故事（US1～US4）
- 描述里写明文件路径

## 全局约定（所有任务都要遵守）

- 接口上只用 `belongUserIds: string[]`：「全部」为 `[]`，单人为 `[id]`，多人为按 `bill_users.id` 升序的 id 列表。记账相关的请求和响应里不再出现 `belongUserId`。
- 数据库列 `belong_user_id`、`belong_user_name` 和 Sequelize 属性 `belongUserId`、`belongUserName` 不改名，只在服务端内部使用。多人存法：id 用英文逗号 `,` 拼接，名字用「、」拼接；`belong_user_id` 含逗号即多人；`''` / `全部` 表示「全部」。
- 结算请求的 `quantityInputs[].belongUserId`（数量规则扣到谁）**不替换**；`frontend/src/views/overview/type.d.ts` 和 `Overview.vue` 里数量规则的下拉框不动。
- `frontend/src/views/record/hooks/use-parse.ts`、导入接口 `/transaction/const`、`GET /overview/threeYearCost`、`mobile/` 都不改。
- 代码注释用中文，变量名用英文，风格与周边代码一致。

---

## 阶段 1：准备工作（数据库升级脚本与基线）

**目的**：先把线上要执行的 SQL 和改动前的分账基线准备好。

- [X] T001 记录改动前的分账基线：在 `server/` 下准备两份 `buildSettlement` 入参（两人账本、三人账本各一份，只含单人和「全部」归属的支出与收入，含一条 `cost_type` 规则和一条 `quantity` 规则），用 `node -e "const { buildSettlement } = require('./database/services/overviewSettlement'); console.log(JSON.stringify(buildSettlement(require('./tmp-baseline-2.json')), null, 2))"` 把输出分别存到 `server/tmp-baseline-2.out.json`、`server/tmp-baseline-3.out.json`，供 T022 对比（SC-004）。这四个文件只在本地保留，不提交
- [X] T002 [P] 新建 `deploy/sql/004-multi-belong-users-upgrade.sql`，内容为 data-model 第 5 节的升级语句：`ALTER TABLE transactions MODIFY COLUMN belong_user_id VARCHAR(1024) NULL, MODIFY COLUMN belong_user_name VARCHAR(2048) NULL;`，文件头用中文注释写明「只加宽、不改数据、可重复执行；执行前先备份，并用 `SHOW CREATE TABLE transactions;` 核对两列的字符集和排序规则，与表默认值不同时要在 MODIFY 中写明原 CHARACTER SET / COLLATE」；文件末尾附 `information_schema.COLUMNS` 核对查询（预期长度 1024、2048，均可空）
- [X] T003 [P] 新建 `deploy/sql/004-multi-belong-users-rollback.sql`，内容为 data-model 第 6 节：先注释说明「先回退代码再执行；执行前导出 `belong_user_id LIKE '%,%'` 的 id、belong_user_id、belong_user_name」，再 `UPDATE transactions SET belong_user_id = '', belong_user_name = '全部' WHERE belong_user_id LIKE '%,%';`，再附一条核对 `belong_user_name` 长度不超过 64 的查询，最后 `ALTER TABLE transactions MODIFY COLUMN belong_user_id VARCHAR(36) NULL, MODIFY COLUMN belong_user_name VARCHAR(64) NULL;`
- [X] T004 在 `deploy/README.md` 新增「数据库升级脚本」一节（依赖 T002、T003）：列出两个脚本；写明执行顺序「备份 transactions → 执行升级脚本并核对 → 发布服务端和电脑端 → 立即提交小程序新版本审核并发布」；说明先发代码、后执行脚本会导致多人记账写入超长失败；说明回滚步骤和「回滚后多人支出变为按全员分摊」的后果；写明回滚必须成套（规格 FR-022）：小程序新版本发布前可以单独回滚服务端和电脑端，发布后要回滚服务端，必须同时在微信公众平台把小程序回退到旧版本，否则新版本小程序记的单人支出会被旧服务端存成「全部」；说明新装环境由 `sequelize.sync()` 直接建宽列，无需执行

---

## 阶段 2：基础（接口字段替换，所有故事的前提）

**目的**：服务端和电脑端、小程序把 `belongUserId` 全部换成 `belongUserIds`，并接入名单校验、按成员筛选和旧请求拒绝。本阶段结束时各端仍是单选，行为与今天一致（收入不再能选「全部」除外）。

**⚠️ 关键**：本阶段完成前不能开始任何用户故事；服务端与两端客户端必须一起完成，否则字段对不上。

### 服务端

- [X] T005 [P] 修改 `server/database/models/index.js` 中 `Transaction` 的两列：`belongUserId` 改为 `DataTypes.STRING(1024)`，`belongUserName` 改为 `DataTypes.STRING(2048)`，`allowNull: true` 和 `field` 不变
- [X] T006 [P] 新建 `server/database/services/belongUsers.js`，导出（均写中文 JSDoc）：
  - 常量 `BELONG_ID_SEPARATOR = ','`、`BELONG_NAME_SEPARATOR = '、'`、`MAX_BELONG_ID_LENGTH = 1024`、`MAX_BELONG_NAME_LENGTH = 2048`、`PUBLIC_BELONG_NAME = '全部'`、`OUTDATED_CLIENT_MESSAGE = '当前版本过旧，请更新后再记账'`
  - `isPublicBelong(belongUserId)`：`null`、`undefined` 或 `''` 为真
  - `isMultiBelong(belongUserId)`：字符串中含 `,` 为真
  - `splitBelongIds(belongUserId)`：「全部」返回 `[]`，否则按 `,` 拆开
  - `loadOrderedMembers(billId)`：`BillUser.findAll({ where: { billId }, order: [['id', 'ASC']] })`，返回 `[{ userId, userName }]`
  - `resolveBelongUsers(data, type, members)`：返回 `[message, { belongUserId, belongUserName }]`。按顺序校验：① 请求体有 `belongUserId` 键而没有 `belongUserIds` 键 → `OUTDATED_CLIENT_MESSAGE`；② `belongUserIds` 缺省或不是数组、或元素不是字符串 → `归属人列表无效`；③ 去重后长度变化 → `归属人不能重复`；④ 有 id 不在 `members` 中 → `归属人不是该账本成员`；⑤ `Number(type) === 2`（收入）且长度不为 1 → `收入只能选一名归属人`；⑥ 按 `members` 的顺序重排后拼接，`[]` 写 `''` / `全部`，1 人写 id / 名字，多人用两个分隔符拼接；⑦ 拼接后 id 串超过 1024 字符或名字串超过 2048 字符 → `归属人过多`。两个键都有时以 `belongUserIds` 为准
  - `buildBelongWhere(belongUserIds)`：入参不是非空数组时返回 `null`（不限归属人）；否则对每个非空 id 生成 `sequelize.where(sequelize.fn('FIND_IN_SET', id, sequelize.col('belong_user_id')), Op.gt, 0)`，对 `''` 生成 `{ belongUserId: '' }`，用 `{ [Op.or]: [...] }` 包起来；id 走参数绑定，不手工拼 SQL
  - `toBelongResponse(row)`：把普通对象（或 `row.toJSON()` 的结果）中的 `belongUserId` 换成 `belongUserIds: splitBelongIds(...)` 并删除 `belongUserId`，其它字段原样保留
- [X] T007 修改 `server/routes/transaction/controller.js` 的写入接口（依赖 T006）：`addTransaction`（约第 230～260 行）、`batchAddTransaction`（约第 330～360 行）、`editTransaction`（约第 410～445 行）不再读取 `data.belongUserId`，改为先 `loadOrderedMembers(data.billId)` 再调用 `resolveBelongUsers(data, data.type, members)`，出错时 `return [message, null]` 且不写库；成功时把返回的两个值写入 `belongUserId`、`belongUserName`。去掉三处「默认 `belongUserId: ''` / `belongUserName: '全部'`、再按 `findBill.users.find` 覆盖」的旧逻辑（原来读到非成员时会因 `undefined.id` 抛错）。批量新增任一条失败时整批拒绝，`message` 前加 `第 N 条：`（N 从 1 开始）。编辑接口中「只能编辑自己记的账单」的校验保持在名单校验之前
- [X] T008 修改 `server/routes/transaction/controller.js` 的查询接口（依赖 T006）：`buildFilter`（约第 75～76 行）和 `exportData`（约第 638～639 行）删掉 `toIdList(data.belongUserId)` + `Op.in` 的写法，改为 `const belongWhere = buildBelongWhere(data.belongUserIds)`。在 `buildFilter` 里，非 `null` 时 `andList.push(belongWhere)`，与日期条件的处理方式一致，由 `withAnd` 统一并入；`exportData` 中同样以 `Op.and` 并入 `exportParams`，不能覆盖已有键。请求里只有旧字段 `belongUserId` 时直接忽略（规格 FR-020）。`toIdList` 仍被 `userId` 筛选使用，保留。`getList` 的**两条分支**都要转换响应：翻页码分支（约第 157～167 行，概览和手机网页使用）和游标分支（约第 203～204 行），都在 `attachImagesToList` 返回之后对每项调用 `toBelongResponse`（`attachImagesToList` 已返回普通对象）
- [X] T009 修改 `server/routes/transaction/controller.js` 的 `getCurrentMonthCost`（约第 561～580 行）：分组逻辑不变（仍按 `belongUserId` + `userId` 比较），组装 `belongUserCosts` 项时把 `belongUserId: item.belongUserId` 换成 `belongUserIds: splitBelongIds(item.belongUserId)`（依赖 T006）
- [X] T010 修改 `server/routes/overview/controller.js` 的 `getBlance`（约第 18～70 行）：分组仍按 `type` + `belongUserId` + `userId`，组装 `belongUserCosts` 项时 `belongUserId` 换成 `belongUserIds: splitBelongIds(item.belongUserId)`；`costTypeRank` 不改。`getSettlement` 中 `quantityInputs` 的 `belongUserId` 不动（依赖 T006）

### 电脑端

- [X] T011 [P] 修改 `frontend/src/types/bill.d.ts` 的 `RecordItem`：`belongUserId: string` 改为 `belongUserIds: string[]`（注释「归属人 id 列表：全部为空数组，多人按账本成员顺序」）；修改 `frontend/src/views/record/type.d.ts` 第 30 行同名字段为 `belongUserIds: string[]`
- [X] T012 修改 `frontend/src/views/record/hooks/use-record.ts`（依赖 T011）：搜索条件 `searchOptions.belongUserId: ''`（第 79 行）保持界面上单选的绑定值不变，但第 229、323 行传给列表和导出接口时改为 `belongUserIds: options.belongUserId ? [options.belongUserId] : []`（「全部」= 空数组 = 不限归属人）
- [X] T013 修改 `frontend/src/views/record/hooks/use-add-edit.ts`（依赖 T011）：新增（第 35 行起）、编辑（第 50 行起）的表单值暂时仍是单选字符串，提交时（第 95、179 行）改为 `belongUserIds: value ? [value] : []`；打开编辑时用 `row.belongUserIds[0] || ''` 回填；`batchAdd`（第 204～211 行）把表格的 `item.belongUserId` 转成 `belongUserIds: item.belongUserId ? [item.belongUserId] : []`，表格行类型不改
- [X] T014 [P] 修改 `frontend/src/views/record/Record.vue` 时间线卡片（第 36 行）：`belongBg(detail.belongUserId)` 改为 `belongBg(detail.belongUserIds)`，第 396 行的 `belongBg` 改为接收 `string[]`：空数组返回 `#fff`，1 人时用该 id 走原来的调色板逻辑（多人底色留给 T034）
- [X] T015 [P] 修改 `frontend/src/views/overview/hooks/use-type-chart.ts`：第 114 行 `searchParams.belongUserId = [slot.userId, '']` 改为 `searchParams.belongUserIds = [slot.userId, '']`；第 125 行前端过滤改为 `item.belongUserIds.includes(slot.userId) || item.belongUserIds.length === 0`；第 22 行 `isPublicBelong` 如无其它调用就删除。第 204～239 行的 `quantityInputs[].belongUserId` 不动
- [X] T016 [P] 修改 `frontend/src/views/overview/Overview.vue` 第 20 行收入明细的 `:key`，把 `item.belongUserId` 换成 `item.belongUserIds.join(',')`，显示内容不变；第 38 行数量规则的下拉不动

### 小程序

- [X] T017 [P] 修改 `miniapp/miniprogram/utils/records.ts`：记账类型第 16 行 `belongUserId: string` 改为 `belongUserIds: string[]`；第 48 行 `belongBackground` 改为 `belongBackground(belongUserIds: string[], belongUserName: string, users)`，空数组或 `全部` 返回 `''`，1 人时用该 id 走原来的调色板逻辑（多人底色留给 T035）；第 82 行调用处同步
- [X] T018 [P] 修改 `miniapp/miniprogram/pages/record-search/index.ts`：页面内部仍用单选的 `belongUserId` / `belongUserName`（第 23、113 行），第 169 行组装请求时改为 `belongUserIds: this.data.belongUserId ? [this.data.belongUserId] : []`
- [X] T019 修改 `miniapp/miniprogram/utils/storage.ts` 的 `RecordPref`（第 32 行）：`belongUserId: string` 改为 `belongUserIds: string[]`，`belongUserName` 保留；读取上次偏好的函数（如 `getLastPref`）里，缓存只有旧字段 `belongUserId` 时转成 `belongUserIds: belongUserId ? [belongUserId] : []` 后返回，写入函数只写新字段
- [X] T020 修改 `miniapp/miniprogram/components/record-form/index.ts`（依赖 T017、T019）：组件内部暂时仍用单选，但对外改为名单——回填 `initial` 时（第 95 行）用 `initial.belongUserIds`；读取 `pref` 时（第 112～119 行）用 `pref.belongUserIds`；第 277、286 行写 `pref` 时存 `belongUserIds`；第 312 行 `buildPayload` 提交 `belongUserIds`。收入保持「不能选全部」：收入时滚轮里不出现「全部」，名单为空时默认自己
- [X] T021 修改 `miniapp/miniprogram/app.ts`（规格 FR-021）：在 `onLaunch` 中接入 `wx.getUpdateManager()`。`onUpdateReady` 时用 `wx.showModal({ title: '发现新版本', content: '新版本已准备好，请重启使用', showCancel: false })`，确认后调用 `applyUpdate()`；`onUpdateFailed` 时提示「新版本下载失败，请删除小程序后重新打开」。基础库不支持时（`wx.canIUse('getUpdateManager')` 为假）跳过

### 基础阶段核对

- [X] T022 按 [quickstart.md](./quickstart.md) 第 6 节逐行核对服务端校验（旧客户端写法对应 SC-010、两个字段都传、两个都不传、重复、非成员、收入为空或两人、列表只传旧字段、响应只有 `belongUserIds`）；在电脑端和小程序各记一笔单人支出、一笔「全部」支出、一笔单人收入，确认时间线、流水、搜索、导出、概览与改动前一致；用 T001 的入参重新跑 `buildSettlement`，输出与 T001 保存的结果逐字段相同

**Checkpoint**：字段替换完成，各端单选行为与今天一致，可以开始用户故事。

---

## 阶段 3：用户故事 1 - 记一笔支出时选几个人共同承担（Priority: P1）🎯 MVP

**Goal**：电脑端新增弹窗和小程序记一笔能把支出归属到多名成员，收入只能单人；保存后流水和时间线显示「甲、乙」。

**Independent Test**：三人账本中，从小程序记一笔和电脑端新增各记一笔支出，归属人勾选甲、乙，保存后时间线和流水显示「甲、乙」；切到收入只能选一人且没有「全部」；数据库中 `belong_user_id` 为按 `bill_users.id` 升序的 `id甲,id乙`。

### 实现

- [X] T023 [P] [US1] 新建 `frontend/src/views/record/hooks/use-belong-select.ts`，导出 `useBelongSelect(model: Ref<string[]>, type: Ref<number>, users: Ref<{ id: string; name: string }[]>, selfId: Ref<string>)`：用常量 `PUBLIC_OPTION = ''` 表示下拉里的「全部」选项。支出时：新选中 `''` 则清掉其它成员只留 `['']`；已有 `''` 时选中任一成员则去掉 `''`；全部取消则回到 `['']`。对外提供 `toBelongUserIds()`：`['']` 转成 `[]`，其余原样返回。收入时把值限制为单选。`type` 从支出变为收入时：值为 `['']` 或多于 1 人则改为 `[selfId]` 并 `ElMessage.warning('收入只能选一名归属人，已改为自己')`；只有 1 人时保留。`type` 从收入变为支出时值不变
- [X] T024 [US1] 修改 `frontend/src/views/record/hooks/use-add-edit.ts` 的新增表单（依赖 T023）：`addInformation` 的归属人改为 `string[]`，支出默认 `['']`、收入默认 `[自己 id]`；接入 `useBelongSelect`；提交时用 `toBelongUserIds()` 生成 `belongUserIds`；收入未选人时前端拦截并提示「收入必须选一名归属人」
- [X] T025 [US1] 修改 `frontend/src/views/record/Record.vue` 新增弹窗的归属人（第 149 行）（依赖 T024）：支出时 `el-select` 加 `multiple collapse-tags-tooltip`，选项为「全部」（`value=''`）加各成员；收入时为单选、不渲染「全部」选项、不可清空。去掉对单选才有意义的 `:value-on-clear="null"`。下拉选项按账本成员顺序渲染
- [X] T026 [P] [US1] 修改 `miniapp/miniprogram/components/record-form/index.wxml` 第 54 行：去掉归属人 `van-cell` + 滚轮选择器，改为平铺标签区，标题「归属人」；支出时渲染「全部」和各成员标签，收入时只渲染成员标签；每个标签 `bindtap="onToggleBelong"`、`data-id` 为成员 id（「全部」为 `''`），选中态用 class 区分；同时删除不再使用的归属人 picker / popup 节点
- [X] T027 [P] [US1] 修改 `miniapp/miniprogram/components/record-form/index.wxss`：新增归属人标签区样式（自动换行、间距、未选中描边、选中主题色填充），与表单其它项的左右边距一致
- [X] T028 [US1] 修改 `miniapp/miniprogram/components/record-form/index.ts`（依赖 T020、T026）：data 中归属人改为 `belongUserIds: string[]`（「全部」为 `[]`）和展示用的 `belongUserName`；新增 `onToggleBelong`：支出时点「全部」清空名单、点成员时切换选中（名单变空即回到「全部」），收入时点成员即改为只选该成员；名单变化时按 bill 成员顺序重排，并用「、」拼接出 `belongUserName`（空为「全部」）。这只是表单里的预览：账本详情返回的成员顺序不一定和服务端保存的顺序相同，保存后流水里的名字以服务端返回为准（规格 FR-005），前端不得把预览的拼接名写进请求；切换收支时：变为收入且名单为空或多于 1 人则改为自己并 `wx.showToast({ title: '收入只能选一名归属人，已改为自己', icon: 'none' })`，只有 1 人时保留；删除旧的 `openUsers`、第 263 行滚轮回调和不再使用的 `userIds` / `userNames` 字段；`buildPayload` 提交 `belongUserIds`；收入名单为空时拒绝提交并提示「收入必须选一名归属人」
- [X] T029 [US1] 按 [quickstart.md](./quickstart.md) 第 2 节第 1～4 步和第 3 节第 1、3 步验收，并在数据库核对：先勾乙再勾甲保存的记账，`belong_user_id` 仍是按 `bill_users.id` 升序的 `id甲,id乙`、`belong_user_name` 为 `甲、乙`；勾满甲乙丙时保存为三人名单而不是「全部」

**Checkpoint**：多人支出可以记下来，流水能显示名字；此时概览会把多人支出当成不认识的人，属于预期，由 US2 修正。

---

## 阶段 4：用户故事 2 - 概览分账按选中的几个人分（Priority: P1）

**Goal**：结算接口对多人归属支出按「同一组归属人」先汇总、再按组内有效收入比例分一次；指定支出类型规则对多人支出在组内平均扣减；支出结构按人对齐。

**Independent Test**：用 `node -e` 调用 `buildSettlement` 核对规格 US2 的 8 个例子和指定类型扣减例子；三人账本只记一笔甲付 200、归属甲乙的支出，概览为「乙 → 甲 转 100.00 元」。

### 实现

- [X] T030 [US2] 修改 `server/database/services/overviewSettlement.js` 的有效收入扣减（第 141～148 行 `cost_type` 规则分支）：从 `belongUsers.js` 引入 `isPublicBelong`、`isMultiBelong`、`splitBelongIds` 替换文件内第 13 行的 `isPublicBelong`。单人行逻辑不变；多人行按 `belongUserId` 原串分组汇总该规则类型的分，组内 `memberIds` 过滤出仍是成员的人，用 `allocatePublic(组合计, 组内每人权重 1)` 平均分后加到各人的 `deductionCents`（最后一人拿剩余）。更新 `buildSettlement` 的 JSDoc：`transactions[].belongUserId` 为数据库原值，多人时是按 `bill_users.id` 升序的逗号串
- [X] T031 [US2] 修改 `server/database/services/overviewSettlement.js` 的支出分摊（第 184～218 行）（依赖 T030）：在 `rows.forEach` 中，`isMultiBelong(row.belongUserId)` 的行不再走单人分支，按原串放进 `multiGroups: Map<key, rows[]>`（插入顺序即首次出现顺序）。全部「全部」支出处理完之后，按 key 逐组：`groupIds = splitBelongIds(key)`，组内权重为 `Math.max(effectiveCents[id], 0)`（不是成员的 id 权重 0，并用 `ensureParty(id, 对应名字)` 加入局外人）；组内权重全为 0 时每人权重 1；`targetShares = allocatePublic(组合计, 组权重)`；`shareRows = 每笔 allocatePublic(该笔分, 组权重)`；`reconcileToTarget(shareRows, targetShares)`；再把每笔各人份额加到 `borne`，并对成员 `addSlice(memberSlices[id], row.costTypeId, row.costTypeName, share)`。付款人 `paid` 和 `allSlices` 仍按原逻辑逐笔累加。没有多人行时不得改变任何既有计算顺序和输出（FR-008）
- [X] T032 [US2] 修改 `server/routes/overview/controller.js` 的 `getSettlement`（第 238～265 行）：确认传入 `buildSettlement` 的每行仍带原始 `belongUserId` 逗号串和 `belongUserName`；多人名单中的成员名从 `billUsers` 查出，供 `ensureParty` 使用的名字取 `belongUserName` 按「、」拆分后同位置的名字。如无需改动，在任务完成说明里写明已核对
- [X] T033 [US2] 在 `server/` 下准备 `tmp-case-*.json`，用 [quickstart.md](./quickstart.md) 第 1 节的 `node -e` 命令逐一核对 US2 例 1～8，以及「指定类型 101 元归属甲乙丙 → 三人分别扣 33.67 / 33.67 / 33.66」和「例 8 每人 `pies.members[].slices` 之和等于承担额」；再用 T001 的两份基线入参复跑，输出与基线逐字段相同。核对完删除所有 `tmp-*` 文件

**Checkpoint**：概览分账结果正确，SC-002、SC-003、SC-004 可验收。

---

## 阶段 5：用户故事 3 - 多人归属的账在各处都能正确看到、找到和修改（Priority: P2）

**Goal**：多人卡片使用固定底色；电脑端编辑弹窗和小程序编辑能回填并修改名单；按成员搜索、导出、概览类型明细都能找到多人支出。

**Independent Test**：记一笔归属「甲、乙」的支出后，电脑端时间线和小程序流水显示「甲、乙」且为淡紫底；两端按「乙」搜索能找到、按「丙」找不到；导出的归属人列为「甲、乙」；记账人把它改成只归属乙后，各处只显示乙。

### 实现

- [X] T034 [P] [US3] 修改 `frontend/src/views/record/Record.vue` 的 `belongBg`（T014 已改为接收 `string[]`）：多于 1 人时返回固定底色 `#ede7f6`，用一个具名常量（如 `MULTI_BELONG_BG`）定义，不放进现有 8 色调色板
- [X] T035 [P] [US3] 修改 `miniapp/miniprogram/utils/records.ts` 的 `belongBackground`：多于 1 人时返回 `#ede7f6`，用具名常量定义，与电脑端同色
- [X] T036 [US3] 修改 `frontend/src/views/record/hooks/use-add-edit.ts` 的编辑表单（依赖 T023、T024）：`operateData` 的归属人改为 `string[]`，打开编辑时用 `row.belongUserIds` 回填（空数组回填为 `['']`），接入 `useBelongSelect`，提交时用 `toBelongUserIds()`；不改归属人只改金额时提交的名单与原来相同
- [X] T037 [US3] 修改 `frontend/src/views/record/Record.vue` 编辑弹窗的归属人（第 199 行）（依赖 T036）：与 T025 相同的多选 / 收入单选写法；第 101 行搜索框和第 294 行批量解析表格保持单选不动
- [X] T038 [US3] 核对 `miniapp/miniprogram/components/record-form/index.ts` 的编辑回填（依赖 T028）：`mode` 为编辑时用 `initial.belongUserIds` 回填标签选中态和拼接名；不改归属人保存时提交的名单不变。如 T028 已覆盖，在任务完成说明里写明已核对
- [X] T039 [US3] 核对搜索与导出：确认 `server/routes/transaction/controller.js` 的列表和导出都经过 `buildBelongWhere`（T008），导出 Excel 的「归属人」列直接输出 `belongUserName`（多人为「甲、乙」）；确认 `frontend/src/views/overview/hooks/use-type-chart.ts` 的类型明细（T015）对多人行按 `belongUserIds.includes(slot.userId)` 命中、金额显示原记账金额
- [X] T040 [US3] 按 [quickstart.md](./quickstart.md) 第 2 节第 5、6 步、第 3 节第 5 步、第 4 节和第 5 节验收，包括 SC-009：同一组条件在电脑端和小程序搜索，返回的记录逐条一致

**Checkpoint**：多人归属的账在各处能看到、找到、改到。

---

## 阶段 6：用户故事 4 - 小程序记住上次的归属人组合（Priority: P3）

**Goal**：小程序记支出时默认上次的名单；记收入时上次是单人则默认该人，否则默认自己；「再记一笔」保留名单。

**Independent Test**：小程序记一笔归属「甲、乙」的支出后再进入记一笔，默认已选甲、乙；点「再记一笔」后仍是甲、乙；这时切换成记收入，默认是自己。

### 实现

- [X] T041 [US4] 修改 `miniapp/miniprogram/components/record-form/index.ts` 读取上次偏好的逻辑（第 112～119 行）（依赖 T019、T028）：支出时直接用 `pref.belongUserIds` 和 `pref.belongUserName`，并过滤掉已不在当前账本成员里的 id（过滤后多人变成 1 人或 0 人时同步重算拼接名）；收入时 `pref.belongUserIds.length === 1` 且该人仍是成员则用他，否则用自己
- [X] T042 [US4] 修改 `miniapp/miniprogram/components/record-form/index.ts` 的「再记一笔」重置逻辑（依赖 T041）：只清空金额、描述、照片，保留日期、收支类型和 `belongUserIds` / `belongUserName`，不触发提交
- [X] T043 [US4] 按 [quickstart.md](./quickstart.md) 第 3 节第 2、4 步和第 6.2 节第 3 步验收：包括「旧版本缓存里只有 `belongUserId` 时，新版本第一次打开能正确默认」

**Checkpoint**：四个用户故事全部完成。

---

## 阶段 7：收尾与跨端事项

**目的**：文档、残留清理和上线演练。

- [X] T044 [P] 更新 `docs/用户手册.md`（FR-019）：「3.2 记账人与归属人」改为「支出可选全部、一名或多名成员，收入只能选一名成员且没有『全部』，勾满全部成员不等于『全部』」；电脑端新增与编辑、小程序记一笔与编辑两处补充多选操作说明；概览分摊说明补充「多人支出只在选中的人之间按有效收入比例分，同一组人的多笔先汇总再分」，并加一个三人账本中甲、乙两人吃饭 200 元、甲付款的例子，结果写成「乙 → 甲 转 100.00 元」；注明手机网页不支持多人归属
- [X] T045 [P] 全仓库搜索残留：在 `server/routes/`、`server/database/`、`frontend/src/`、`miniapp/miniprogram/`（排除 `miniprogram_npm`）中搜索 `belongUserId`，除「数据库属性内部使用」「`quantityInputs[].belongUserId`」「`use-parse.ts` 表格行」「`record-search` 页面内部单选值」「`storage.ts` 旧缓存兼容」「`Record.vue` 批量表格和搜索框单选值」外不应再有出现；`frontend` 运行 `npx vue-tsc --noEmit`（或项目已有的类型检查命令）无新增报错；小程序在开发者工具中编译无报错
- [X] T046 按 [quickstart.md](./quickstart.md) 第 6.1 节在线上库副本上演练升级与回滚（含重复执行升级脚本，以及 FR-022 的「服务端和小程序成套回滚」），第 6.2 节第 1、2 步演练旧版本小程序被拒绝和强制更新，第 7 节完成回归（预算、照片、导入 Excel、批量解析录入不变）
- [x] T047 更新 `specs/004-multi-belong-users/checklists/requirements.md` 底部 Notes 中关于「手机网页兼容」的过时说明，改为「手机网页不改、上线后记账写入会被拒绝（FR-018）」

---

## 依赖与执行顺序

### 阶段依赖

- **阶段 1 准备**：无依赖，可以马上开始。T001 必须在改动 `overviewSettlement.js`（T030）之前完成。
- **阶段 2 基础**：依赖阶段 1 的 T002（本地库要先升级）。**阻塞所有用户故事。** 服务端 T005～T010 与电脑端 T011～T016、小程序 T017～T021 可以并行开发，但必须一起完成后才能做 T022。
- **阶段 3 US1**：依赖阶段 2。
- **阶段 4 US2**：依赖阶段 2；代码上不依赖 US1（纯函数可用构造数据验证），页面验收需要 US1 能记出多人支出。
- **阶段 5 US3**：依赖阶段 2 和 US1 的 T023（共用 hook）、T028（小程序标签）。
- **阶段 6 US4**：依赖 US1 的 T028。
- **阶段 7 收尾**：依赖所有故事完成。

### 用户故事依赖

- **US1（P1）**：阶段 2 完成即可开始，不依赖其它故事。
- **US2（P1）**：阶段 2 完成即可开始，与 US1 并行；只改服务端。
- **US3（P2）**：依赖 US1 的共用 hook 和小程序标签组件。
- **US4（P3）**：依赖 US1 的小程序标签组件。

### 同一文件的串行约束

- `server/routes/transaction/controller.js`：T007 → T008 → T009。
- `server/database/services/overviewSettlement.js`：T030 → T031。
- `frontend/src/views/record/hooks/use-add-edit.ts`：T013 → T024 → T036。
- `frontend/src/views/record/Record.vue`：T014 → T025 → T034 → T037。
- `miniapp/miniprogram/components/record-form/index.ts`：T020 → T028 → T038 → T041 → T042。
- `miniapp/miniprogram/utils/records.ts`：T017 → T035。

### 可并行的任务

- 阶段 1：T002、T003 并行。
- 阶段 2：T005、T006、T011、T014、T015、T016、T017、T018 并行；T021 与任何任务都不冲突。
- 阶段 3 与阶段 4：US1（电脑端、小程序）与 US2（服务端分账）可以由不同人同时做；US1 内部 T023、T026、T027 并行。
- 阶段 5：T034、T035 并行。
- 阶段 7：T044、T045 并行。

---

## 并行示例：阶段 2 基础

```text
# 服务端、电脑端、小程序三条线同时开工：
任务："修改 server/database/models/index.js 两列长度（T005）"
任务："新建 server/database/services/belongUsers.js（T006）"
任务："修改 frontend/src/types/bill.d.ts 与 record/type.d.ts（T011）"
任务："修改 frontend/src/views/overview/hooks/use-type-chart.ts（T015）"
任务："修改 miniapp/miniprogram/utils/records.ts（T017）"
任务："修改 miniapp/miniprogram/app.ts 强制更新（T021）"
```

## 并行示例：用户故事 1

```text
任务："新建 frontend/src/views/record/hooks/use-belong-select.ts（T023）"
任务："修改 miniapp/miniprogram/components/record-form/index.wxml（T026）"
任务："修改 miniapp/miniprogram/components/record-form/index.wxss（T027）"
```

---

## 实施策略

### 最小可用版本（阶段 2 + US1 + US2）

1. 完成阶段 1、阶段 2，跑 T022，确认字段替换没有改变任何现有行为。
2. 完成 US1：能记下多人支出。
3. 完成 US2：概览按多人分账。
4. **停下验收**：US1 单独上线没有意义（多人支出在概览里会被当成局外人），所以最小可上线范围是 US1 + US2 一起。

### 增量交付

1. 阶段 1 + 阶段 2 → 字段替换完成。可以先上线这一步（执行 SQL、发服务端和电脑端、发小程序），提前完成旧版本小程序的强制更新过渡。
2. US1 + US2 → 多人记账和分账可用（MVP）。
3. US3 → 编辑、搜索、底色完整。
4. US4 → 小程序记住上次的组合。
5. 收尾 → 用户手册、残留清理、回滚演练。

### 上线顺序（每次发布都遵守）

执行 `deploy/sql/004-multi-belong-users-upgrade.sql` 并核对 → 发布服务端和电脑端 → 立即提交小程序新版本审核并发布。

---

## Notes

- [P] 表示不同文件且没有未完成的依赖。
- [Story] 标签对应 spec.md 中的用户故事，方便追溯。
- 每完成一个任务或一组相关任务就提交一次，提交信息用中文，如 `feat: 记账接口改用 belongUserIds 并校验归属人名单`。
- `server/` 下的 `tmp-*` 文件只用于本地核对，不提交。
- 概览左侧明细保持只显示收入，不新增多人支出行（规格 FR-011），没有对应任务。

## Phase 8: Convergence

- [X] T048 更新 `docs/用户手册.md`，使手机网页的说法与「上线后不能再新增、编辑记账」一致：第 1 章能力表里移动端记账改为不能新增和编辑、第 43 行「手机网页同样可以补记」改为改用小程序或电脑端，第 10 章开头「适合在外快速补记」以及 10.4、10.5 的新增和编辑步骤改为说明这些操作已停用 per FR-019 (partial)
