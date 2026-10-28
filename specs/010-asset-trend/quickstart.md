# Quickstart: 010-asset-trend

## 本地验证

1. 启动后端与 PC 前端（仓库既有方式）。
2. 打开账本 → 资产 → 资产趋势。
3. 选「记账以来」：开发者工具网络里应看到一次 `/api/v1/asset/trend`，以及（若需要最早月）一次 `/overview`；不应再出现多年串行 `/monthly-report`。
4. 打开同账本「月历」，任选一年某月，与趋势同月各类金额对照。
5. 切换成员、全部/净资产、月份/年份、自定义结束月为未来月。
6. 服务端：`npm run typecheck --prefix server`

## 回归

- 月历页 yearChange / 空档 / 今年只到本月：行为与改前一致。
