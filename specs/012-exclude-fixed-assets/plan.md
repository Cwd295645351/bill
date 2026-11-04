# Implementation Plan: 排除固定资产

**Branch**: `012-exclude-fixed-assets` | **Date**: 2026-11-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-exclude-fixed-assets/spec.md`

## Summary

在 PC 端 `AssetOverview.vue` 家庭资产卡片增加「排除固定资产」切换按钮。开启时用现有总览数据中的固定资产分类合计，从展示用的总资产与净资产中扣除；总负债与其余图表不变。默认关闭；状态仅会话内。

## Technical Context

**Language/Version**: TypeScript / Vue 3  
**Primary Dependencies**: 现有 frontend（Element Plus 非本开关必需）  
**Storage**: N/A（会话内 `ref`）  
**Testing**: 手工在总览核对数字  
**Target Platform**: PC 网页 frontend  
**Project Type**: web-app（monorepo：frontend + server）  
**Performance Goals**: 切换即时重算，无额外请求  
**Constraints**: 不改 API；不改归档 specs；不污染 package.json/.gitignore  
**Scale/Scope**: 单组件 UI + 派生计算

## Constitution Check

- 新功能落在 `specs/012-*`，不改 001–011 归档正文。  
- 优先复用 overview/categoryChanges 或 assetGroups 中固定资产金额。  
- 仅改本地 frontend 展示逻辑。

## Project Structure

### Documentation (this feature)

```text
specs/012-exclude-fixed-assets/
├── spec.md
├── plan.md
├── tasks.md
└── checklists/requirements.md
```

### Source

```text
frontend/src/views/asset/components/AssetOverview.vue
```

## Design

1. `excludeFixedAssets = ref(false)`  
2. `fixedAssetAmount`：优先 `summary.categoryChanges` 中 `typeName === '固定资产'` 的 `current`，否则 `stats.assetGroups` 同名组的 `amount`，缺省 0。  
3. 展示：`displayAsset = assetAmount - (on ? fixed : 0)`；`displayNet = netAmount - (on ? fixed : 0)`；`debt` 原样。  
4. 按钮：`<button class="btn" :class="{ active: excludeFixedAssets }">排除固定资产</button>`，复用 `asset-btn` 已有 `.active`。  
5. `actions` 允许 `flex-wrap`，避免第四枚按钮挤破布局。

## Out of Scope

后端、其他页签、持久化、归档规格修订。
