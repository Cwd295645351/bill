import { getAssetMembers, getRetirePlan, saveRetirePlan } from '../../../apis/index'
import { appShareBehavior } from '../../../behaviors/app-share'
import { assetViewState, bindAssetBill } from '../../../utils/asset-view'
import { guardPage } from '../../../utils/auth'
import { deltaText, moneyText, shortText, toneClass } from '../../../utils/asset-format'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const echarts = require('../../components/ec-canvas/echarts')

function monthIndex(text?: string) {
  if (!text || !/^\d{4}-\d{2}$/.test(text)) return null
  const [year, month] = text.split('-').map(Number)
  return year * 12 + month - 1
}
function monthName(index: number) {
  return `${Math.floor(index / 12)}年${(index % 12) + 1}月`
}
function spanText(months: number) {
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (!years) return `${rest} 个月`
  return rest ? `${years} 年 ${rest} 个月` : `${years} 年`
}

Page({
  behaviors: [appShareBehavior],
  data: {
    billId: '', memberId: '', members: [] as any[], empty: true, who: '这个账本', editing: false, amount: '', startMonth: '', targetMonth: '', formError: '',
    incomeYears: 3, expenseYears: 3, skipIdle: true, amountText: '—', netText: '—', planText: '未设置', amountPercent: '0.0%',
    exceed: '未超过', hasTarget: false, leftText: '', timePercent: '', ahead: false, idleNote: '', surplusText: '—', surplusClass: '',
    incomeText: '—', expenseText: '—', chartNote: '账户资产取每月月底的净资产。',
    verdictTitle: '', reach: '', when: '', extra: '', bad: false, message: '',
    ec: { lazyLoad: true }
  },
  chart: null as any,
  async onLoad(query: Record<string, string | undefined>) {
    if (!(await guardPage())) return
    bindAssetBill(query.billId || '')
    this.setData({ billId: query.billId || '', memberId: assetViewState().memberId, who: assetViewState().memberId ? '这名成员' : '这个账本' })
    this.load()
  },
  pickMember(event: WechatMiniprogram.BaseEvent) {
    const memberId = event.currentTarget.dataset.id || ''
    assetViewState().memberId = memberId
    this.setData({ memberId, who: memberId ? '这名成员' : '这个账本' })
    this.load()
  },
  open() { this.setData({ editing: true }) },
  close() { this.setData({ editing: false }) },
  setAmount(event: WechatMiniprogram.Input) { this.setData({ amount: event.detail.value }) },
  setStart(event: WechatMiniprogram.Input) { this.setData({ startMonth: event.detail.value }) },
  setTarget(event: WechatMiniprogram.Input) { this.setData({ targetMonth: event.detail.value }) },
  setYears(event: WechatMiniprogram.BaseEvent) {
    this.setData({ [event.currentTarget.dataset.field]: Number(event.currentTarget.dataset.value) })
    this.load()
  },
  toggleIdle() { this.setData({ skipIdle: !this.data.skipIdle }); this.load() },
  async load() {
    const res = await getRetirePlan({ billId: this.data.billId, memberId: assetViewState().memberId, incomeYears: this.data.incomeYears, expenseYears: this.data.expenseYears, skipIdle: this.data.skipIdle ? '1' : '0' })
    const memberRes = await getAssetMembers(this.data.billId)
    this.setData({ members: memberRes.data || [] })
    if (res.retCode !== 0) return wx.showToast({ title: res.message || '养老计划没有加载出来', icon: 'none' })
    const data = res.data || {}
    const plan = data.plan
    if (!plan) return this.setData({ empty: true })
    const hidden = assetViewState().hideAmount
    const now = new Date().getFullYear() * 12 + new Date().getMonth()
    const start = monthIndex(plan.startMonth)
    const target = monthIndex(plan.targetMonth)
    const amountPercent = `${Math.max(0, Math.min((data.netWorth || 0) / plan.amount, 1) * 100).toFixed(1)}%`
    const timePercent = start == null || target == null || target <= start ? '100.0%' : `${Math.max(0, Math.min((now - start) / (target - start), 1) * 100).toFixed(1)}%`
    const surplus = (data.monthlyIncome || 0) - (data.monthlyExpense || 0)
    const gap = plan.amount - (data.netWorth || 0)
    let verdictTitle = ''
    let reach = ''
    let when = ''
    let extra = ''
    let bad = false
    if (gap <= 0) {
      verdictTitle = '已达到目标金额'
      extra = `当前净资产超过目标 ${moneyText(-gap, hidden)}。`
    } else if (surplus <= 0) {
      bad = true
      verdictTitle = '按当前收支达不到目标'
      extra = `还差 ${moneyText(gap, hidden)}。`
    } else {
      const months = Math.ceil(gap / surplus)
      reach = spanText(months)
      when = monthName(now + months)
      extra = `还差 ${moneyText(gap, hidden)}。`
      if (target != null) {
        bad = target < now + months
        extra += target >= now + months ? `比目标时间早 ${spanText(target - (now + months))}。` : `比目标时间晚 ${spanText(now + months - target)}。`
      }
    }
    const idle = data.idleMonths || []
    const idleText = idle.map((item: { name?: string; month?: string }) => (this.data.memberId ? item.month : `${item.name} ${item.month}`)).join('、')
    const idleNote = !idle.length
      ? `近${this.data.incomeYears}年每个月都有收入。`
      : this.data.skipIdle
        ? `已剔除 ${idle.length} 个没有收入的月份：${idleText}。这些月份不参与收入平均，支出照常统计。`
        : `有 ${idle.length} 个月没有收入：${idleText}，目前按 0 计入收入平均。`
    this.setData({
      empty: false, amount: String(plan.amount), startMonth: plan.startMonth, targetMonth: plan.targetMonth || '',
      amountText: moneyText(plan.amount, hidden), netText: moneyText(data.netWorth, hidden), planText: plan.targetMonth || '未设置',
      amountPercent, exceed: gap < 0 ? moneyText(-gap, hidden) : '未超过', hasTarget: !!plan.targetMonth,
      leftText: target == null ? '' : (target - now > 0 ? spanText(target - now) : '已到期'), timePercent, ahead: parseFloat(amountPercent) >= parseFloat(timePercent),
      idleNote, surplusClass: toneClass(surplus, false),
      surplusText: deltaText(surplus, hidden), incomeText: moneyText(data.monthlyIncome, hidden), expenseText: moneyText(data.monthlyExpense, hidden),
      chartNote: (data.series || []).length ? `${data.series[0].month} 至 ${data.series[data.series.length - 1].month}。没有盘点的月份断开。` : '账户资产取每月月底的净资产。',
      verdictTitle, reach, when, extra, bad, message: data.message || ''
    }, () => this.drawChart(data))
  },
  onUnload() {
    this.chart?.dispose()
    this.chart = null
  },
  retireOption(data: any) {
    const series = data?.series || []
    const plan = data?.plan
    if (!series.length || !plan) return null
    const hidden = assetViewState().hideAmount
    const values = series.map((item: any) => item.value).filter((item: number | null) => item != null)
    const base = values[0] ?? 0
    const targetIndex = monthIndex(plan.targetMonth)
    const startIndex = monthIndex(series[0].month)
    const total = targetIndex != null && startIndex != null ? Math.max(targetIndex - startIndex, 1) : 1
    const goal = series.map((_: any, index: number) => {
      if (!plan.targetMonth) return plan.amount
      return Math.round((base + ((plan.amount - base) * index) / total) * 100) / 100
    })
    return {
      legend: { top: 0, itemWidth: 12, itemHeight: 8, textStyle: { fontSize: 11, color: '#666' }, data: ['账户资产', '目标进度'] },
      grid: { left: 4, right: 12, top: 28, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis',
        renderMode: 'richText',
        confine: true,
        valueFormatter: (value: number | null) => (value == null ? '—' : moneyText(Number(value), hidden))
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: series.map((item: any) => item.month),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#e6e6e6' } },
        axisLabel: {
          color: '#999',
          fontSize: 10,
          hideOverlap: true,
          formatter: (label: string) => {
            const matched = /^(\d{4})-(\d{2})$/.exec(label)
            if (!matched) return label
            return matched[2] === '01' ? `${matched[1].slice(2)}/${Number(matched[2])}` : String(Number(matched[2]))
          }
        }
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#f2f3f5' } },
        axisLabel: { color: '#999', fontSize: 10, formatter: (value: number) => shortText(value, hidden) }
      },
      series: [
        { name: '账户资产', type: 'line', showSymbol: false, connectNulls: false, color: '#4285f4', lineStyle: { width: 2 }, data: series.map((item: any) => item.value) },
        { name: '目标进度', type: 'line', showSymbol: false, color: '#e6a23c', lineStyle: { type: 'dashed', width: 2 }, data: goal }
      ]
    }
  },
  drawChart(data: any) {
    const option = this.retireOption(data)
    if (!option) return
    const paint = (chart: any) => chart.setOption(option, true)
    if (this.chart && !this.chart.isDisposed?.()) {
      paint(this.chart)
      return
    }
    wx.nextTick(() => {
      const comp = this.selectComponent('#retireChart') as any
      if (!comp) return
      comp.init((canvas: any, width: number, height: number, dpr: number) => {
        const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr })
        canvas.setChart(chart)
        paint(chart)
        this.chart = chart
        return chart
      })
    })
  },
  async save() {
    const now = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    if (!(Number(this.data.amount) > 0)) return this.setData({ formError: '目标金额必须大于 0' })
    if (this.data.startMonth > now) return this.setData({ formError: '开始月份不能晚于本月' })
    if (this.data.targetMonth && this.data.targetMonth <= now) return this.setData({ formError: '目标月份必须晚于本月' })
    const res = await saveRetirePlan({ billId: this.data.billId, memberId: assetViewState().memberId || undefined, amount: Number(this.data.amount), startMonth: this.data.startMonth, targetMonth: this.data.targetMonth || undefined })
    if (res.retCode !== 0) return this.setData({ formError: res.message || '没有保存' })
    this.setData({ editing: false, formError: '' })
    this.load()
  }
})
