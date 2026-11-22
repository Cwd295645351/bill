import {
  getAssetLedger,
  getAssetListStats,
  getAssetMembers,
  getAssetOverview,
  getRetirePlan
} from '../../../apis/index'
import { appShareBehavior } from '../../../behaviors/app-share'
import { assetViewState, bindAssetBill } from '../../../utils/asset-view'
import { guardPage } from '../../../utils/auth'
import { dayLabel, deltaText, moneyText, shortText, signedText, toneClass } from '../../../utils/asset-format'

const ORDER = ['流动资金', '固定资产', '投资理财', '应收款', '负债']

function retireBrief(data: any, hidden: boolean) {
  const plan = data?.plan
  if (!plan) return '还没有设置目标 · 含固定资产'
  return `目标 ${shortText(plan.amount, hidden)} · 当前 ${shortText(data.netWorth, hidden)} · 含固定资产`
}

Page({
  behaviors: [appShareBehavior],
  data: {
    billId: '',
    memberId: '',
    members: [] as any[],
    empty: false,
    loaded: false,
    error: '',
    retireBrief: '还没有设置目标 · 含固定资产',
    who: '家庭净资产',
    compareLabel: '上一笔盘点',
    hideAmount: false,
    excludeFixed: false,
    netText: '—',
    assetText: '—',
    debtText: '—',
    changeText: '没有变化',
    changeClass: '',
    noBaseline: false,
    rateText: '',
    excludeNote: '',
    fourSlices: [] as any[],
    fourTotal: 0,
    debtChangeText: '没有变化',
    debtChangeClass: '',
    groups: [] as any[],
    year: new Date().getFullYear(),
    years: [] as number[],
    yearOpen: false,
    compareOpen: false,
    compareInput: '',
    defaultAsOf: '',
    today: '',
    ledger: {
      ready: false, error: '', rangeText: '', belong: '', rulesText: '',
      incomeText: '—', expenseText: '—', surplusText: '—', surplusClass: '',
      changeText: '—', diffText: '—', diffClass: '', diffTag: '', equal: false, assetSub: '', memberText: '', netText: '—'
    }
  },
  booted: false,
  async onLoad(query: Record<string, string | undefined>) {
    if (!(await guardPage())) return
    const billId = query.billId || ''
    bindAssetBill(billId)
    const state = assetViewState()
    const patch = {
      billId,
      memberId: state.memberId,
      hideAmount: state.hideAmount,
      excludeFixed: state.excludeFixed,
      year: state.ledgerYear || this.data.year,
      who: '家庭净资产',
      today: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
    }
    Object.assign(this.data, patch)
    this.setData(patch)
    this.booted = true
    this.load()
  },
  onShow() {
    if (!this.booted || !this.data.billId) return
    this.load()
  },
  pickMember(event: WechatMiniprogram.BaseEvent) {
    const memberId = event.currentTarget.dataset.id || ''
    assetViewState().memberId = memberId
    assetViewState().compareDay = ''
    this.setData({ memberId })
    this.load()
  },
  toggleHide() {
    const hideAmount = !assetViewState().hideAmount
    assetViewState().hideAmount = hideAmount
    this.setData({ hideAmount })
    this.load()
  },
  toggleFixed() {
    const excludeFixed = !assetViewState().excludeFixed
    assetViewState().excludeFixed = excludeFixed
    this.setData({ excludeFixed })
    this.load()
  },
  toggleGroup(event: WechatMiniprogram.BaseEvent) {
    const name = event.currentTarget.dataset.name
    this.setData({
      groups: this.data.groups.map((group) => group.name === name ? { ...group, open: !group.open } : group)
    })
  },
  go(event: WechatMiniprogram.BaseEvent) {
    const url = event.currentTarget.dataset.url
    wx.navigateTo({ url: `${url}?billId=${this.data.billId}` })
  },
  goMembers() {
    wx.navigateTo({ url: `/packageAsset/pages/members/index?billId=${this.data.billId}` })
  },
  goRecords(event: WechatMiniprogram.BaseEvent) {
    wx.navigateTo({ url: `/packageAsset/pages/records/index?billId=${this.data.billId}&assetId=${event.currentTarget.dataset.id}` })
  },
  openYears() {
    this.setData({ yearOpen: true })
  },
  closeYears() {
    this.setData({ yearOpen: false })
  },
  openCompare() {
    const compareInput = assetViewState().compareDay || this.data.defaultAsOf || ''
    this.setData({ compareOpen: true, compareInput })
  },
  closeCompare() {
    this.setData({ compareOpen: false })
  },
  setCompare(event: WechatMiniprogram.PickerChange) {
    this.setData({ compareInput: String(event.detail.value) })
  },
  clearCompare() {
    this.setData({ compareInput: this.data.defaultAsOf || '' })
  },
  applyCompare() {
    assetViewState().compareDay = this.data.compareInput
    this.setData({ compareOpen: false })
    this.load()
  },
  chooseYear(event: WechatMiniprogram.BaseEvent) {
    const year = Number(event.currentTarget.dataset.year)
    assetViewState().ledgerYear = year
    this.setData({ year, yearOpen: false })
    this.loadLedger()
  },
  async load() {
    const { billId, memberId, hideAmount, excludeFixed } = this.data
    const [memberRes, statsRes, overviewRes, retireRes] = await Promise.all([
      getAssetMembers(billId),
      getAssetListStats(billId, memberId),
      getAssetOverview(billId, memberId, assetViewState().compareDay || undefined),
      getRetirePlan({ billId, memberId: memberId || undefined, incomeYears: 3, expenseYears: 3, skipIdle: '1' })
    ])
    if (memberRes.retCode !== 0 || overviewRes.retCode !== 0) {
      this.setData({ error: memberRes.message || overviewRes.message || '无权查看该账本', loaded: false })
      return
    }
    const members = memberRes.data || []
    if (memberId && !members.some((item) => item.id === memberId)) {
      assetViewState().memberId = ''
      this.setData({ memberId: '' })
      this.load()
      return
    }
    const overview = overviewRes.data || {}
    const fixed = (statsRes.data?.assetGroups || []).find((group: any) => group.typeName === '固定资产')
    const assetAmount = Math.max((overview.assetAmount || 0) - (excludeFixed && fixed ? fixed.amount : 0), 0)
    const netAmount = (overview.netAmount || 0) - (excludeFixed && fixed ? fixed.amount : 0)
    const baseline = assetViewState().compareDay || overview.defaultAsOf || ''
    const groups = ORDER.map((name) => {
      const source = [...(statsRes.data?.assetGroups || []), ...(statsRes.data?.debtGroups || [])].find((group: any) => group.typeName === name)
      if (!source?.assets?.length) return null
      const change = source.assets.reduce((sum: number, row: any) => sum + Number(row.change || 0), 0)
      const debt = name === '负债'
      const amount = Number(source.amount ?? source.assets.reduce((sum: number, row: any) => sum + Number(row.latestAmount || 0), 0))
      const base = debt ? Number(overview.debtAmount || 0) : Number(overview.assetAmount || 0)
      const share = `占${debt ? '负债' : '资产'} ${base ? ((amount / base) * 100).toFixed(1) : '0.0'}%`
      return {
        name,
        open: this.data.groups.find((group) => group.name === name)?.open || false,
        share,
        amountText: shortText(amount, hideAmount),
        changeText: deltaText(change, hideAmount),
        changeClass: toneClass(change, debt),
        blocks: source.assets.reduce((list: any[], row: any) => {
          const name = row.memberName || '未命名'
          let block = list.find((item) => item.name === name)
          if (!block) {
            block = { name, amount: 0, rows: [] as any[] }
            list.push(block)
          }
          block.amount += Number(row.latestAmount || 0)
          const symbol = row.currency === 'HKD' ? 'HK$' : row.currency === 'USD' ? 'US$' : ''
          block.rows.push({
            id: row.id,
            name: row.name,
            fx: symbol && row.rawAmount != null ? symbol + moneyText(row.rawAmount, hideAmount) : '',
            amountText: moneyText(row.latestAmount, hideAmount),
            changeText: deltaText(row.change, hideAmount),
            changeClass: toneClass(row.change, debt)
          })
          return list
        }, []).map((block: any) => ({
          name: block.name,
          amountText: moneyText(block.amount, hideAmount),
          rows: block.rows
        }))
      }
    }).filter(Boolean)
    const rows = [...(statsRes.data?.assetGroups || [])].flatMap((group: any) => group.assets || [])
    const fourNames = [
      { key: 'living', name: '活钱', color: '#5b8ff9' },
      { key: 'steady', name: '稳健', color: '#5ad8a6' },
      { key: 'longterm', name: '长期', color: '#f6bd16' }
    ]
    const fourAmounts = fourNames.map((item) => ({
      ...item,
      amount: rows.filter((row: any) => row.fourMoneyType === item.key && row.type !== 'debt').reduce((sum: number, row: any) => sum + Number(row.latestAmount || 0), 0)
    }))
    const fourTotal = fourAmounts.reduce((sum, item) => sum + item.amount, 0)
    this.setData({
      members,
      empty: !groups.length,
      who: (members.find((item) => item.id === memberId)?.name || '') ? `${members.find((item) => item.id === memberId)?.name}的净资产` : '家庭净资产',
      compareLabel: dayLabel(baseline),
      compareInput: baseline,
      defaultAsOf: overview.defaultAsOf || '',
      netText: signedText(netAmount, hideAmount),
      assetText: shortText(assetAmount, hideAmount),
      debtText: shortText(overview.debtAmount, hideAmount),
      changeText: baseline ? deltaText(overview.totalChange, hideAmount) : '没有变化',
      changeClass: toneClass(baseline ? overview.totalChange : 0, false),
      debtChangeText: baseline ? deltaText(overview.debtChange, hideAmount) : '没有变化',
      debtChangeClass: toneClass(baseline ? overview.debtChange : 0, true),
      noBaseline: !baseline,
      excludeNote: excludeFixed ? '只从这张卡片的总资产和净资产里去掉固定资产，总负债、分组和其他页面不变。' : '',
      rateText: `1 港币 = ${moneyText(overview.hkdRate)} 元，1 美元 = ${moneyText(overview.usdRate)} 元${overview.ratesSaved ? '' : '，当前是尚未保存的初始值'}`,
      retireBrief: retireBrief(retireRes.retCode === 0 ? retireRes.data : null, hideAmount),
      error: '',
      loaded: true,
      fourSlices: fourAmounts.map((item) => ({ ...item, width: fourTotal ? `${item.amount / fourTotal * 100}%` : '0%', percent: fourTotal ? `${(item.amount / fourTotal * 100).toFixed(1)}%` : '0.0%' })),
      fourTotal,
      groups
    })
    this.loadLedger()
  },
  async loadLedger() {
    const { billId, memberId, year, hideAmount } = this.data
    const res = await getAssetLedger(billId, year, memberId)
    if (res.retCode !== 0) {
      this.setData({ 'ledger.ready': false, 'ledger.error': res.message || '对账没有加载出来' })
      return
    }
    const data = res.data || {}
    const years = (data.years || [year]).filter((item: number) => Number.isFinite(item))
    const listed = years.length ? years : [year]
    const picked = listed.includes(year) ? year : listed[listed.length - 1]
    if (picked !== year) {
      assetViewState().ledgerYear = picked
      this.setData({ year: picked, years: listed })
      this.loadLedger()
      return
    }
    const incomes = (data.effectiveIncome || []).map((item: any) => `${item.name} ${moneyText(item.effectiveIncome, hideAmount)}`).join('、') || '无'
    const rules = (data.quantityRules || []).map((item: any) => `${item.name} ${item.quantity}${item.unitName}`).join('、')
    const belong = !memberId
      ? '看全部时，每一笔收入和支出各记一次。'
      : data.unmatched
        ? (data.message || '没有找到同名记账成员，收入和支出按 0 计。资产变化仍按当前这些资产计算。')
        : '收入只计归属这名成员的收入。支出含只归属他的金额；有共同支出和公共支出时，按有效收入拆给他，与概览分账一致。'
    this.setData({
      years: listed,
      ledger: {
        ready: true,
        error: '',
        rangeText: !data.openingMonth || !data.endMonth ? '这一年没有记账' : `记账 ${data.openingMonth} 至 ${data.endMonth}`,
        belong,
        rulesText: rules,
        incomeText: moneyText(data.income, hideAmount),
        expenseText: moneyText(data.expense, hideAmount),
        surplusText: deltaText(data.surplus, hideAmount),
        surplusClass: toneClass(data.surplus, false),
        changeText: data.assetChange == null ? '—' : deltaText(data.assetChange, hideAmount),
        changeClass: toneClass(data.assetChange, false),
        assetSub: data.assetChange == null ? '缺少盘点数据' : `${data.endMonth} ${moneyText(data.closingAsset, hideAmount)} − ${data.openingMonth} ${moneyText(data.openingAsset, hideAmount)}`,
        diffText: data.diff == null ? '—' : deltaText(data.diff, hideAmount),
        diffClass: toneClass(data.diff, false),
        diffTag: data.diff == null || hideAmount ? '' : (data.equal ? '相等' : '不相等'),
        equal: !!data.equal,
        memberText: memberId && !data.unmatched ? `只归属他 ${moneyText(data.exclusive, hideAmount)}，共同支出拆分 ${moneyText(data.sharedShare, hideAmount)}，公共支出拆分 ${moneyText(data.publicShare, hideAmount)}。各人有效收入：${incomes}` : '',
        netText: data.netChange == null ? '—' : deltaText(data.netChange, hideAmount)
      }
    })
  }
})
