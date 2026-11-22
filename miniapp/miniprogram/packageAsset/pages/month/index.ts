import { getAssetMembers, getMonthlyReport } from '../../../apis/index'
import { appShareBehavior } from '../../../behaviors/app-share'
import { assetViewState, bindAssetBill } from '../../../utils/asset-view'
import { guardPage } from '../../../utils/auth'
import { deltaText, moneyText, shortText, toneClass } from '../../../utils/asset-format'
// 图表库放在资产分包，避免撑进主包
// eslint-disable-next-line @typescript-eslint/no-var-requires
const echarts = require('../../components/ec-canvas/echarts')

const KEYS = ['总资产', '总净资产', '流动资金', '投资理财', '固定资产', '应收款', '总负债']
const COLORS: Record<string, string> = {
  总资产: '#4285f4',
  总净资产: '#18a356',
  流动资金: '#5b8ff9',
  投资理财: '#5ad8a6',
  固定资产: '#f6bd16',
  应收款: '#6dc8ec',
  总负债: '#f74f4f'
}

type MonthRow = { name: string; values: (number | null)[]; color: string; highlight: number }

function textWidth(text: string) {
  let width = 0
  for (const char of text) width += char.charCodeAt(0) > 255 ? 12 : 7
  return width
}

/** 小程序图表包没有 tooltip 组件，按 mobile 的白底提示自己画在画布上。 */
function paintTip(chart: any, monthIndex: number, row: MonthRow, hidden: boolean, anchorY: number) {
  const zr = chart.getZr()
  if (!chart.__tip) {
    chart.__tip = new echarts.graphic.Group({ silent: true })
    zr.add(chart.__tip)
  }
  const group = chart.__tip
  group.removeAll()
  chart.__tipMonth = monthIndex
  if (monthIndex < 0) {
    zr.refresh()
    return
  }
  const value = row.values[monthIndex]
  const title = `${monthIndex + 1}月`
  const text = value == null ? '没有盘点' : moneyText(Number(value), hidden)
  const boxW = Math.max(textWidth(title), textWidth(text)) + 20
  const boxH = 42
  const pixel = chart.convertToPixel({ seriesIndex: 0 }, [monthIndex, value == null ? 0 : value])
  const x = Array.isArray(pixel) ? pixel[0] : pixel
  const y = value == null ? anchorY : (Array.isArray(pixel) ? pixel[1] : anchorY)
  const width = chart.getWidth()
  const height = chart.getHeight()
  let left = x - boxW / 2
  let top = y - boxH - 8
  if (left < 4) left = 4
  if (left + boxW > width - 4) left = width - 4 - boxW
  if (top < 2) top = Math.min(y + 10, height - boxH - 2)
  group.add(new echarts.graphic.Rect({
    shape: { x: left, y: top, width: boxW, height: boxH, r: 4 },
    style: { fill: '#fff', stroke: 'rgba(0,0,0,0.08)', lineWidth: 1, shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.16)', shadowOffsetY: 2 },
    silent: true,
    z: 100
  }))
  group.add(new echarts.graphic.Text({
    style: { x: left + 10, y: top + 6, text: `${title}\n${text}`, fill: '#666', font: '12px sans-serif', lineHeight: 16, align: 'left', verticalAlign: 'top' },
    silent: true,
    z: 101
  }))
  zr.refresh()
}

function barOption(row: MonthRow, hidden: boolean) {
  const hasNegative = row.values.some((value) => value != null && value < 0)
  return {
    grid: { left: 4, right: 8, top: 10, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category',
      data: row.values.map((_, index) => String(index + 1)),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#e6e6e6' } },
      axisLabel: {
        color: '#999',
        fontSize: 10,
        interval: 0,
        formatter: (label: string) => (Number(label) === row.highlight ? `{now|${label}}` : label),
        rich: { now: { color: '#4285f4', fontWeight: 600, fontSize: 10 } }
      }
    },
    yAxis: {
      type: 'value',
      min: hasNegative ? undefined : 0,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#f2f3f5' } },
      axisLabel: { color: '#999', fontSize: 10, formatter: (value: number) => shortText(value, hidden) }
    },
    series: [{
      type: 'bar',
      barMaxWidth: 16,
      data: row.values.map((value, index) => ({
        value,
        itemStyle: {
          color: row.color,
          borderRadius: value != null && value < 0 ? [0, 0, 3, 3] : [3, 3, 0, 0],
          borderColor: index + 1 === row.highlight && value != null ? '#1d4f91' : 'transparent',
          borderWidth: index + 1 === row.highlight && value != null ? 1.5 : 0
        }
      }))
    }]
  }
}

