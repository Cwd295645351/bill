import { getPlanList, planAdd, planDelete, planEdit } from '../../../apis/index'
import { guardPage } from '../../../utils/auth'
import { groupPlansByPriority, PLAN_PRIORITY_META, type PlanItem } from '../../../utils/plan-group'

function fieldText(detail: unknown): string {
  if (typeof detail === 'string') return detail
  const value = (detail as { value?: string })?.value
  return value == null ? '' : String(value)
}

Page({
  data: {
    billId: '',
    loading: false,
    sections: [] as {
      priority: number
      label: string
      color: string
      items: PlanItem[]
      empty: boolean
    }[],
    showForm: false,
    showDel: false,
    formMode: 'create' as 'create' | 'edit',
    formId: '',
    formTitle: '',
    formContext: '',
    formPriority: 1,
    pendingDelId: ''
  },

  onLoad(query: Record<string, string>) {
    this.setData({ billId: query.billId || query.id || '' })
  },

  async onShow() {
    const ok = await guardPage()
    if (!ok || !this.data.billId) return
    await this.load()
  },

  async load() {
    this.setData({ loading: true })
    const res = await getPlanList(this.data.billId)
    this.setData({ loading: false })
    if (res.retCode !== 0 || !res.data) {
      wx.showToast({ title: res.message || '加载失败', icon: 'none' })
      return
    }
    const details = (Array.isArray(res.data.details) ? res.data.details : []).map((item: any) => ({
      id: String(item.id),
      title: String(item.title || ''),
      context: String(item.context || ''),
      priority: (Number(item.priority) as 1 | 2 | 3) || 1
    }))
    const groups = groupPlansByPriority(details)
    const sections = PLAN_PRIORITY_META.map((meta, idx) => ({
      priority: meta.priority,
      label: meta.label,
      color: meta.color,
      items: groups[idx],
      empty: groups[idx].length === 0
    }))
    this.setData({ sections })
  },

  onAdd() {
    this.setData({
      showForm: true,
      formMode: 'create',
      formId: '',
      formTitle: '',
      formContext: '',
      formPriority: 1
    })
  },

  onEdit(e: WechatMiniprogram.TouchEvent) {
    const id = String(e.currentTarget.dataset.id || '')
    let item: PlanItem | undefined
    for (const sec of this.data.sections) {
      item = sec.items.find((row) => row.id === id)
      if (item) break
    }
    if (!item) return
    this.setData({
      showForm: true,
      formMode: 'edit',
      formId: item.id,
      formTitle: item.title,
      formContext: item.context,
      formPriority: item.priority
    })
  },

  onDel(e: WechatMiniprogram.TouchEvent) {
    const id = String(e.currentTarget.dataset.id || '')
    if (!id) return
    this.setData({ showDel: true, pendingDelId: id })
  },

  closeForm() {
    this.setData({ showForm: false })
  },

  closeDel() {
    this.setData({ showDel: false, pendingDelId: '' })
  },

  onTitle(e: WechatMiniprogram.CustomEvent) {
    this.setData({ formTitle: fieldText(e.detail) })
  },

  onContext(e: WechatMiniprogram.CustomEvent) {
    this.setData({ formContext: fieldText(e.detail) })
  },

  onPriority(e: WechatMiniprogram.TouchEvent) {
    const value = Number(e.currentTarget.dataset.value)
    if (value === 1 || value === 2 || value === 3) {
      this.setData({ formPriority: value })
    }
  },

  async onSave() {
    const title = String(this.data.formTitle || '').trim()
    const context = String(this.data.formContext || '').trim()
    const priority = Number(this.data.formPriority)
    if (!title || !context) {
      wx.showToast({ title: '请填写标题和内容', icon: 'none' })
      return
    }
    if (priority !== 1 && priority !== 2 && priority !== 3) {
      wx.showToast({ title: '请选择优先级', icon: 'none' })
      return
    }
    const payload = {
      billId: this.data.billId,
      title,
      context,
      priority
    }
    const res =
      this.data.formMode === 'edit'
        ? await planEdit({ ...payload, id: this.data.formId })
        : await planAdd(payload)
    if (res.retCode !== 0) {
      wx.showToast({ title: res.message || '保存失败', icon: 'none' })
      return
    }
    this.setData({ showForm: false })
    wx.showToast({ title: '已保存', icon: 'none' })
    await this.load()
  },

  async confirmDel() {
    const id = this.data.pendingDelId
    if (!id) return
    const res = await planDelete({ id, billId: this.data.billId })
    this.setData({ showDel: false, pendingDelId: '' })
    if (res.retCode !== 0) {
      wx.showToast({ title: res.message || '删除失败', icon: 'none' })
      return
    }
    wx.showToast({ title: '已删除', icon: 'none' })
    await this.load()
  }
})
