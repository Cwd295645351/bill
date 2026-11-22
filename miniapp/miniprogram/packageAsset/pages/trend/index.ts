import { getAssetMembers, getAssetOverview, getAssetTrend } from '../../../apis/index'
import { appShareBehavior } from '../../../behaviors/app-share'
import { assetViewState, bindAssetBill } from '../../../utils/asset-view'
import { guardPage } from '../../../utils/auth'
import { changeShort, moneyText, shortText, toneClass } from '../../../utils/asset-format'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const echarts = require('../../components/ec-canvas/echarts')

const COLORS: Record<string, string> = {
  liquid: '#5b8ff9',
  invest: '#5ad8a6',
  fixed: '#f6bd16',
  receivable: '#6dc8ec',
  liability: '#f08bb4',
  net: '#4285f4'
}

function monthText(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function pointName(label: string) {
  const month = /^(\d{4})-(\d{2})$/.exec(label)
  if (month) return `${month[1]}年${Number(month[2])}月`
  return label || '区间起点'
}

function shortAxis(label: string) {
  const matched = /^(\d{4})-(\d{2})/.exec(label)
  if (!matched) return label
  return matched[2] === '01' ? `${matched[1].slice(2)}/${Number(matched[2])}` : String(Number(matched[2]))
}

Page({
  behaviors: [appShareBehavior],
  data: {
    billId: '',
    ranges: [
      { value: 'since', label: '记账以来' }, { value: 'thisYear', label: '今年' },
      { value: 'y1', label: '近1年' }, { value: 'y3', label: '近3年' }, { value: 'y5', label: '近5年' }, { value: 'custom', label: '自定义' }
    ],
    range: 'since',
    memberId: '',
    members: [] as any[],
    grain: 'month',
    metric: 'all',
    start: monthText(),
    end: monthText(),
    note: '',
    showChart: false,
    legend: [] as any[],
    stats: [] as any[],
    ec: { lazyLoad: true }
  },
  result: null as any,
  pick: 0,
  chart: null as any,

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
  onUnload() {
    this.chart?.dispose()
    this.chart = null
  },
  setRange(event: WechatMiniprogram.BaseEvent) { this.setData({ range: event.currentTarget.dataset.value }); this.load() },
  setGrain(event: WechatMiniprogram.BaseEvent) { this.setData({ grain: event.currentTarget.dataset.value }); this.load() },
  setMetric(event: WechatMiniprogram.BaseEvent) { this.setData({ metric: event.currentTarget.dataset.value }); this.load() },
  setStart(event: WechatMiniprogram.Input) { this.setData({ start: event.detail.value }); this.load() },
  setEnd(event: WechatMiniprogram.Input) { this.setData({ end: event.detail.value }); this.load() },

  valueAt(key: string, index: number) {
    return (this.result?.series || []).find((item: any) => item.key === key)?.values[index]
  },
  netAt(index: number) {
    if (this.data.metric === 'net') return this.valueAt('net', index) ?? null
    const nums = ['liquid', 'invest', 'fixed', 'receivable', 'liability']
      .map((key) => this.valueAt(key, index))
      .filter((value: number | null) => value != null) as number[]
    if (!nums.length) return null
    return Math.round(nums.reduce((sum, value) => sum + value, 0) * 100) / 100
  },
  buildStats() {
    const hidden = assetViewState().hideAmount
    const points: string[] = this.result?.labels || []
    const index = Math.min(this.pick, Math.max(points.length - 1, 0))
    const label = points[index] || ''
    const baseIndex = Math.max(points.findIndex((_, at) => this.netAt(at) != null), 0)
    const net = this.netAt(index)
    const baseNet = this.netAt(baseIndex)
    const delta = net == null || baseNet == null ? null : Math.round((net - baseNet) * 100) / 100
    const compared = `较${pointName(points[baseIndex] || '')}`
    if (this.data.metric === 'net') {
      return [
        { k: `${label}净资产`, n: net == null ? '—' : moneyText(net, hidden), cls: '' },
        { k: compared, n: changeShort(delta, hidden), cls: toneClass(delta, false) }
      ]
    }
    const assetNums = ['liquid', 'invest', 'fixed', 'receivable']
      .map((key) => this.valueAt(key, index))
      .filter((value: number | null) => value != null) as number[]
    const asset = assetNums.length ? Math.round(assetNums.reduce((sum, value) => sum + value, 0) * 100) / 100 : null
    const debt = this.valueAt('liability', index)
    return [
      { k: `${label}总资产`, n: asset == null ? '—' : moneyText(asset, hidden), cls: '' },
      { k: '总负债', n: debt == null ? '—' : moneyText(Math.abs(debt), hidden), cls: '' },
      { k: '净资产', n: net == null ? '—' : moneyText(net, hidden), cls: '' },
      { k: `净资产${compared}`, n: changeShort(delta, hidden), cls: toneClass(delta, false) }
    ]
  },
  areaOption() {
    const hidden = assetViewState().hideAmount
    const labels: string[] = this.result?.labels || []
    const series: { key: string; name: string; values: (number | null)[] }[] = this.result?.series || []
    const picked = labels[this.pick]
    const hasNegative = series.some((item) => item.values.some((value) => value != null && value < 0))
    return {
      grid: { left: 4, right: 12, top: 16, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis',
        confine: true,
        formatter: (params: any) => {
          const rows = Array.isArray(params) ? params : [params]
          const title = rows[0]?.axisValue || ''
          const body = rows.map((row: any) => `${row.seriesName}　${row.value == null ? '—' : moneyText(Number(row.value), hidden)}`).join('\n')
          return `${title}\n${body}`
        }
      },
      xAxis: {
        type: 'category',
        data: labels,
        boundaryGap: false,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#e6e6e6' } },
        axisLabel: {
          color: '#999',
          fontSize: 10,
          hideOverlap: true,
          formatter: (label: string) => (label === picked ? `{now|${shortAxis(label)}}` : shortAxis(label)),
          rich: { now: { color: '#4285f4', fontWeight: 600, fontSize: 10 } }
        }
      },
      yAxis: {
        type: 'value',
        min: hasNegative ? undefined : 0,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#f2f3f5' } },
        axisLabel: {
          color: '#999',
          fontSize: 10,
          formatter: (value: number) => (value < -0.004 ? `-${shortText(Math.abs(value), hidden)}` : shortText(value, hidden))
        }
      },
      series: series.map((item, index) => ({
        name: item.name,
        type: 'line',
        stack: 'asset',
        stackStrategy: 'samesign',
        areaStyle: { opacity: 0.72 },
        connectNulls: false,
        showSymbol: false,
        symbol: 'none',
        color: COLORS[item.key] || '#4285f4',
        lineStyle: { width: 1.5 },
        data: item.values,
        markLine: index === 0 && picked ? {
          silent: true,
          symbol: 'none',
          animation: false,
          label: { show: false },
          lineStyle: { color: '#c5d4ea', type: 'dashed' },
          data: [{ xAxis: picked }]
        } : undefined
      }))
    }
  },
  choose(index: number) {
    this.pick = index
    this.setData({ stats: this.buildStats() })
    this.chart?.setOption(this.areaOption(), true)
  },
  draw() {
    if (this.chart && !this.chart.isDisposed?.()) {
      this.chart.setOption(this.areaOption(), true)
      return
    }
    const comp = this.selectComponent('#trendChart') as any
    if (!comp) return
    comp.init((canvas: any, width: number, height: number, dpr: number) => {
      const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr })
      canvas.setChart(chart)
      chart.setOption(this.areaOption())
      chart.getZr().on('click', (event: { offsetX: number; offsetY: number }) => {
        if (!chart.containPixel({ gridIndex: 0 }, [event.offsetX, event.offsetY])) return
        const coord = chart.convertFromPixel({ xAxisIndex: 0 }, [event.offsetX, event.offsetY])
        const raw = Array.isArray(coord) ? coord[0] : coord
        const next = Math.round(Number(raw))
        const count = this.result?.labels?.length || 0
        if (next >= 0 && next < count) this.choose(next)
      })
      this.chart = chart
      return chart
    })
  },
  async load() {
    const now = monthText()
    let start = this.data.range === 'thisYear' ? `${new Date().getFullYear()}-01` : this.data.range === 'custom' ? this.data.start : '1970-01'
    let end = this.data.range === 'custom' ? this.data.end : now
    let note = ''
    if (this.data.range === 'custom' && start > end) {
      this.result = null
      this.setData({ note: '开始月不能晚于结束月', legend: [], stats: [], showChart: false })
      return
    }
    if (end > now) { end = now; note = '结束月晚于本月，只画到本月。' }
    if (this.data.range === 'since') {
      const overview = await getAssetOverview(this.data.billId, assetViewState().memberId)
      start = overview.data?.earliestRecordMonth || now
    }
    const shift = this.data.range === 'y1' ? 11 : this.data.range === 'y3' ? 35 : this.data.range === 'y5' ? 59 : 0
    if (shift) {
      const date = new Date()
      date.setMonth(date.getMonth() - shift)
      start = monthText(date)
    }
    const res = await getAssetTrend({
      billId: this.data.billId,
      memberId: assetViewState().memberId,
      startMonth: start,
      endMonth: end,
      grain: this.data.grain,
      metric: this.data.metric
    })
    if (res.retCode !== 0) {
      this.chart?.dispose()
      this.chart = null
      return this.setData({ note: res.message || '趋势没有加载出来', showChart: false })
    }
    const hidden = assetViewState().hideAmount
    this.result = res.data
    const labels = res.data?.labels || []
    const hasValue = (res.data?.series || []).some((item: any) => item.values.some((value: number | null) => value != null))
    const memberRes = await getAssetMembers(this.data.billId)
    this.pick = Math.max(labels.length - 1, 0)
    if (!hasValue) {
      this.chart?.dispose()
      this.chart = null
    }
    this.setData({
      members: memberRes.data || [],
      note: hasValue ? note : '这段时间没有盘点',
      showChart: hasValue,
      legend: (res.data?.legend || []).map((item: any) => ({
        key: item.key,
        name: (res.data.series || []).find((series: any) => series.key === item.key)?.name || item.key,
        color: COLORS[item.key] || '#4285f4',
        lastText: item.last == null ? '—' : moneyText(item.last, hidden),
        deltaText: changeShort(item.delta, hidden),
        cls: toneClass(item.delta, false)
      })),
      stats: hasValue ? this.buildStats() : []
    }, () => {
      if (hasValue) wx.nextTick(() => this.draw())
    })
  }
})
