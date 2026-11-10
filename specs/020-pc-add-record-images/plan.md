# Implementation Plan: PC 端新增记账支持附图

**Branch**: `020-pc-add-record-images` | **Date**: 2026-11-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/020-pc-add-record-images/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

电脑网页「记账 → 单条新增」补上附图能力，并把 **PC 新增与编辑** 的上传时机统一为 **保存时再传**（对齐小程序/H5）：选图仅本地校验与预览，点保存才 `uploadTransactionImage` 再带 `imageIds` 挂接，避免取消产生未挂接脏数据。限度与交互：最多 9 张 / 单张 ≤10MB / jpeg·png·gif·webp、保存前可单张删除、支出/收入切换保留已选照片。复用既有上传与新增/编辑可选 `imageIds`（见 `002` 契约），**默认不改后端表结构与公开响应形状**。AI 批量解析不附图。同步改掉界面「新记一笔不能附照片」提示与 `docs/用户手册.md`。

## Technical Context

**Language/Version**: TypeScript；PC 前端 Vue 3 + Vite（`frontend/`）。后端 Node.js + Koa 2（`server/`）仅作既有契约复用，本切片默认零后端改动。

**Primary Dependencies**: 既有 Element Plus 记账页；既有 `uploadTransactionImage` / `addTransaction`；不新增框架或 OSS 客户端依赖。

**Storage**: 复用既有 `transaction_images` + 阿里云私有桶；无新表、无迁移。

**Testing**: 仓库无可用自动化测试脚本；按 [quickstart.md](./quickstart.md) 手工验收 PC 新增附图，并回归编辑看图、批量解析、小程序/H5 既有附图。

**Target Platform**: 电脑网页 `/pc/` 记账页；小程序与 mobile-h5 仅回归（本切片不改其代码）。

**Project Type**: monorepo 增量；本切片改动落点为 `frontend/src/views/record/` + `docs/用户手册.md`。

**Performance Goals**: 日常办公网络下，选 3 张普通小票并完成单条新增，1 分钟内保存成功并可再打开（SC-001）。

**Constraints**: 改 PC 单条新增附图 + PC 编辑上传时机（选图即传 → 保存时再传）与冲突文案；不改批量解析附图；不削弱账本隔离与记账人权限；密钥不进前端；公开 API 不破坏性变更。

**Scale/Scope**: 家庭账本；每笔 0～9 张；PC 新增/编辑照片草稿本地化；界面 + 手册文案同步。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

对照 `.specify/memory/constitution.md`（v3.2.0）。

| 原则 | 设计前 | 设计后 |
|------|--------|--------|
| I. 存量优先，增量规格化 | 通过。新目录 `specs/020-*`；补 PC 单条新增附图，并纠正 PC 编辑选图即传的脏数据问题；批量解析边界写清。 | 通过。设计不扩到按图搜索、导出带图、批量解析附图或新存储服务。 |
| II. 多端边界不可混用 | 通过。规格点名仅 PC；小程序 / H5 不改；不恢复旧 `mobile/`。 | 通过。落点 `frontend/src/views/record/` + 手册；后端默认不动。 |
| III. 账本隔离与记账权限 | 通过。同账本可看、仅记账人可增删；看图不授予编辑权。 | 通过。继续走既有上传鉴权与挂接校验；前端不给非记账人编辑入口。 |
| IV. 公开契约向后兼容 | 通过。复用已有可选 `imageIds` 与 `images` 列表字段；不改路径与成功响应形状。 | 通过。见 [contracts/pc-add-images.md](./contracts/pc-add-images.md)；无破坏性变更。 |
| V. 密钥与部署约束 | 通过。无新密钥；继续服务端签名查看地址。 | 通过。前端只收 `viewUrl` / 本地预览 blob，不接触 OSS 密钥。 |

无未通过的门禁。设计结束后复检，结论不变。

### Post-Design Re-check

选定方案：统一草稿类型 `PhotoDraft`；新增 `addImages`、编辑 `editImages`；选图不做 OSS 上传；点保存时先按序上传新文件，再传完整 `imageIds`；取消只清本地、不调上传；「上传成功但记账失败」允许极少未挂接残留（用户侧不可见）；支出/收入切换不清空 `addImages`；`batchAdd` 不传 `imageIds`；改 tip 与手册。Gate 在手册与界面文案落地后完全关闭。

## Project Structure

### Documentation (this feature)

```text
specs/020-pc-add-record-images/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── pc-add-images.md
├── checklists/requirements.md
└── tasks.md                 # /speckit-tasks 生成，本命令不创建
```

### Source Code (repository root)

```text
frontend/src/views/record/
├── Record.vue                 # 新增表单加照片区；改掉「新记一笔不能附照片」提示
├── hooks/use-add-edit.ts      # addImages；编辑改为保存时上传；取消只清本地
├── api.ts                     # 复用 uploadTransactionImage / addTransaction（只读确认）
└── type.d.ts                  # 草稿项可含本地 file / 预览 url（按需扩展）

docs/用户手册.md               # 6.5 / 6.6 等：单条新增可附图；删除「新记一笔不能附照片」

# 明确不改（默认）
server/                        # 既有 imageIds 挂接已满足；无新表
miniapp/                       # 仅回归（已是保存时上传）
mobile-h5/                     # 仅回归
frontend 批量解析 / batchAdd   # 不传 imageIds
概览、预算、计划、导出         # 不动
```

**Structure Decision**: 能力落在既有 PC 记账页模块内；新增附图 + 编辑上传时机对齐小程序/H5「保存时再传」。不新开页面、不新开后端模块。手册与界面文案同一切片交付。

## Complexity Tracking

无宪章违规，不填本表。
