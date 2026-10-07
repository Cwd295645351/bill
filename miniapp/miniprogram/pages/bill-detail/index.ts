import { deleteTransaction, getBalance, getBillDetail, getBudget, getMonthCost, getRecordList, inviteBill } from '../../apis/index'
import { guardPage } from '../../utils/auth'
import { dayEndTs, thisYear, today, yearStartTs } from '../../utils/date'
import { groupRecords, RecordItem } from '../../utils/records'
import { getUser, setBillDict, setEditingRecord, setLastBillId } from '../../utils/storage'

const PAGE_SIZE = 20

Page({
  data: {
    billId: '',
    billName: '',
    userId: '',
    users: [] as { id: string }[],
    isCreator: false,
    type: 1,
    records: [] as RecordItem[],
    groups: [] as any[],
    pageIndex: 1,
    total: 0,
    loading: false,
    finished: false,
    refreshing: false,
    yearCost: '0.00',
    monthCost: '0.00',
    restBudget: '0.00',
    investCost: '0.00',
    consumptionCost: '0.00',
    totalIncomes: '0.00'
  },

  onLoad(query: Record<string, string>) {
    wx.hideShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] })
    this.setData({ billId: query.id || '' })
  },

  async onShow() {
    const ok = await guardPage()
    if (!ok || !this.data.billId) return
    setLastBillId(this.data.billId)
    await this.loadBill()
    this.loadSummary()
    this.loadList(true)
  },

  async loadBill() {
    const res = await getBillDetail(this.data.billId)
    if (res.retCode !== 0 || !res.data) return
    const user = getUser()
    this.setData({
      userId: user ? user.userId : '',
      users: (res.data.users || []).map((item: { id: string }) => ({ id: item.id }))
    })
    setBillDict(this.data.billId, res.data)
    wx.setNavigationBarTitle({ title: res.data.name || '账本明细' })
    this.setData({
      billName: res.data.name,
      isCreator: !!(user && res.data.creator === user.userId)
    })
  },

  async loadSummary() {
    const year = thisYear()
    const [budgetRes, monthRes, balanceRes] = await Promise.all([
      getBudget(this.data.billId, year),
      getMonthCost(this.data.billId),
      getBalance(this.data.billId, yearStartTs(year), dayEndTs(today()))
    ])
    const budget = budgetRes.retCode === 0 && budgetRes.data ? budgetRes.data : { totalBudget: 0, currCost: 0 }
    const month = monthRes.retCode === 0 && monthRes.data ? Number(monthRes.data.totalCost || 0) : 0
    const rest = Number(budget.totalBudget || 0) - Number(budget.currCost || 0)
    const balance = balanceRes.retCode === 0 && balanceRes.data ? balanceRes.data : { totalCost: 0, totalIncomes: 0, investCost: 0 }
    const invest = Number(balance.investCost || 0)
    const consumption = Number(balance.totalCost || 0) - invest
    this.setData({
      yearCost: Number(budget.currCost || 0).toFixed(2),
      monthCost: month.toFixed(2),
      restBudget: rest.toFixed(2),
      investCost: invest.toFixed(2),
      consumptionCost: consumption.toFixed(2),
      totalIncomes: Number(balance.totalIncomes || 0).toFixed(2)
    })
  },

  async loadList(reset: boolean) {
    if (this.data.loading) return
    if (!reset && this.data.finished) return
    const pageIndex = reset ? 1 : this.data.pageIndex
    this.setData({ loading: true })
    const res = await getRecordList({
      billId: this.data.billId,
      type: this.data.type,
      pageIndex,
      pageSize: PAGE_SIZE,
      condition: 'gte',
      rangeMoney: 0
    })
    if (res.retCode !== 0 || !res.data) {
      this.setData({ loading: false, refreshing: false })
      return
    }
    const incoming = (res.data.datas || []) as RecordItem[]
    const records = reset ? incoming : this.data.records.concat(incoming)
    const total = Number(res.data.total || 0)
    this.setData({
      records,
      groups: groupRecords(records, this.data.userId, this.data.users),
      total,
      pageIndex: pageIndex + 1,
      finished: records.length >= total,
      loading: false,
      refreshing: false
    })
  },

  onType(e: WechatMiniprogram.TouchEvent) {
    const type = Number(e.currentTarget.dataset.type) === 2 ? 2 : 1
    if (type === this.data.type) return
    this.setData({ type, records: [], groups: [], finished: false, pageIndex: 1 })
    this.loadList(true)
  },

  onRefresh() {
    this.setData({ refreshing: true, finished: false })
    this.loadSummary()
    this.loadList(true)
  },

  onMore() {
    this.loadList(false)
  },

  onAdd() {
    setLastBillId(this.data.billId)
    wx.navigateTo({ url: `/pages/record-create/index?billId=${this.data.billId}` })
  },

  onSearch() {
    wx.navigateTo({ url: `/pages/record-search/index?billId=${this.data.billId}` })
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

  onDelete(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id
    const record = this.data.records.find((item) => item.id === id)
    if (!record || !record.mine) {
      wx.showToast({ title: '只能删除自己记的账单', icon: 'none' })
      return
    }
    wx.showModal({
      title: '确定删除吗？',
      content: '删除后无法恢复',
      success: async (res) => {
        if (!res.confirm) return
        const ret = await deleteTransaction(id)
        if (ret.retCode === 0) {
          wx.showToast({ title: '已删除' })
          this.loadSummary()
          this.loadList(true)
        }
      }
    })
  },

  onShareAppMessage() {
    const billId = this.data.billId
    const name = this.data.billName
    const promise = inviteBill(billId).then((res) => {
      if (res.retCode !== 0 || !res.data) {
        wx.showToast({ title: res.message || '只有创建者可以邀请', icon: 'none' })
        return { title: name || '记账', path: '/pages/bills/index' }
      }
      return {
        title: `邀请你加入账本「${name}」`,
        path: `/pages/join/index?code=${encodeURIComponent(res.data)}&name=${encodeURIComponent(name)}`
      }
    })
    return {
      title: `邀请你加入账本「${name}」`,
      path: '/pages/bills/index',
      promise
    }
  }
})
