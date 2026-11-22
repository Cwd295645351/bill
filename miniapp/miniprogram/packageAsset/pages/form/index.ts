import { deleteAsset, getAssetListStats, getAssetMembers, getAssetRecords, saveAsset, saveAssetRecord } from '../../../apis/index'
import { appShareBehavior } from '../../../behaviors/app-share'
import { assetViewState, bindAssetBill } from '../../../utils/asset-view'
import { guardPage } from '../../../utils/auth'
import { dayStamp, todayText } from '../../../utils/asset-format'

const TYPES = [
  { value: 'living', label: '流动资金' }, { value: 'steady', label: '固定资产' },
  { value: 'longterm', label: '投资理财' }, { value: 'receivable', label: '应收款' }, { value: 'debt', label: '负债' }
]
const FOURS = [
  { value: 'living', label: '活钱' }, { value: 'steady', label: '稳健' }, { value: 'longterm', label: '长期' }, { value: 'insurance', label: '保险' }
]
const CURRENCIES = [{ value: 'CNY', label: '人民币' }, { value: 'HKD', label: '港币' }, { value: 'USD', label: '美元' }]

Page({
  behaviors: [appShareBehavior],
  data: {
    billId: '', id: '', members: [] as any[], memberNames: [] as string[], memberIndex: 0,
    types: TYPES, typeNames: TYPES.map((item) => item.label), typeIndex: 0,
    fours: FOURS, fourNames: FOURS.map((item) => item.label), fourIndex: 0,
    currencies: CURRENCIES, currencyNames: CURRENCIES.map((item) => item.label), currencyIndex: 0,
    name: '', amount: '', date: todayText(), today: todayText(), insuranceCategory: '', annualPremium: '',
    origin: null as number | null, channel: '', turnaroundCycle: 'T+0', error: '', unchanged: false,
    hideAmount: false, amountOpen: false, premiumOpen: false,
    insured: false, hint: '金额不能小于 0。盘点日可以改成补记的那一天，保存后留下这一条。',
    picking: false, pickKind: 'member', pickTitle: '', pickOptions: [] as { value: string; label: string }[], pickCurrent: ''
  },
  async onLoad(query: Record<string, string | undefined>) {
    if (!(await guardPage())) return
    bindAssetBill(query.billId || '')
    this.setData({ billId: query.billId || '', id: query.assetId || '', hideAmount: assetViewState().hideAmount })
    const members = await getAssetMembers(this.data.billId)
    const list = members.data || []
    this.setData({ members: list, memberNames: list.map((item: any) => item.name) })
    if (!query.assetId) return this.refreshHint()
    wx.setNavigationBarTitle({ title: '编辑资产' })
    const stats = await getAssetListStats(this.data.billId)
    const rows = [...(stats.data?.assetGroups || []), ...(stats.data?.debtGroups || [])].flatMap((group: any) => group.assets)
    const row = rows.find((item: any) => item.id === query.assetId)
    if (!row) return
    this.setData({
      name: row.name,
      amount: String(row.rawAmount ?? row.latestAmount ?? ''),
      origin: Number(row.rawAmount ?? row.latestAmount),
      memberIndex: Math.max(list.findIndex((item: any) => item.id === row.memberId), 0),
      typeIndex: Math.max(TYPES.findIndex((item) => item.value === row.type), 0),
      fourIndex: Math.max(FOURS.findIndex((item) => item.value === row.fourMoneyType), 0),
      currencyIndex: Math.max(CURRENCIES.findIndex((item) => item.value === row.currency), 0),
      insuranceCategory: row.insuranceCategory || '',
      annualPremium: row.annualPremium == null ? '' : String(row.annualPremium),
      channel: row.channel || '',
      turnaroundCycle: row.turnaroundCycle || 'T+0',
      unchanged: true
    })
    this.refreshHint()
  },
  refreshHint() {
    const type = TYPES[this.data.typeIndex].value
    const four = FOURS[this.data.fourIndex].value
    const insured = type !== 'debt' && four === 'insurance'
    let hint = '金额不能小于 0。盘点日可以改成补记的那一天，保存后留下这一条。'
    if (this.data.id && this.data.unchanged) hint = '金额没有变化，这次不会新增盘点。币种登记后不能修改。'
    else if (this.data.id) hint = '金额有变化时，会在今天追加一条盘点，原来的盘点不动。币种登记后不能修改。'
    else if (type === 'debt') hint = '类型为负债时计入总负债，不计入总资产，也不选四笔钱。盘点日可以改成补记的那一天。'
    else if (insured) hint = '现金价值不要填保额。保障计入总资产。盘点日可以改成补记的那一天。'
    this.setData({ insured, hint })
  },
  goMembers() { wx.navigateTo({ url: `/packageAsset/pages/members/index?billId=${this.data.billId}` }) },
  openPick(event: WechatMiniprogram.BaseEvent) {
    const kind = event.currentTarget.dataset.kind as string
    const options = kind === 'member'
      ? this.data.members.map((item: any) => ({ value: item.id, label: item.name }))
      : kind === 'type' ? TYPES.map((item) => ({ value: item.value, label: item.label }))
      : kind === 'four' ? FOURS.map((item) => ({ value: item.value, label: item.label }))
      : CURRENCIES.map((item) => ({ value: item.value, label: item.label }))
    const current = kind === 'member' ? this.data.members[this.data.memberIndex]?.id
      : kind === 'type' ? TYPES[this.data.typeIndex].value
      : kind === 'four' ? FOURS[this.data.fourIndex].value
      : CURRENCIES[this.data.currencyIndex].value
    const title = kind === 'member' ? '成员' : kind === 'type' ? '资产属性' : kind === 'four' ? '四笔钱' : '币种'
    this.setData({ picking: true, pickKind: kind, pickTitle: title, pickOptions: options, pickCurrent: current || '' })
  },
  closePick() { this.setData({ picking: false }) },
  choosePick(event: WechatMiniprogram.BaseEvent) {
    const value = event.currentTarget.dataset.value
    const kind = this.data.pickKind
    if (kind === 'member') this.setData({ memberIndex: Math.max(this.data.members.findIndex((item: any) => item.id === value), 0) })
    if (kind === 'type') this.setData({ typeIndex: Math.max(TYPES.findIndex((item) => item.value === value), 0) })
    if (kind === 'four') this.setData({ fourIndex: Math.max(FOURS.findIndex((item) => item.value === value), 0) })
    if (kind === 'currency') this.setData({ currencyIndex: Math.max(CURRENCIES.findIndex((item) => item.value === value), 0) })
    this.setData({ picking: false })
    this.refreshHint()
  },
  setName(event: WechatMiniprogram.Input) { this.setData({ name: event.detail.value }) },
  openAmount() { this.setData({ amountOpen: true }) },
  closeAmount() { this.setData({ amountOpen: false }) },
  openPremium() { this.setData({ premiumOpen: true }) },
  closePremium() { this.setData({ premiumOpen: false }) },
  setAmount(event: WechatMiniprogram.Input) {
    const amount = event.detail.value
    if (amount === '****') return
    this.setData({ amount, unchanged: this.data.origin != null && Number(amount) === this.data.origin })
    this.refreshHint()
  },
  setDate(event: WechatMiniprogram.PickerChange) { this.setData({ date: String(event.detail.value) }) },
  setMember(event: WechatMiniprogram.PickerChange) { this.setData({ memberIndex: Number(event.detail.value) }) },
  setType(event: WechatMiniprogram.PickerChange) { this.setData({ typeIndex: Number(event.detail.value) }) },
  setFour(event: WechatMiniprogram.PickerChange) { this.setData({ fourIndex: Number(event.detail.value) }) },
  setCurrency(event: WechatMiniprogram.PickerChange) { this.setData({ currencyIndex: Number(event.detail.value) }) },
  setCategory(event: WechatMiniprogram.Input) { this.setData({ insuranceCategory: event.detail.value }) },
  setPremium(event: WechatMiniprogram.Input) {
    const annualPremium = event.detail.value
    if (annualPremium === '****') return
    this.setData({ annualPremium })
  },
  async save() {
    const member = this.data.members[this.data.memberIndex]
    const type = TYPES[this.data.typeIndex].value
    const four = FOURS[this.data.fourIndex].value
    if (!member) return this.setData({ error: '请先添加资产成员' })
    if (!this.data.name.trim()) return this.setData({ error: '名称不能为空' })
    if (this.data.amount.trim() === '' || Number(this.data.amount) < 0) return this.setData({ error: '当前金额不能小于 0，也不能留空' })
    if (four === 'insurance' && this.data.annualPremium !== '' && Number(this.data.annualPremium) < 0) return this.setData({ error: '年交保费不能小于 0' })
    const payload: Record<string, unknown> = {
      id: this.data.id || undefined, name: this.data.name.trim(), billId: this.data.billId, memberId: member.id,
      type, fourMoneyType: type === 'debt' ? '' : four, latestAmount: Number(this.data.amount), currency: CURRENCIES[this.data.currencyIndex].value,
      insuranceCategory: four === 'insurance' && type !== 'debt' ? this.data.insuranceCategory : '',
      annualPremium: four === 'insurance' && type !== 'debt' ? this.data.annualPremium : ''
    }
    if (this.data.id) {
      payload.channel = this.data.channel
      payload.turnaroundCycle = this.data.turnaroundCycle
    }
    const res = await saveAsset(payload, !!this.data.id)
    if (res.retCode !== 0) return this.setData({ error: res.message || '没有保存' })
    if (!this.data.id && this.data.date !== this.data.today && res.data?.id) {
      const page = await getAssetRecords(res.data.id, 1)
      const first = page.data?.list?.[0]
      if (first) await saveAssetRecord({ id: first.id, assetId: res.data.id, amount: Number(this.data.amount), date: dayStamp(this.data.date) }, true)
    }
    wx.navigateBack()
  },
  remove() {
    wx.showModal({
      title: '删除这笔资产', content: '删除后，这笔资产和全部盘点不再出现。',
      success: async (result) => {
        if (!result.confirm) return
        const res = await deleteAsset(this.data.id)
        if (res.retCode !== 0) this.setData({ error: res.message || '没有删除' })
        else wx.navigateBack()
      }
    })
  }
})
