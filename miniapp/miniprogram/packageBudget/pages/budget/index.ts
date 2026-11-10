import { budgetAdd, budgetDelete, budgetEdit, getBillDetail, getBudget } from '../../../apis/index'
import { guardPage } from '../../../utils/auth'
import { budgetTone } from '../../utils/budget-tone'
// ec-canvas 自带的 echarts 构建产物（随预算分包，避免撑爆主包）
// eslint-disable-next-line @typescript-eslint/no-var-requires
const echarts = require('../../components/ec-canvas/echarts')

function formatMoney(n: number) {
  return Math.abs(Number(n) || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

/** 过万缩写为「万」，对齐原型 aShort */
function shortMoney(n: number) {
  const abs = Math.abs(Number(n) || 0)
  if (abs < 10000) return formatMoney(abs)
  const wan = Math.round(abs / 100) / 100
  return (Math.abs(wan - Math.round(wan)) < 0.001 ? String(Math.round(wan)) : wan.toFixed(2)) + '万'
}

function pctText(part: number, total: number) {
  return (!total ? '0.0' : ((part / total) * 100).toFixed(1)) + '%'
}

const PIE_COLORS = ['#4285f4', '#34a853', '#fbbc05', '#ea4335', '#8bc34a', '#ab47bc', '#26a69a', '#ff7043']

function fieldText(detail: unknown): string {
  if (typeof detail === 'string') return detail
  const value = (detail as { value?: string })?.value
  return value == null ? '' : String(value)
}

Page({
  data: {
    billId: '',
    year: new Date().getFullYear(),
    loading: false,
    totalBudgetText: '0.00',
    totalCostText: '0.00',
    details: [] as any[],
    cards: [] as any[],
    costTypes: [] as any[],
    typeNames: [] as string[],
    typeIds: [] as string[],
    showForm: false,
    showType: false,
    showDel: false,
    formMode: 'create' as 'create' | 'edit',
    formId: '',
    formTypeId: '',
    formTypeName: '',
    formMoney: '',
    pendingDelId: '',
    pieLegend: [] as { name: string; color: string; pct: string; amountText: string; value: number }[],
    /** 弹层打开时关掉 canvas，避免盖住遮罩 */
    showPieCanvas: true,
    ec: {
      lazyLoad: true
    }
  },

  chart: null as any,
  pieAliveCache: [] as { name: string; value: number; color: string }[],
  pieTotalCache: 0,

  onLoad(query: Record<string, string>) {
    this.setData({ billId: query.billId || '' })
  },

  async onShow() {
    const ok = await guardPage()
    if (!ok || !this.data.billId) return
    await this.load()
  },

  async load() {
    this.setData({ loading: true })
    const year = this.data.year
    const res = await getBudget(this.data.billId, year)
    this.setData({ loading: false })
    if (res.retCode !== 0 || !res.data) {
      wx.showToast({ title: res.message || '加载失败', icon: 'none' })
      return
    }
    const details = Array.isArray(res.data.details) ? res.data.details : []
    const cards = details.map((item: any) => {
      const tone = budgetTone(item.cost, item.budget)
      return {
        ...item,
        budgetText: formatMoney(item.budget),
        costText: formatMoney(item.cost),
        label: tone.label,
        color: tone.color,
        widthPercent: tone.widthPercent,
        over: tone.rate >= 1
      }
    })
    const alive = details
      .map((d: any, index: number) => ({
        name: d.costTypeName,
        value: Number(d.budget) || 0,
        color: PIE_COLORS[index % PIE_COLORS.length]
      }))
      .filter((d: any) => d.value > 0)
    const pieTotal = alive.reduce((sum: number, d: any) => sum + d.value, 0)
    const pieLegend = alive.map((d: any) => {
      const wan = Math.round(d.value / 100) / 100
      const amountText =
        (Math.abs(wan - Math.round(wan)) < 0.001 ? String(Math.round(wan)) : wan.toFixed(2)) + '万'
      return {
        name: d.name,
        color: d.color,
        value: d.value,
        pct: pctText(d.value, pieTotal),
        amountText
      }
    })
    this.pieAliveCache = alive
    this.pieTotalCache = pieTotal
    this.setData({
      totalBudgetText: shortMoney(res.data.totalBudget),
      totalCostText: shortMoney(res.data.currCost),
      details,
      cards,
      pieLegend,
      showPieCanvas: alive.length > 0
    })
    if (alive.length) {
      wx.nextTick(() => this.initPie(alive, pieTotal))
    }
  },

  /** 打开弹层前隐藏 canvas */
  hidePieForOverlay() {
    this.chart = null
    this.setData({ showPieCanvas: false })
  },

  /** 关闭弹层后恢复 canvas */
  restorePieAfterOverlay() {
    if (!this.pieAliveCache.length) return
    this.setData({ showPieCanvas: true }, () => {
      wx.nextTick(() => this.initPie(this.pieAliveCache, this.pieTotalCache))
    })
  },

  initPie(alive: { name: string; value: number; color: string }[], pieTotal: number) {
    const comp = this.selectComponent('#budgetPie') as any
    if (!comp) return
    comp.init((canvas: any, width: number, height: number, dpr: number) => {
      const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr })
      canvas.setChart(chart)
      chart.setOption({
        tooltip: {
          trigger: 'item',
          formatter: (params: any) => {
            const value = Number(params.value) || 0
            const wan = Math.round(value / 100) / 100
            const amountText =
              (Math.abs(wan - Math.round(wan)) < 0.001 ? String(Math.round(wan)) : wan.toFixed(2)) + '万'
            return `${params.name}\n${pctText(value, pieTotal)}  ${amountText}`
          }
        },
        series: [
          {
            type: 'pie',
            radius: ['0%', '92%'],
            center: ['50%', '50%'],
            label: { show: false },
            labelLine: { show: false },
            data: alive.map((d) => ({
              name: d.name,
              value: d.value,
              itemStyle: { color: d.color }
            }))
          }
        ]
      })
      this.chart = chart
      return chart
    })
  },

  onCardTap(e: WechatMiniprogram.TouchEvent) {
    const costTypeId = e.currentTarget.dataset.typeid
    const year = this.data.year
    const beginDate = `${year}-01-01`
    const endDate = `${year}-12-31`
    wx.navigateTo({
      url:
        `/packageDetail/pages/record-search/index?billId=${this.data.billId}` +
        `&type=1&costTypeId=${costTypeId}&beginDate=${beginDate}&endDate=${endDate}&autoSearch=1`
    })
  },

  async onAdd() {
    const res = await getBillDetail(this.data.billId)
    const costTypes = res.retCode === 0 && res.data ? res.data.costTypes || [] : []
    const used = new Set((this.data.details || []).map((d: any) => d.costTypeId))
    const available = costTypes.filter((t: any) => !t.hidden && !used.has(t.id))
    this.hidePieForOverlay()
    this.setData({
      showForm: true,
      formMode: 'create',
      formId: '',
      formTypeId: '',
      formTypeName: '',
      formMoney: '',
      costTypes: available,
      typeNames: available.map((t: any) => t.name),
      typeIds: available.map((t: any) => t.id)
    })
  },

  onEdit(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id
    const item = this.data.details.find((d: any) => d.id === id)
    if (!item) return
    this.hidePieForOverlay()
    this.setData({
      showForm: true,
      formMode: 'edit',
      formId: item.id,
      formTypeId: item.costTypeId,
      formTypeName: item.costTypeName,
      formMoney: String(item.budget)
    })
  },

  onDel(e: WechatMiniprogram.TouchEvent) {
    this.hidePieForOverlay()
    this.setData({ showDel: true, pendingDelId: e.currentTarget.dataset.id })
  },

  closeForm() {
    this.setData({ showForm: false })
    this.restorePieAfterOverlay()
  },
  closeType() {
    // 类型选择关掉后，编辑/新增表单可能仍开着，保持 canvas 隐藏
    this.setData({ showType: false })
  },
  closeDel() {
    this.setData({ showDel: false })
    this.restorePieAfterOverlay()
  },
  openType() {
    if (!this.data.typeNames.length) {
      wx.showToast({ title: '没有可选类型', icon: 'none' })
      return
    }
    this.setData({ showType: true })
  },
  onTypeConfirm(e: WechatMiniprogram.CustomEvent) {
    const index = Array.isArray(e.detail.index) ? e.detail.index[0] : e.detail.index
    this.setData({
      formTypeId: this.data.typeIds[index] || '',
      formTypeName: this.data.typeNames[index] || '',
      showType: false
    })
  },
  onMoney(e: WechatMiniprogram.CustomEvent) {
    this.setData({ formMoney: fieldText(e.detail) })
  },

  async onSave() {
    const money = Number(this.data.formMoney)
    if (!(money > 0)) {
      wx.showToast({ title: '金额须大于 0', icon: 'none' })
      return
    }
    if (this.data.formMode === 'create') {
      if (!this.data.formTypeId) {
        wx.showToast({ title: '请选择支出类型', icon: 'none' })
        return
      }
      const res = await budgetAdd({
        billId: this.data.billId,
        date: this.data.year,
        costTypeId: this.data.formTypeId,
        money
      })
      if (res.retCode === 0) {
        wx.showToast({ title: '新增成功', icon: 'none' })
        this.setData({ showForm: false })
        this.load()
      } else {
        wx.showToast({ title: res.message || '新增失败', icon: 'none' })
      }
      return
    }
    const res = await budgetEdit({
      id: this.data.formId,
      billId: this.data.billId,
      date: this.data.year,
      money
    })
    if (res.retCode === 0) {
      wx.showToast({ title: '已保存', icon: 'none' })
      this.setData({ showForm: false })
      this.load()
    } else {
      wx.showToast({ title: res.message || '保存失败', icon: 'none' })
    }
  },

  async confirmDel() {
    const res = await budgetDelete({
      id: this.data.pendingDelId,
      billId: this.data.billId,
      date: this.data.year
    })
    this.setData({ showDel: false })
    if (res.retCode === 0) {
      wx.showToast({ title: '已删除', icon: 'none' })
      this.load()
    } else {
      // 删除失败仍要恢复饼图
      this.restorePieAfterOverlay()
      wx.showToast({ title: res.message || '删除失败', icon: 'none' })
    }
  }
})
