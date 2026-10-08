# Implementation Plan: 小程序编辑记账回填原日期

**Branch**: `001-fix-edit-record-date` | **Date**: 2026-10-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-fix-edit-record-date/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

微信小程序编辑已有记账时，日期被填成打开页面的当天，不改日期保存就会把历史账挪到今天。流水和搜索两条入口共用同一个记账表单，表单在挂载时无条件把日期写成今天，盖住了已经准备好的原日期。

修复只发生在小程序记账表单的日期初始化，以及用户手册里的一句说明。编辑打开后日期为该笔已保存的自然日；未改日期就保存仍提交原来的自然日；新增仍默认今天。不改接口、不改表、不改电脑网页端和手机网页端。

## Technical Context

**Language/Version**: 微信小程序原生 + TypeScript（`miniapp/`）。日期格式化继续用现有 dayjs 1.11。

**Primary Dependencies**: 现有记账表单组件、微信 `picker` 的日期模式、已有记账编辑接口。不新增依赖。

**Storage**: 不改数据库。记账明细的日期仍是毫秒时间戳（`transactions.date`，BIGINT）。表单上展示和选择用 `YYYY-MM-DD`。

**Testing**: 小程序没有自动化测试脚本。用 [quickstart.md](./quickstart.md) 在微信开发者工具里按用户路径手工验证。不为这一处回填单独引入测试框架。

**Target Platform**: 微信小程序（账本流水、搜索结果进入「编辑记录」）。

**Project Type**: 已上线记账系统上的小程序缺陷修复。

**Performance Goals**: 编辑页可供操作时，日期已经是原日期。不增加请求，不增加页面。

**Constraints**: 只改小程序编辑回填。新增默认今天不变。只有记账人本人可编辑。保存失败或未保存离开时，服务端原日期不变。公开接口的路径、字段和日期单位保持不变。

**Scale/Scope**: 一个表单组件的日期初始化，两个已有入口共用；用户手册补一句。不扩写小程序指南。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 设计前 | 设计后 |
|------|--------|--------|
| I. 存量优先，增量规格化 | 通过。只修「编辑日期被填成今天」这一处，并写明新增、其它字段、其它端不能动。 | 通过。设计没有把范围扩到搜索筛选、预算或整章手册。 |
| II. 多端边界不可混用 | 通过。规格点名微信小程序。电脑网页端、手机网页端、接口不改。 | 通过。改动落在 `miniapp/miniprogram/components/record-form/`，入口页和接口不动。 |
| III. 账本隔离与记账权限 | 通过。不放宽「只有记账人本人可编辑」，不改记账人、归属人。 | 通过。编辑权限判断保持原样，日期回填不构成新的写入入口。 |
| IV. 公开契约向后兼容 | 通过。编辑仍提交原来的日期字段，单位仍是自然日开始的毫秒时间戳。无表结构变更。 | 通过。见 [contracts/miniapp-edit-date.md](./contracts/miniapp-edit-date.md)，接口形状不改。 |
| V. 密钥与部署约束 | 通过。不涉及密钥、域名或部署。 | 通过。无新增配置。 |

无未通过的门禁。

## Project Structure

### Documentation (this feature)

```text
specs/001-fix-edit-record-date/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── miniapp-edit-date.md
└── tasks.md              # 由 /speckit-tasks 生成，本命令不创建
```

### Source Code (repository root)

```text
miniapp/miniprogram/components/record-form/index.ts   # 编辑日期初始化与保存时的日期取值
miniapp/miniprogram/components/record-form/index.wxml # 日期格已绑定表单日期，本次不改交互结构
miniapp/miniprogram/pages/record-edit/index.ts        # 打开编辑时带上原日期的展示文本
miniapp/miniprogram/utils/date.ts                     # 已有的自然日格式化；仅在需要时收紧「能否当成 YYYY-MM-DD」
docs/用户手册.md                                        # 补一句小程序编辑日期说明

# 明确不改
miniapp/miniprogram/pages/bill-detail/               # 进入编辑的方式已正确，继续把原记录交给编辑页
miniapp/miniprogram/pages/record-search/             # 同上
miniapp/miniprogram/pages/record-create/             # 新增仍默认今天，只回归验证
server/                                              # 接口与表结构不变
frontend/                                            # 电脑网页端不变
mobile/                                              # 手机网页端不变
```

**Structure Decision**: 沿用现有小程序页面。流水和搜索已经把同一条记账交给编辑页，编辑页已经把原日期格式化后交给记账表单。缺陷在表单挂载时用今天覆盖该值，并在保存时允许空日期再退回今天。因此只改表单的日期初始化与编辑保存取值，必要时让编辑页传出的日期文本必须是合法的 `YYYY-MM-DD`。

## Complexity Tracking

无宪章违规，不填本表。
