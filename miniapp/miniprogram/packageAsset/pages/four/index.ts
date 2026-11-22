import { getAssetMembers, getFourMoney } from '../../../apis/index'
import { appShareBehavior } from '../../../behaviors/app-share'
import { assetViewState, bindAssetBill } from '../../../utils/asset-view'
import { guardPage } from '../../../utils/auth'
import { moneyText } from '../../../utils/asset-format'

const KEYS = [
  { key: 'living', name: '活钱', color: '#5b8ff9', insurance: false },
  { key: 'steady', name: '稳健', color: '#5ad8a6', insurance: false },
  { key: 'longterm', name: '长期', color: '#f6bd16', insurance: false },
  { key: 'insurance', name: '保险', color: '#b37feb', insurance: true }
]

function blocksOf(assets: any[], hidden: boolean) {
  const map: Record<string, { name: string; amount: number; rows: any[] }> = {}
  assets.forEach((row) => {
    const name = row.memberName || row.member?.name || '未命名'
    map[name] = map[name] || { name, amount: 0, rows: [] }
    map[name].amount += Number(row.latestAmount || 0)
    const symbol = row.currency === 'HKD' ? 'HK$' : row.currency === 'USD' ? 'US$' : ''
    const fx = symbol && row.rawAmount != null ? symbol + moneyText(row.rawAmount, hidden) : ''
    map[name].rows.push({
      id: row.id,
      name: row.name + (row.insuranceCategory ? ` · ${row.insuranceCategory}` : ''),
      amountText: moneyText(row.latestAmount, hidden),
      fx
    })
  })
  return Object.values(map).map((block) => ({ ...block, amountText: moneyText(block.amount, hidden) }))
}

Page({
  behaviors: [appShareBehavior],
  data: { billId: '', memberId: '', members: [] as any[], error: '', pie: [] as any[], pieGradient: '', flex: [] as any[], rows: [] as any[] },
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
  goMembers() {
    wx.navigateTo({ url: `/packageAsset/pages/members/index?billId=${this.data.billId}` })
  },
  openRecords(event: WechatMiniprogram.BaseEvent) {
    wx.navigateTo({ url: `/packageAsset/pages/records/index?billId=${this.data.billId}&assetId=${event.currentTarget.dataset.id}` })
  },
  async load() {
    const [memberRes, res] = await Promise.all([
      getAssetMembers(this.data.billId),
      getFourMoney(this.data.billId, assetViewState().memberId)
    ])
    if (res.retCode !== 0) return this.setData({ error: res.message || '四笔钱没有加载出来' })
    const hidden = assetViewState().hideAmount
    const base = KEYS.slice(0, 3).reduce((sum, item) => sum + Number(res.data?.[item.key]?.amount || 0), 0)
    const flex = KEYS.slice(0, 3).map((item) => {
      const amount = Number(res.data?.[item.key]?.amount || 0)
      return { ...item, amount, percent: `${base ? ((amount / base) * 100).toFixed(1) : '0.0'}%` }
    })
    const pie = flex.filter((item) => item.amount > 0)
    let cursor = 0
    const total = pie.reduce((sum, item) => sum + item.amount, 0) || 1
    const pieGradient = pie.length ? `conic-gradient(${pie.map((item) => {
      const start = cursor
      cursor += (item.amount / total) * 100
      return `${item.color} ${start}% ${cursor}%`
    }).join(',')})` : ''
    this.setData({
      members: memberRes.data || [],
      error: '',
      flex,
      pie,
      pieGradient,
      rows: KEYS.map((item) => {
        const bucket = res.data?.[item.key] || {}
        const assets = bucket.assets || []
        const empty = !bucket.count
        const amount = Number(bucket.amount || 0)
        const share = item.insurance ? '不计入三类比例' : `占三类 ${base ? ((amount / base) * 100).toFixed(1) : '0.0'}%`
        const extra = item.insurance ? ` · 年交保费 ${moneyText(bucket.totalPremium || 0, hidden)}` : ''
        return {
          key: item.key,
          title: item.insurance ? '保障' : item.name,
          amountText: empty ? '暂无' : moneyText(amount, hidden),
          note: `${bucket.count || 0} 笔 · ${share}${extra}`,
          blocks: blocksOf(assets.map((asset: any) => ({ ...asset, insuranceCategory: item.insurance ? (asset.insuranceCategory || '其他') : '' })), hidden)
        }
      })
    })
  }
})