Page({
  behaviors: [appShareBehavior],
  data: {
    billId: '',
    memberId: '',
    members: [] as any[],
    year: new Date().getFullYear(),
    nowYear: new Date().getFullYear(),
    years: Array.from({ length: 6 }, (_, index) => new Date().getFullYear() - index),
    rows: [] as any[],
    error: '',
    ec: { lazyLoad: true }
  },
  chartRows: [] as MonthRow[],
  charts: [] as any[],

  async onLoad(query: Record<string, string | undefined>) {
    if (!(await guardPage())) return
    bindAssetBill(query.billId || '')
    this.setData({ billId: query.billId || '', memberId: assetViewState().memberId })
    this.load()
  },
  pickMember(event: WechatMiniprogram.BaseEvent) {
    const memberId = event.currentTarget.dataset.id || ''
    assetViewState().memberId = memberId
    this.setData({ memberId })
    this.load()
  },
  pickYear(event: WechatMiniprogram.BaseEvent) {
    this.setData({ year: Number(event.currentTarget.dataset.year) })
    this.load()
  },
  onUnload() {
    this.charts.forEach((chart) => chart?.dispose())
    this.charts = []
  },
  shift(event: WechatMiniprogram.BaseEvent) {
    this.setData({ year: this.data.year + Number(event.currentTarget.dataset.step) })
    this.load()
  },
  async load() {
    const res = await getMonthlyReport(this.data.billId, this.data.year, assetViewState().memberId)
    const memberRes = await getAssetMembers(this.data.billId)
    if (res.retCode !== 0) {
      this.setData({ error: res.message || '月历没有加载出来' })
      return
    }
    const hidden = assetViewState().hideAmount
    const limit = this.data.year === this.data.nowYear ? new Date().getMonth() + 1 : 12
    this.chartRows = KEYS.map((name) => {
      const row = res.data?.[name] || {}
      return {
        name,
        values: ((row.monthlyData || []) as (number | null)[]).slice(0, limit),
        color: COLORS[name] || '#4285f4',
        highlight: limit
      }
    })
    this.setData({
      error: '',
      members: memberRes.data || [],
      rows: this.chartRows.map((item) => {
        const row = res.data?.[item.name] || {}
        const current = item.values[item.values.length - 1]
        return {
          name: item.name,
          current: current == null ? '—' : moneyText(current, hidden),
          change: current == null ? '—' : deltaText(row.yearChange, hidden),
          changeClass: toneClass(row.yearChange, item.name === '总负债')
        }
      })
    }, () => wx.nextTick(() => this.draw(hidden)))
  },
  draw(hidden: boolean) {
    this.chartRows.forEach((row, index) => {
      const existing = this.charts[index]
      if (existing && !existing.isDisposed?.()) {
        if (existing.__tipMonth >= 0) paintTip(existing, -1, row, hidden, 0)
        existing.setOption(barOption(row, hidden), true)
        return
      }
      const comp = this.selectComponent(`#monthChart${index}`) as any
      if (!comp) return
      comp.init((canvas: any, width: number, height: number, dpr: number) => {
        const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr })
        canvas.setChart(chart)
        chart.setOption(barOption(row, hidden))
        const show = (event: { offsetX: number; offsetY: number }) => {
          const current = this.chartRows[index]
          if (!current) return
          const raw = chart.convertFromPixel({ seriesIndex: 0 }, [event.offsetX, event.offsetY])
          const monthIndex = raw && isFinite(raw[0]) ? Math.round(raw[0]) : -1
          const hit = monthIndex >= 0 && monthIndex < current.values.length ? monthIndex : -1
          if (hit === chart.__tipMonth) return
          this.charts.forEach((other) => {
            if (other && other !== chart && other.__tipMonth >= 0) paintTip(other, -1, current, assetViewState().hideAmount, 0)
          })
          paintTip(chart, hit, current, assetViewState().hideAmount, event.offsetY)
        }
        chart.getZr().on('mousemove', show)
        chart.getZr().on('click', show)
        this.charts[index] = chart
        return chart
      })
    })
  }
})
