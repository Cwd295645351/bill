import { deleteAssetRecord, getAssetListStats, getAssetRecords, saveAssetRecord } from '../../../apis/index'
import { appShareBehavior } from '../../../behaviors/app-share'
import { assetViewState, bindAssetBill } from '../../../utils/asset-view'
import { guardPage } from '../../../utils/auth'
import { dayStamp, moneyText, stampDay, todayText } from '../../../utils/asset-format'

Page({
  behaviors: [appShareBehavior],
  data: { billId: '', assetId: '', name: '', meta: '', currentText: '—', list: [] as any[], total: 0, page: 1, finished: false, loading: false, latestId: '', amount: '', date: todayText(), editingId: '', editing: false, error: '' },
  async onLoad(query: Record<string, string | undefined>) {
    if (!(await guardPage())) return
    bindAssetBill(query.billId || '')
    this.setData({ billId: query.billId || '', assetId: query.assetId || '' })
    const stats = await getAssetListStats(this.data.billId)
    const rows = [...(stats.data?.assetGroups || []), ...(stats.data?.debtGroups || [])].flatMap((group: any) => group.assets)
    const row = rows.find((item: any) => item.id === this.data.assetId)
    const typeName: Record<string, string> = { living: '流动资金', steady: '固定资产', longterm: '投资理财', receivable: '应收款', debt: '负债' }
    const fourName: Record<string, string> = { living: '活钱', steady: '稳健', longterm: '长期', insurance: '保险' }
    const currencyName: Record<string, string> = { CNY: '人民币', HKD: '港币', USD: '美元' }
    const meta = row ? [row.memberName, typeName[row.type] || row.type, row.fourMoneyType ? fourName[row.fourMoneyType] : '', currencyName[row.currency] || row.currency].filter(Boolean).join(' · ') : ''
    this.setData({ name: row?.name || '盘点', meta, currentText: row ? moneyText(row.latestAmount, assetViewState().hideAmount) : '—' })
    this.load()
  },
  async load() {
    if (this.data.loading || this.data.finished) return
    this.setData({ loading: true })
    const res = await getAssetRecords(this.data.assetId, this.data.page)
    if (res.retCode !== 0) return this.setData({ error: res.message || '盘点没有加载出来', loading: false, finished: true })
    const hidden = assetViewState().hideAmount
    const incoming = (res.data?.list || []).map((item: any) => ({ ...item, day: stampDay(item.date), amountText: moneyText(item.amount, hidden) }))
    const list = this.data.page === 1 ? incoming : this.data.list.concat(incoming)
    const total = res.data?.total || 0
    this.setData({ list, total, page: this.data.page + 1, finished: list.length >= total, loading: false, latestId: list[0]?.id || '' })
  },
  onReachBottom() {
    this.load()
  },
  reload() {
    this.setData({ page: 1, list: [], finished: false, loading: false })
    this.load()
  },
  beginAdd() {
    this.setData({ editing: true, editingId: '', amount: '', date: todayText() })
  },
  closeEdit() {
    this.setData({ editing: false })
  },
  beginEdit(event: WechatMiniprogram.BaseEvent) {
    const item = this.data.list.find((row) => row.id === event.currentTarget.dataset.id)
    if (item) this.setData({ editing: true, editingId: item.id, amount: String(item.amount), date: item.day })
  },
  setAmount(event: WechatMiniprogram.Input) { this.setData({ amount: event.detail.value }) },
  setDate(event: WechatMiniprogram.PickerChange) { this.setData({ date: String(event.detail.value) }) },
  editAsset() { wx.navigateTo({ url: `/packageAsset/pages/form/index?billId=${this.data.billId}&assetId=${this.data.assetId}` }) },
  async save() {
    if (this.data.amount.trim() === '' || Number(this.data.amount) < 0) return this.setData({ error: '盘点金额不能小于 0' })
    const res = await saveAssetRecord({ id: this.data.editingId || undefined, assetId: this.data.assetId, amount: Number(this.data.amount), date: dayStamp(this.data.date) }, !!this.data.editingId)
    if (res.retCode !== 0) return this.setData({ error: res.message || '没有保存' })
    this.setData({ editing: false, editingId: '', amount: '', date: todayText(), error: '' })
    this.reload()
  },
  remove(event: WechatMiniprogram.BaseEvent) {
    if (this.data.total <= 1) return this.setData({ error: '只剩一条盘点，不能删除' })
    const id = event.currentTarget.dataset.id
    wx.showModal({
      title: '删除盘点', content: '删除后不能恢复。',
      success: async (result) => {
        if (!result.confirm) return
        const res = await deleteAssetRecord(id)
        if (res.retCode !== 0) this.setData({ error: res.message || '没有删除' })
        else this.reload()
      }
    })
  }
})
