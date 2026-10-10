---
description: "记账照片：小程序上传，电脑端可查看和修改"
---

# Tasks: 记账照片（小程序上传，电脑端可查看和修改）

**Input**: Design documents from `/specs/002-record-image-upload/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: 规格未要求自动化测试。不要新增测试框架。验证放在最后一阶段，按 quickstart.md 手工执行。

**Organization**: 按用户故事分阶段。同一优先级里保持规格中的先后；P1 的电脑端修改（用户故事 4）排在 P2 的小程序改图（用户故事 3）之前。`server/routes/transaction/controller.js` 与 `miniapp/miniprogram/components/record-form/`、`frontend/src/views/record/Record.vue` 都要按阶段顺序改，不能并行改同一个文件。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件，且不依赖尚未完成的任务）
- **[Story]**: 用户故事标签（US1、US2、US3、US4、US5）
- 描述里必须有具体文件路径

## Path Conventions

- 服务端：`server/`
- 小程序：`miniapp/miniprogram/`
- 电脑端：`frontend/src/views/record/`
- 手机网页端：`mobile/src/views/bill-detail/components/records/`（本次不增加照片入口）
- 手册与部署：`docs/用户手册.md`、`deploy/README.md`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 加上对象存储依赖和空的密钥项，并限制单张上传大小

- [X] T001 [P] 在 `server/package.json` 的 dependencies 加入 `ali-oss`，不改 `server` 的 test 脚本，不引入测试框架
- [X] T002 [P] 在 `server/.env.example` 增加空项 `OSS_REGION`、`OSS_BUCKET`、`OSS_ACCESS_KEY_ID`、`OSS_ACCESS_KEY_SECRET`、`OSS_URL_SECRET`，注释写明只放服务端、禁止提交真实密钥。不要把密钥写进 `miniapp/` 或 `frontend/`
- [X] T003 [P] 在 `server/app.js` 把 multipart 单文件上限设为 10485760 字节。超过时对调用方返回「单张照片不能超过 10MB」。不要修改 `deploy/nginx.conf` 与 `deploy/nginx-linux.conf` 里已有的 `client_max_body_size 200m`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 照片表、私有桶读写、上传、短期查看地址，以及新增/编辑/删除时的挂接规则。所有用户故事都依赖本阶段

**⚠️ CRITICAL**: 用户故事开始前必须完成本阶段

- [X] T004 在 `server/database/models/index.js` 新增 `transaction_images`，不要改 `transactions` 的列。字段约束原文：「id CHAR(36) 主键；bill_id 必填；transaction_id 可空；user_id 必填；object_key 必填且不返回给客户端；sort 从 0 起；size 为 1 到 10485760 的整数；content_type 仅 image/jpeg、image/png、image/gif、image/webp；viewable 默认 true；created_at。」索引为 `transaction_id`，以及 `bill_id + user_id`。建表仍走现有 `sequelize.sync()`
- [X] T005 在 `server/database/services/transactionImageService.js` 实现私有桶上传、尽力删除和查看地址签名。只认文件头为 JPEG、PNG、GIF、WebP，否则拒绝。`viewUrl` 指向本服务 `/api/v1/transaction/image/file`，`exp` 为 2 小时后的 Unix 秒，`sig` 用 `OSS_URL_SECRET` 对 `id` 与 `exp` 签名。地址里不得出现对象键或对象存储密钥。对象删除失败只记日志，不得把 `viewable` 改回 true
- [X] T006 在 `server/routes/transaction/controller.js` 与 `server/routes/transaction/index.js` 增加 `POST /api/v1/transaction/image`（multipart 字段 `file`、`billId`）。调用者必须是该账本成员，否则 message 为「未找到账本」。成功时 `data` 为 `{ id }`，照片保持未挂接。失败文案原文：「单张照片不能超过 10MB」「无法当作照片打开」「照片没有保存成功」
- [X] T007 在 `server/routes/transaction/controller.js` 的列表结果上为每条记账增加 `images`（元素仅 `id`、`sort`、`viewUrl`；没有照片时为 `[]`）。非该账本成员的 `images` 必须是 `[]` 且不带 `viewUrl`。在 `server/routes/transaction/index.js` 增加 `GET /api/v1/transaction/image/file`。放行条件原文：「签名正确且未过期；该行已挂到某笔记账；viewable 为 true；该笔记账未删除。」否则不输出图片字节。不要改列表原有字段名
- [X] T008 在 `server/routes/transaction/controller.js` 的新增与编辑中接受可选 `imageIds`。约束原文：「不传 imageIds 表示不动已有照片；传了才按顺序替换，空数组表示清空。」挂接时每一张必须属于当前 billId、上传人就是记账人、尚未挂到别的记账、仍可挂接，且总数不超过 9。任一条件失败则整次新增或编辑失败，原照片不变，未挂接的行保持不可见。新增成功时 `data` 仍为空。删除成功后把该笔照片的 `viewable` 改为 false，并尽力删除对象。不要改 `batchAddTransaction` 与 `exportData`

**Checkpoint**: 上传、列表、打开、挂接和删除后不可查看已在服务端成立。客户端可以开始做

---

## Phase 3: User Story 1 - 记一笔时附上图片并在保存后还能看到 (Priority: P1) 🎯 MVP

**Goal**: 小程序记一笔可选相册或拍照。全部上传成功后才新增这笔账。记账人再次打开能看到这些照片，顺序与选择时一致。不选照片时记账与现在一样

**Independent Test**: 从底部「记一笔」和从账本进入的记一笔各保存一笔带照片的账，再次打开张数和顺序一致。另记一笔不带照片，字段与现在一致。任一张上传失败时流水里不出现缺照片的新账。点「再记一笔」清空照片、金额和描述，保留日期和归属人。

### Implementation for User Story 1

- [X] T009 [P] [US1] 在 `miniapp/miniprogram/utils/records.ts` 的 `RecordItem` 增加可选 `images`（`id`、`sort`、`viewUrl`）。`groupRecords` 必须把原对象放进分组，不得丢掉 `images`。金额合计仍只累加 `money`
- [X] T010 [P] [US1] 在 `miniapp/miniprogram/apis/index.ts` 增加上传一张照片的方法，使用 `wx.uploadFile` 调用 `POST /api/v1/transaction/image`，并带上现有登录头。不要改已有 `addTransaction` 的路径
- [X] T011 [US1] 在 `miniapp/miniprogram/components/record-form/index.ts`、`index.wxml`、`index.wxss` 的新增模式增加相册与拍照。已选满 9 张再加时说明最多 9 张。超过 10MB 或无法当作照片打开时拒绝这一张，其它已选照片和已填内容保留。「再记一笔」清空已选照片、金额和描述，保留日期和归属人，且不产生记账。编辑模式先只展示已有照片，本阶段不要提供增删。不要改日期默认今天、编辑回填原日期的逻辑
- [X] T012 [US1] 在 `miniapp/miniprogram/pages/record-add/index.ts` 与 `miniapp/miniprogram/pages/record-create/index.ts` 按选择顺序逐张上传，全部成功后才把 `imageIds` 放进现有新增请求。任一张失败则不调用新增，保留已成功的 id，重试时只补传失败的那张。保存过程中再次点完成不得发出第二次新增。不选照片时不传 `imageIds`

**Checkpoint**: 用户故事 1 可独立验证。小程序能附上照片并再次看到；此时其它成员的查看入口和电脑端修改还未做

---

## Phase 4: User Story 2 - 同账本的人能看图，外人不能看，也不能借看图改账 (Priority: P1)

**Goal**: 同一账本的成员在小程序流水和电脑端时间线上打开同一批照片。不是记账人的人只能看，不能改。账本外的人看不到

**Independent Test**: 成员甲保存带照片的账后，成员乙在小程序和电脑端看到全部照片且顺序一致。乙不能编辑这笔账，也不能增删照片。另一个账本的成员在两端都看不到这些照片。流水和时间线上的金额、归属人、类型、备注文字不变。

### Implementation for User Story 2

- [X] T013 [P] [US2] 在 `miniapp/miniprogram/pages/bill-detail/index.wxml` 与 `index.ts` 为有 `images` 的记录增加打开照片的入口，用 `wx.previewImage` 按 `sort` 打开 `viewUrl`。该入口不得触发 `onEdit`。非本人点整行仍提示「只能编辑自己记的账单」。金额、归属人、类型、备注的现有展示不要改
- [X] T014 [P] [US2] 在 `miniapp/miniprogram/pages/record-search/index.wxml` 与 `index.ts` 使用与 T013 相同的打开方式和编辑限制。搜索仍只按文字，不要按照片内容过滤
- [X] T015 [P] [US2] 在 `frontend/src/views/record/type.d.ts` 为明细增加可选 `images`。在 `frontend/src/views/record/Record.vue` 的时间线上，有照片时给账本成员一个打开入口，预览全部 `viewUrl`。不要改归属人、类型、支付方式、金额、备注的现有文字。本阶段不要在编辑弹窗里增删照片，也不要在新增表单里加选择照片

**Checkpoint**: 用户故事 1 和 2 同时成立。两端都能看，非记账人不能借看图改账

---

## Phase 5: User Story 4 - 在电脑上查看和修改同一批照片 (Priority: P1)

**Goal**: 记账人在电脑上编辑自己的账时可以补上、去掉或换掉照片。保存后小程序看到同一结果。电脑上新记一笔不能选照片

**Independent Test**: 在电脑上去掉一张并补一张，保存后电脑端和小程序一致。不改照片只改金额，照片不变且日期仍是原来的自然日。未保存或保存失败时仍是上次成功的照片。新增表单没有选择照片，保存结果与现在一致。

### Implementation for User Story 4

- [X] T016 [P] [US4] 在 `frontend/src/views/record/api.ts` 增加上传一张照片的方法，请求 `POST /api/v1/transaction/image`。不要改已有新增、编辑路径
- [X] T017 [US4] 在 `frontend/src/views/record/hooks/use-add-edit.ts` 的编辑保存中提交当前 `imageIds`（含未改动的原 id，顺序与界面一致）。新增 `addInfo` 不传 `imageIds`。保存进行中忽略再次点击。编辑失败时不要当成已成功去刷新掉用户刚改的内容；未点确定就关弹窗不得发编辑请求
- [X] T018 [US4] 在 `frontend/src/views/record/Record.vue` 的编辑弹窗中增加补照片和去掉照片。已有 9 张再加时说明最多 9 张。超过 10MB 或无法当作照片打开时拒绝该张，原照片和已填字段保留。新增表单不要出现选择照片。不改照片只改金额时，提交的 `imageIds` 必须与打开时一致

**Checkpoint**: 电脑端可查看、可在编辑时修改，新增不附图。小程序编辑时的增删尚未做

---

## Phase 6: User Story 3 - 记账人可以补图或去掉图片 (Priority: P2)

**Goal**: 记账人在小程序编辑自己的账时可以去掉或补上照片。未保存离开或保存失败，照片仍是上次成功的那些。删除整笔后成员不能再打开

**Independent Test**: 去掉一张、另补一张后保存，再次打开与操作一致，其余照片相对顺序不变。已有 9 张时不能再加。不保存就离开，或保存失败，照片不变。删除整笔后同账本成员打不开这些照片。

### Implementation for User Story 3

- [X] T019 [US3] 在 `miniapp/miniprogram/components/record-form/index.ts`、`index.wxml`、`index.wxss` 的编辑模式允许记账人去掉已有照片、再补照片。总数仍不得超过 9 张，超过时说明已经到上限且原照片不变。只改金额或描述时，提交的照片 id 顺序与打开时一致。未点保存离开不得发编辑请求
- [X] T020 [US3] 在 `miniapp/miniprogram/pages/record-edit/index.ts` 仅在用户点保存时提交当前 `imageIds`。保存失败或 `retCode !== 0` 时不要返回上一页，也不要本地改掉服务端已保存的照片。删除仍走现有删除接口；删除成功后成员再打开应失败

**Checkpoint**: 小程序编辑可以改照片。电脑端编辑与小程序看到同一批结果

---

## Phase 7: User Story 5 - 手机网页和原有账目结果保持不变 (Priority: P2)

**Goal**: 手机网页没有照片入口。照片不改变金额、搜索、导出、概览、预算和计划

**Independent Test**: 手机网页新增、编辑、查询一笔已附照片的账时，没有查看或修改入口，字段与现在一致。概览或预算金额不因照片变化。只印在照片上的词搜不到。导出文件没有照片。

### Implementation for User Story 5

- [X] T021 [P] [US5] 不要在 `mobile/src/views/bill-detail/components/records/components/add-page/Index.vue`、`mobile/src/views/bill-detail/components/records/components/edit-page/Index.vue`、`mobile/src/views/bill-detail/components/records/api.ts` 增加照片选择、预览或 `imageIds`。这些请求必须继续不传 `imageIds`，以便服务端保留已有照片
- [X] T022 [P] [US5] 保持 `server/routes/transaction/controller.js` 的 `exportData` 与 `batchAddTransaction` 不读取 `images`、不增加照片列、不接收 `imageIds`。不要修改 `server/routes/overview` 与 `server/routes/budget` 的金额计算

**Checkpoint**: 手机网页和统计、导出保持原样

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 手册、部署域名和整条验收路径

- [X] T023 [P] 在 `docs/用户手册.md` 的「6.6 编辑与删除」写明：电脑端可以查看照片，记账人只能在编辑已有记账时增删，新记一笔不能附照片。在「10.8」旁用一两句写明：小程序记一笔可以附上照片，同一账本的成员可以查看，只有记账人可以增删。不要新写整章小程序指南，不要写对象存储或签名细节
- [X] T024 [P] 在 `deploy/README.md` 的微信小程序步骤中补一句：`uploadFile` 与 `downloadFile` 合法域名都填现有接口的 HTTPS 域名，与 `request` 相同，不带路径和端口。不要把对象存储域名写进该步骤
- [X] T025 按 `specs/002-record-image-upload/quickstart.md` 做手工验收，覆盖小程序新增、失败不落账、再记一笔、成员查看、电脑端编辑、电脑端新增不附图、删除后不可打开、手机网页与导出不变、手册句子

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无前置，可立即开始
- **Foundational (Phase 2)**: 依赖 Phase 1，阻断所有用户故事
- **User Stories (Phase 3+)**: 都依赖 Phase 2。P1 按 US1 → US2 → US4，然后 P2 的 US3 → US5
- **Polish (Phase 8)**: 依赖要交付的用户故事全部完成

### User Story Dependencies

- **User Story 1 (P1)**: Phase 2 之后即可开始，不依赖其它故事
- **User Story 2 (P1)**: Phase 2 之后即可开始。小程序流水与电脑端查看不改 `record-form`，可与 US1 并行
- **User Story 4 (P1)**: 依赖 US2 在 `frontend/src/views/record/Record.vue` 上的查看入口，避免两个人同时改这个文件。服务端替换规则已在 Phase 2 完成
- **User Story 3 (P2)**: 依赖 US1 先放好 `record-form` 的展示。服务端 `imageIds` 已在 Phase 2 完成
- **User Story 5 (P2)**: Phase 2 之后即可核对「不要改」的文件，不依赖界面故事

### Parallel Opportunities

- T001、T002、T003 可同时做
- T009 与 T010 可同时做；T012 等它们和 T011
- T013、T014、T015 可同时做
- T016 可与 US2 的界面任务并行，但 T017、T018 要等 T015 完成后再改 `Record.vue` 和编辑保存
- T021 与 T022 可同时做
- T023 与 T024 可同时做

---

## Parallel Example: User Story 2

```bash
# 三个入口互不改同一个文件，可同时做：
Task: "T013 小程序账本流水打开照片 miniapp/miniprogram/pages/bill-detail/"
Task: "T014 小程序搜索结果打开照片 miniapp/miniprogram/pages/record-search/"
Task: "T015 电脑端时间线打开照片 frontend/src/views/record/Record.vue"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Phase 1 与 Phase 2
2. 完成 Phase 3 的用户故事 1
3. **停下来验证**：小程序能附上照片，失败不产生缺图的账，再次打开顺序正确
4. 再做查看权限和电脑端

### Incremental Delivery

1. Setup + Foundational → 服务端能上传、挂接、打开
2. US1 → 小程序记一笔带照片（MVP）
3. US2 → 同账本可看，外人不能看，不能借看图改账
4. US4 → 电脑端编辑时可改，新增不可附图
5. US3 → 小程序编辑时可改
6. US5 + Polish → 确认手机网页和统计未变，补手册并按 quickstart 验收

---

## Notes

- [P] 只表示不同文件且不依赖未完成任务
- 不传 `imageIds` 的客户端必须继续不传，避免把已有照片清掉
- 电脑端新增表单不要出现选择照片
- 密钥只出现在 `server/.env`，不要写入任务以外的前端文件
- 每个阶段结束都可以按该故事的 Independent Test 停下来验收
