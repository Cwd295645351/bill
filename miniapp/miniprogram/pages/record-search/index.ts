import { getBillDetail, getRecordList } from '../../apis/index'
import { guardPage } from '../../utils/auth'
import { dayEndTs, dayStartTs } from '../../utils/date'
import { groupRecords, RecordItem } from '../../utils/records'
import { getUser, setEditingRecord } from '../../utils/storage'

/** Vant Field 的 change 事件在默认配置下直接把字符串作为 detail */
function fieldText(detail: unknown): string {
  if (typeof detail === 'string') return detail
  const value = (detail as { value?: string }) && (detail as { value?: string }).value
  return value == null ? '' : String(value)
}

const PAGE_SIZE = 20

Page({
  data: {
    billId: '',
    type: 1,
    beginDate: '',
    endDate: '',
    remark: '',
    belongUserId: '',
    belongUserName: '全部',
    categoryId: '',
    categoryName: '全部分类',
    conditionId: 'gte',
    conditionName: '大于等于',
    rangeMoney: '',
    userNames: ['全部'] as string[],
    userIds: [''] as string[],
    users: [] as { id: string }[],
    categoryNames: ['全部分类'] as string[],
    categoryIds: [''] as string[],
    costTypes: [] as any[],
    incomesTypes: [] as any[],
    conditionNames: ['大于等于', '大于', '等于', '小于等于', '小于'],
    conditionIds: ['gte', 'gt', 'eq', 'lte', 'lt'],
    showUsers: false,
    showCategory: false,
    showCondition: false,
    records: [] as RecordItem[],
    groups: [] as any[],
    pageIndex: 1,
    finished: false,
    loading: false,
    searched: false,
    userId: ''
  },

  onLoad(query: Record<string, string>) {
    this.setData({ billId: query.billId || '' })
  },

  async onShow() {
    const ok = await guardPage()
    if (!ok) return
    const user = getUser()
    if (user && user.userId !== this.data.userId) this.setData({ userId: user.userId })
    if (this.data.userNames.length > 1) return
    const res = await getBillDetail(this.data.billId)
    if (res.retCode !== 0 || !res.data) return
    const users = res.data.users || []
    this.setData({
      costTypes: res.data.costTypes || [],
      incomesTypes: res.data.incomesTypes || [],
      userNames: ['全部'].concat(users.map((item: any) => item.name)),
      userIds: [''].concat(users.map((item: any) => item.id)),
      users: users.map((item: { id: string }) => ({ id: item.id }))
    })
    this.refreshCategories()
  },

  refreshCategories() {
    const list = this.data.type === 2 ? this.data.incomesTypes : this.data.costTypes
    this.setData({
      categoryNames: ['全部分类'].concat(list.map((item: any) => item.name)),
      categoryIds: [''].concat(list.map((item: any) => item.id))
    })
  },

  onType(e: WechatMiniprogram.TouchEvent) {
    const type = Number(e.currentTarget.dataset.type) === 2 ? 2 : 1
    this.setData({ type, categoryId: '', categoryName: '全部分类' })
    this.refreshCategories()
  },

  onBegin(e: WechatMiniprogram.CustomEvent) {
    this.setData({ beginDate: e.detail.value })
  },

  onEnd(e: WechatMiniprogram.CustomEvent) {
    this.setData({ endDate: e.detail.value })
  },

  onRemark(e: WechatMiniprogram.CustomEvent) {
    this.setData({ remark: fieldText(e.detail) })
  },

  onMoney(e: WechatMiniprogram.CustomEvent) {
    this.setData({ rangeMoney: fieldText(e.detail) })
  },

  openUsers() {
    this.setData({ showUsers: true })
  },
  closeUsers() {
    this.setData({ showUsers: false })
  },
  onUser(e: WechatMiniprogram.CustomEvent) {
    const index = Array.isArray(e.detail.index) ? e.detail.index[0] : e.detail.index
    this.setData({
      belongUserId: this.data.userIds[index] || '',
      belongUserName: this.data.userNames[index] || '全部',
      showUsers: false
    })
  },

  openCategory() {
    this.setData({ showCategory: true })
  },
  closeCategory() {
    this.setData({ showCategory: false })
  },
  onCategory(e: WechatMiniprogram.CustomEvent) {
    const index = Array.isArray(e.detail.index) ? e.detail.index[0] : e.detail.index
    this.setData({
      categoryId: this.data.categoryIds[index] || '',
      categoryName: this.data.categoryNames[index] || '全部分类',
      showCategory: false
    })
  },

  openCondition() {
    this.setData({ showCondition: true })
  },
  closeCondition() {
    this.setData({ showCondition: false })
  },
  onCondition(e: WechatMiniprogram.CustomEvent) {
    const index = Array.isArray(e.detail.index) ? e.detail.index[0] : e.detail.index
    this.setData({
      conditionId: this.data.conditionIds[index] || 'gte',
      conditionName: this.data.conditionNames[index] || '大于等于',
      showCondition: false
    })
  },

  onSearch() {
    this.setData({ records: [], groups: [], pageIndex: 1, finished: false, searched: true })
    this.load(true)
  },

  onMore() {
    this.load(false)
  },

  async load(reset: boolean) {
    if (this.data.loading) return
    if (!reset && this.data.finished) return
    const pageIndex = reset ? 1 : this.data.pageIndex
    this.setData({ loading: true })
    const data: any = {
      billId: this.data.billId,
      type: this.data.type,
      pageIndex,
      pageSize: PAGE_SIZE,
      remark: this.data.remark,
      belongUserId: this.data.belongUserId,
      condition: this.data.conditionId,
      rangeMoney: Number(this.data.rangeMoney || 0)
    }
    if (this.data.beginDate) data.beginDate = dayStartTs(this.data.beginDate)
    if (this.data.endDate) data.endDate = dayEndTs(this.data.endDate)
    if (this.data.type === 1) data.costTypeId = this.data.categoryId
    else data.incomesTypeId = this.data.categoryId
    const res = await getRecordList(data)
    if (res.retCode !== 0 || !res.data) {
      this.setData({ loading: false })
      return
    }
    const incoming = (res.data.datas || []) as RecordItem[]
    const records = reset ? incoming : this.data.records.concat(incoming)
    const total = Number(res.data.total || 0)
    this.setData({
      records,
      groups: groupRecords(records, this.data.userId, this.data.users),
      pageIndex: pageIndex + 1,
      finished: records.length >= total,
      loading: false
    })
  },

  onEdit(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id
    const record = this.data.records.find((item) => item.id === id)
    if (!record) return
    if (!record.mine) {
      wx.showToast({ title: '只能编辑自己记的账单', icon: 'none' })
      return
    }
    setEditingRecord(record)
    wx.navigateTo({ url: `/pages/record-edit/index?billId=${this.data.billId}` })
  },

  /** 打开照片预览，不进入编辑 */
  onPreviewImages(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id
    const record = this.data.records.find((item) => item.id === id)
    if (!record || !record.images || !record.images.length) return
    const sorted = record.images.slice().sort((a, b) => (a.sort || 0) - (b.sort || 0))
    const urls = sorted.map((img) => img.viewUrl).filter(Boolean)
    if (!urls.length) return
    wx.previewImage({ current: urls[0], urls })
  }
})
