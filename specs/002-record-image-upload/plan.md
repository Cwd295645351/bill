# Implementation Plan: 记账照片（小程序上传，电脑端可查看和修改）

**Branch**: `002-record-image-upload` | **Date**: 2026-10-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-record-image-upload/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

微信小程序「记一笔」可以选相册或拍照，把最多 9 张、单张不超过 10MB 的照片附在这笔账上。照片经现有记账服务写入阿里云对象存储的私有桶。同一账本的成员在小程序和电脑端打开的是同一批照片；只有记账人能增删。电脑端新记一笔不能选照片。手机网页端不提供查看或修改。

做法见 [research.md](./research.md)：先上传得到未挂接的照片 id，再在新增或编辑里用可选的 `imageIds` 一次挂上。不传这个字段就不改已有照片，避免手机网页把照片清掉。

## Technical Context

**Language/Version**: 服务端 Node.js + Koa 2（`server/`）。电脑端 Vue 3 + Vite + TypeScript（`frontend/`）。小程序原生 + TypeScript（`miniapp/`）。

**Primary Dependencies**: 新增服务端依赖 `ali-oss`。小程序继续用 `wx.chooseMedia`、`wx.uploadFile`、`wx.previewImage`。电脑端继续用现有 Element Plus 记账页。不新增前端框架。

**Storage**: MySQL 新表 `transaction_images`（`sequelize.sync()` 建表）。对象文件在阿里云私有桶。记账主表 `transactions` 不加列。Redis 不参与照片。

**Testing**: 仓库没有可用的自动化测试脚本（`server` 的 test 仍是占位）。按 [quickstart.md](./quickstart.md) 在小程序、电脑端和手机网页上手工验收。不为照片单独引入测试框架。

**Target Platform**: 微信小程序记一笔（底部与从账本进入）、小程序账本流水；电脑网页记账时间线与编辑弹窗。手机网页端只做回归，确认没有照片入口。

**Performance Goals**: 日常家庭网络下，选好 3 张普通小票并完成记一笔，1 分钟内能保存并再次打开。列表多查一次照片，不改变金额统计。

**Constraints**: 密钥只放 `server/.env`。单张不超过 10MB，一笔最多 9 张，只接受 JPEG、PNG、GIF、WebP。不传 `imageIds` 不得清空照片。电脑端新增不附图。删除或拿下后成员立即不能打开。公开列表的原有字段不改名、不删除。

**Scale/Scope**: 家庭账本。每笔 0 到 9 张照片。不按图片内容搜索，不进导出，不改预算、概览、计划和批量解析。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 设计前 | 设计后 |
|------|--------|--------|
| I. 存量优先，增量规格化 | 通过。只加「记账可以附照片」这一层，并写明电脑新增不附图、手机网页不改、金额统计不动。 | 通过。设计没有扩到按图片搜索、导出带图、手机网页看图或对象存储定时清扫。 |
| II. 多端边界不可混用 | 通过。规格点名小程序和电脑网页。手机网页不改。后端仍是现有 Koa 服务，不另起存储服务。 | 通过。小程序落在 `miniapp/miniprogram/`，电脑端落在 `frontend/src/views/record/`，上传落在 `server/routes/transaction`。 |
| III. 账本隔离与记账权限 | 通过。同账本成员可看，只有记账人可改，记账人不可改，看照片不能变成编辑别人的账。 | 通过。挂接时核对账本和记账人。非记账人只有打开入口，没有编辑。电脑上仍只有自己的记录有编辑和删除。 |
| IV. 公开契约向后兼容 | 通过。列表只增加可选的 `images`。新增和编辑只在传入 `imageIds` 时改照片。不改路径，不改成功时新增响应的空 `data`。 | 通过。见 [contracts/transaction-images.md](./contracts/transaction-images.md)。新表可单独删除以回滚，不改 `transactions` 的列。 |
| V. 密钥与部署约束 | 通过。对象存储密钥进 `server/.env`，并写入 `.env.example` 的空项。不进小程序源码。 | 通过。查看地址的签名密钥也在服务端。部署说明补 `uploadFile` / `downloadFile` 合法域名，仍用现有接口域名。 |

无未通过的门禁。设计结束后复检，结论不变。

## Project Structure

### Documentation (this feature)

```text
specs/002-record-image-upload/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── transaction-images.md
└── tasks.md              # 由 /speckit-tasks 生成，本命令不创建
```

### Source Code (repository root)

```text
server/database/models/index.js                         # 新增 transaction_images，不改 transactions 的列
server/routes/transaction/index.js                      # 上传与打开照片的路由；新增/编辑接受可选 imageIds
server/routes/transaction/controller.js                 # 挂接、列表附加 images、删除时改为不可查看
server/database/services/                                   # 对象存储读写与签名地址，放在服务层而不是路由里
server/.env.example                                        # 增加空的 OSS 与签名密钥项
server/package.json                                        # 增加 ali-oss

miniapp/miniprogram/components/record-form/                # 记一笔和编辑时选照片、张数与大小提示、再记一笔清空
miniapp/miniprogram/pages/record-add/                      # 底部记一笔：先上传再新增
miniapp/miniprogram/pages/record-create/                   # 从账本进入的记一笔，同一套规则
miniapp/miniprogram/pages/record-edit/                     # 编辑时提交当前照片 id 列表
miniapp/miniprogram/pages/bill-detail/                     # 流水上打开照片，不改金额和备注文字；非本人仍不能进入编辑
miniapp/miniprogram/pages/record-search/                   # 搜索结果里同样能打开照片，编辑限制不变
miniapp/miniprogram/apis/index.ts                          # 上传照片

frontend/src/views/record/Record.vue                       # 时间线上的查看入口；编辑弹窗增删照片；新增表单不加选择照片
frontend/src/views/record/hooks/use-add-edit.ts            # 编辑提交 imageIds；新增不传
frontend/src/views/record/api.ts                           # 上传照片

docs/用户手册.md                                            # 电脑端编辑说明，以及小程序一两句
deploy/README.md                                           # uploadFile 与 downloadFile 合法域名

# 明确不改
mobile/                                                    # 手机网页端不查看、不上传、不修改
server/routes/transaction 的导出与批量新增                    # 不读、不写照片
frontend 与 mobile 的概览、预算、计划                         # 金额逻辑不动
```

**Structure Decision**: 沿用现有四端目录。照片不是新的页面模块，而是记账明细上的附加内容。服务端放在已有的 `transaction` 路由和数据库模型里，对象存储调用放在 `server/database/services`，避免在路由里直接拼云厂商请求。小程序新增的两个入口已经共用 `record-form`，选照片放在这个表单里。电脑端查看放在时间线，修改放在已有的编辑弹窗，新增表单保持今天的字段。

## Complexity Tracking

无宪章违规，不填本表。
