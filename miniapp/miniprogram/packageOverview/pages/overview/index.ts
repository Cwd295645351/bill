import { getMobileOverview, getMobileRecords } from '../../../apis/index'
import { appShareBehavior } from '../../../behaviors/app-share'
import { guardPage } from '../../../utils/auth'

const COLORS = ['#4285f4', '#f74f4f', '#18a356', '#e6862e', '#7b61ff', '#00a3a1', '#c45c26', '#5b8def']

interface Slice {
  costTypeId: string
  name: string
  money: number
  count: number
  percent: string
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function boundsOf(dimension: string, year: number, month: number) {
  if (dimension === 'year') return { begin: `${year}-01-01`, end: `${year}-12-31` }
  return {
    begin: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(daysInMonth(year, month))}`
  }
}

function dotted(value: string) {
  return (value || '').replace(/-/g, '.')
}

function ymd(value?: number) {
  if (!value) return ''
  const date = new Date(value)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function isCrossYear(begin: string, end: string) {
  return !!begin && !!end && begin.slice(0, 4) !== end.slice(0, 4)
}

function money(value: number) {
  return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 把占比转成可点击的扇形裁剪 */
function wedge(startPct: number, endPct: number) {
  const start = (startPct / 100) * Math.PI * 2 - Math.PI / 2
  const end = (endPct / 100) * Math.PI * 2 - Math.PI / 2
  const steps = Math.max(2, Math.ceil((endPct - startPct) / 4))
  const points = ['50% 50%']
  for (let index = 0; index <= steps; index += 1) {
    const angle = start + ((end - start) * index) / steps
    points.push(`${50 + Math.cos(angle) * 50}% ${50 + Math.sin(angle) * 50}%`)
  }
  return `polygon(${points.join(',')})`
}

function decorate(slices: Slice[]) {
  let start = 0
  return (slices || []).map((item, index) => {
    const percent = Math.max(0, Number(item.percent) || 0)
    const end = start + percent
    const row = {
      ...item,
      color: COLORS[index % COLORS.length],
      bar: `${Math.min(100, percent)}%`,
      moneyText: money(item.money),
      clip: wedge(start, end)
    }
    start = end
    return row
  })
}

function currentMonth() {
  const now = new Date()
  const labelYear = now.getFullYear()
  const labelMonth = now.getMonth() + 1
  return { dimension: 'month', labelYear, labelMonth, ...boundsOf('month', labelYear, labelMonth) }
}

Page({
  behaviors: [appShareBehavior],
  data: {
    billId: '',
    dimension: 'month',
    labelYear: 0,
    labelMonth: 1,
    begin: '',
    end: '',
    beginText: '',
    endText: '',
    titleText: '',
    prevLabel: '上一月',
    nextLabel: '下一月',
    loading: false,
    loadError: '',
    totalCost: '0.00',
    investCost: '0.00',
    consumptionCost: '0.00',
    totalIncome: '0.00',
    incomes: [] as { userId: string; name: string; moneyText: string }[],
    lines: [] as string[],
    members: [] as { userId: string; name: string }[],
    showMembers: false,
    memberId: '',
    slices: [] as ReturnType<typeof decorate>,
    emptyStructure: true,
    minYear: 0,
    maxYear: 0,
    yearOptions: [] as number[],
    pickerYear: 0,
    showMonth: false,
    showYear: false,
    showRecords: false,
    recordsTitle: '',
    records: [] as { id: string; date: string; payerName: string; belongName: string; moneyText: string; remark: string }[],
    recordsLoading: false,
    ready: false,
    cumulativeIncome: false,
    crossYear: false,
    incomeTitle: '总收入',
    incomeNote: '',
    leftPage: false,
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    categoriesAll: [] as Slice[],
    categoriesMembers: [] as { userId: string; slices: Slice[] }[]
  },

  onLoad(query: Record<string, string>) {
    const period = currentMonth()
    this.setData({
      billId: query.billId || query.id || '',
      ...period,
      beginText: dotted(period.begin),
      endText: dotted(period.end),
      titleText: `${period.labelYear}年${period.labelMonth}月`,
      memberId: ''
    })
  },

  onHide() {
    this.setData({ leftPage: true })
  },

  async onShow() {
    const ok = await guardPage()
    if (!ok || !this.data.billId) return
    if (this.data.leftPage) this.setData({ cumulativeIncome: false, leftPage: false })
    this.load()
  },

  onToggle() {
    if (this.data.crossYear || isCrossYear(this.data.begin, this.data.end)) {
      this.setData({ cumulativeIncome: false, crossYear: true })
      wx.showToast({ title: '跨年时按支出区间自身的收入分账', icon: 'none' })
      return
    }
    this.setData({ cumulativeIncome: !this.data.cumulativeIncome })
    this.load()
  },

  applySlices(memberId?: string) {
    const current = memberId == null ? this.data.memberId : memberId
    const source = current
      ? (this.data.categoriesMembers.find((item) => item.userId === current)?.slices || [])
      : this.data.categoriesAll
    const slices = decorate(source)
    this.setData({ memberId: current, slices, emptyStructure: slices.length === 0 })
  },

  applyPeriod(year?: number, month?: number, dimension?: string) {
    const nextYear = year == null ? this.data.labelYear : year
    const nextMonth = month == null ? this.data.labelMonth : month
    const nextDimension = dimension || this.data.dimension
    const range = boundsOf(nextDimension, nextYear, nextMonth)
    const yearMode = nextDimension === 'year'
    this.setData({
      dimension: nextDimension,
      labelYear: nextYear,
      labelMonth: nextMonth,
      begin: range.begin,
      end: range.end,
      beginText: dotted(range.begin),
      endText: dotted(range.end),
      titleText: yearMode ? `${nextYear}年` : `${nextYear}年${nextMonth}月`,
      prevLabel: yearMode ? '上一年' : '上一月',
      nextLabel: yearMode ? '下一年' : '下一月'
    })
    this.load(range.begin, range.end)
  },

  setDimension(e: WechatMiniprogram.TouchEvent) {
    const dimension = String(e.currentTarget.dataset.dim || '')
    if (!dimension || dimension === this.data.dimension) return
    this.applyPeriod(this.data.labelYear, this.data.labelMonth, dimension)
  },

  shift(e: WechatMiniprogram.TouchEvent) {
    const step = Number(e.currentTarget.dataset.step)
    if (this.data.dimension === 'year') {
      const next = this.data.labelYear + step
      if ((this.data.minYear && next < this.data.minYear) || (this.data.maxYear && next > this.data.maxYear)) return
      this.applyPeriod(next, this.data.labelMonth, 'year')
      return
    }
    let year = this.data.labelYear
    let month = this.data.labelMonth + step
    if (month < 1) {
      month = 12
      year -= 1
    }
    if (month > 12) {
      month = 1
      year += 1
    }
    this.applyPeriod(year, month, 'month')
  },

  openCenter() {
    if (this.data.dimension === 'year') {
      this.setData({ showYear: true })
      return
    }
    this.setData({ showMonth: true, pickerYear: this.data.labelYear })
  },

  shiftPicker(e: WechatMiniprogram.TouchEvent) {
    const next = this.data.pickerYear + Number(e.currentTarget.dataset.step)
    if ((this.data.minYear && next < this.data.minYear) || (this.data.maxYear && next > this.data.maxYear)) return
    this.setData({ pickerYear: next })
  },

  pickMonth(e: WechatMiniprogram.TouchEvent) {
    const month = Number(e.currentTarget.dataset.month)
    this.setData({ showMonth: false })
    this.applyPeriod(this.data.pickerYear, month, 'month')
  },

  pickYear(e: WechatMiniprogram.TouchEvent) {
    this.setData({ showYear: false })
    this.applyPeriod(Number(e.currentTarget.dataset.year), this.data.labelMonth, 'year')
  },

  closeMonth() {
    this.setData({ showMonth: false })
  },

  closeYear() {
    this.setData({ showYear: false })
  },

  onBegin(e: WechatMiniprogram.CustomEvent) {
    const value = String(e.detail.value || '')
    if (value > this.data.end) {
      const old = this.data.begin
      wx.showToast({ title: '开始时间不能晚于结束时间', icon: 'none' })
      this.setData({ begin: '' }, () => this.setData({ begin: old, beginText: dotted(old) }))
      return
    }
    this.setData({ begin: value, beginText: dotted(value) })
    this.load(value, this.data.end)
  },

  onEnd(e: WechatMiniprogram.CustomEvent) {
    const value = String(e.detail.value || '')
    if (this.data.begin > value) {
      const old = this.data.end
      wx.showToast({ title: '开始时间不能晚于结束时间', icon: 'none' })
      this.setData({ end: '' }, () => this.setData({ end: old, endText: dotted(old) }))
      return
    }
    this.setData({ end: value, endText: dotted(value) })
    this.load(this.data.begin, value)
  },

  selectMember(e: WechatMiniprogram.TouchEvent) {
    this.applySlices(String(e.currentTarget.dataset.id || ''))
  },

  async load(beginDate?: string, endDate?: string) {
    const begin = beginDate || this.data.begin
    const end = endDate || this.data.end
    if (!this.data.billId || !begin || !end) return
    const crossYear = isCrossYear(begin, end)
    if (crossYear && this.data.cumulativeIncome) {
      this.setData({ cumulativeIncome: false, crossYear: true })
      wx.showToast({ title: '跨年时按支出区间自身的收入分账', icon: 'none' })
    } else {
      this.setData({ crossYear })
    }
    this.setData({ loading: true, loadError: '' })
    try {
      const res = await getMobileOverview(this.data.billId, begin, end, this.data.cumulativeIncome)
      if (res.retCode !== 0 || !res.data) {
        this.setData({ loadError: res.message || '加载失败' })
        return
      }
      const data = res.data
      const incomes = (data.incomes || []).map((item: { userId: string; name: string; money: number }) => ({
        userId: item.userId,
        name: item.name,
        moneyText: money(item.money)
      }))
      const opened = this.data.cumulativeIncome
      const differ =
        opened &&
        (Number(data.incomeBeginDate) !== Number(data.expenseBeginDate) ||
          Number(data.incomeEndDate) !== Number(data.expenseEndDate))
      const incomeBeginText = ymd(Number(data.incomeBeginDate))
      const incomeEndText = ymd(Number(data.incomeEndDate))
      const incomeNote = opened
        ? differ
          ? `收入区间：${incomeBeginText} 至 ${incomeEndText}`
          : `收入区间：${incomeBeginText} 至 ${incomeEndText}，与支出区间相同`
        : ''
      const minYear = Number(data.minYear) || new Date().getFullYear()
      const maxYear = Number(data.maxYear) || minYear + 10
      const yearOptions: number[] = []
      for (let year = minYear; year <= maxYear; year += 1) yearOptions.push(year)
      const members = data.members || []
      let memberId = this.data.memberId
      if (memberId && !members.some((item: { userId: string }) => item.userId === memberId)) memberId = ''
      const categoriesAll = data.categories?.all || []
      const categoriesMembers = data.categories?.members || []
      const source = memberId
        ? (categoriesMembers.find((item: { userId: string }) => item.userId === memberId)?.slices || [])
        : categoriesAll
      const slices = decorate(source)
      this.setData({
        totalCost: money(data.totalCost),
        investCost: money(data.investCost),
        consumptionCost: money(data.consumptionCost),
        totalIncome: money(data.totalIncome),
        incomeTitle: differ ? '总收入（分账区间）' : '总收入',
        incomeNote,
        incomes,
        lines: data.lines || [],
        members,
        showMembers: members.length > 1,
        memberId,
        minYear,
        maxYear,
        yearOptions,
        categoriesAll,
        categoriesMembers,
        slices,
        emptyStructure: slices.length === 0,
        ready: true
      })
    } catch {
      this.setData({ loadError: '网络异常' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async openCategory(e: WechatMiniprogram.TouchEvent) {
    const costTypeId = String(e.currentTarget.dataset.id || '')
    const name = String(e.currentTarget.dataset.name || '')
    if (!costTypeId) return
    this.setData({ showRecords: true, recordsTitle: name, records: [], recordsLoading: true })
    try {
      const query: {
        billId: string
        beginDate: string
        endDate: string
        costTypeId: string
        memberId?: string
      } = {
        billId: this.data.billId,
        beginDate: this.data.begin,
        endDate: this.data.end,
        costTypeId
      }
      if (this.data.memberId) query.memberId = this.data.memberId
      const res = await getMobileRecords(query)
      if (res.retCode !== 0 || !res.data) {
        wx.showToast({ title: res.message || '加载失败', icon: 'none' })
        this.setData({ showRecords: false })
        return
      }
      const records = (res.data.records || []).map((item: { id: string; date: string; payerName: string; belongName: string; money: number; remark: string }) => ({
        id: item.id,
        date: item.date,
        payerName: item.payerName,
        belongName: item.belongName,
        moneyText: money(item.money),
        remark: item.remark || ''
      }))
      this.setData({ records })
    } catch {
      wx.showToast({ title: '网络异常', icon: 'none' })
      this.setData({ showRecords: false })
    } finally {
      this.setData({ recordsLoading: false })
    }
  },

  closeRecords() {
    this.setData({ showRecords: false })
  }
})
