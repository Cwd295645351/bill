# Research: 010-asset-trend

## Decision: 专用 GET /asset/trend

- **Choice**: 新增 chart-ready 趋势接口，月历继续用 `monthly-report`。
- **Why**: 家庭账 >7 年，「记账以来」按年串行 RTT 过多；前端映射类别易与月历分叉。
- **Reject**: 仅并行多年 monthly-report（短中期可缓解 RTT，但前端仍懂类别映射且过取整年）。
- **Vs 007 research**: 007 曾「不另开 trend」为防双口径。本决策用**共享内核**消除双口径，覆盖旧条款；不回改 007 原文。

## Decision: 共享 buildMonthEndTotals

- **Choice**: 抽出单月月末汇总；trend 与 monthly-report 共用。
- **Why**: 成功标准要求同月金额一致。
- **Perf**: 窗内一次加载盘点，内存按 cutoff 取每资产最近一条（策略 B）；短窗也可退回逐月 `getLatestSnapshotsBefore`。

## Decision: 规格治理

- **Choice**: 仅 `specs/010-asset-trend`；禁止改 001–009。
- **Why**: 用户明确归档不可动；新能力走 Spec Kit。
