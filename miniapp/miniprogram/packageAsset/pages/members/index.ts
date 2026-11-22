import { addAssetMember, editAssetMember, getAssetMembers, getAssetRate, hideAssetMember, saveAssetRate } from '../../../apis/index'
import { appShareBehavior } from '../../../behaviors/app-share'
import { assetViewState, bindAssetBill } from '../../../utils/asset-view'
import { guardPage } from '../../../utils/auth'

Page({
  behaviors: [appShareBehavior],
  data: { billId: '', members: [] as any[], name: '', error: '', hkd: '', usd: '', saved: true, rateNote: '' },
  async onLoad(query: Record<string, string | undefined>) {
    if (!(await guardPage())) return
    bindAssetBill(query.billId || '')
    this.setData({ billId: query.billId || '' })
    this.load()
  },
  setName(event: WechatMiniprogram.Input) { this.setData({ name: event.detail.value }) },
  setHkd(event: WechatMiniprogram.Input) { this.setData({ hkd: event.detail.value }) },
  setUsd(event: WechatMiniprogram.Input) { this.setData({ usd: event.detail.value }) },
  async load() {
    const [members, rate] = await Promise.all([getAssetMembers(this.data.billId), getAssetRate(this.data.billId)])
    if (members.retCode !== 0) return this.setData({ error: members.message || '无权查看该账本' })
    this.setData({
      members: members.data || [],
      hkd: rate.data?.hkdRate == null ? '' : String(rate.data.hkdRate),
      usd: rate.data?.usdRate == null ? '' : String(rate.data.usdRate),
      saved: !!rate.data?.saved,
      rateNote: rate.data?.saved ? '右边填折合多少人民币。' : '还没有保存过汇率，当前展示的是大于 0 的初始值。'
    })
  },
  async add() {
    const text = this.data.name.trim()
    if (!text) return this.setData({ error: '请填写名字' })
    if (this.data.members.some((item) => item.name === text)) return this.setData({ error: '已经有这个名字' })
    const res = await addAssetMember(this.data.billId, text)
    if (res.retCode !== 0) return this.setData({ error: res.message || '没有添加' })
    this.setData({ name: '', error: '' })
    this.load()
  },
  rename(event: WechatMiniprogram.BaseEvent) {
    const id = event.currentTarget.dataset.id
    wx.showModal({
      title: '改名', editable: true, content: event.currentTarget.dataset.name,
      success: async (result) => {
        const text = (result.content || '').trim()
        if (!result.confirm || !text) return
        if (this.data.members.some((item) => item.name === text && item.id !== id)) return this.setData({ error: '已经有这个名字' })
        const res = await editAssetMember(id, text)
        if (res.retCode !== 0) this.setData({ error: res.message || '没有改名' })
        else this.load()
      }
    })
  },
  hide(event: WechatMiniprogram.BaseEvent) {
    const id = event.currentTarget.dataset.id
    wx.showModal({
      title: '隐藏成员', content: '名字离开名单，名下资产仍算在全部里，家庭合计不变。',
      success: async (result) => {
        if (!result.confirm) return
        const res = await hideAssetMember(id)
        if (res.retCode !== 0) return this.setData({ error: res.message || '没有隐藏' })
        if (assetViewState().memberId === id) assetViewState().memberId = ''
        this.load()
      }
    })
  },
  async saveRates() {
    if (!(Number(this.data.hkd) > 0) || !(Number(this.data.usd) > 0)) return this.setData({ error: '汇率必须大于 0' })
    const res = await saveAssetRate(this.data.billId, this.data.hkd, this.data.usd)
    if (res.retCode !== 0) this.setData({ error: res.message || '没有保存' })
    else this.setData({ error: '', saved: true, rateNote: '右边填折合多少人民币。' })
  }
})
