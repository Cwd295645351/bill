import {
  addCustomSuggestion,
  composeRemark,
  removeCustomSuggestion,
  splitRemark,
  suggestionChips
} from '../../utils/content-suggestions'
import { dayStartTs, today, toDayText } from '../../utils/date'
import { applyAmountKey } from '../../utils/records'
import { getLastPref, getUser, RecordPref } from '../../utils/storage'

function visibleTypes(list: any[]) {
  return (list || []).filter((item) => !item.isDel && !item.hidden)
}

const emptyPref = (): RecordPref => ({
  costTypeId: '',
  costTypeName: '',
  incomesTypeId: '',
  incomesTypeName: '',
  belongUserId: '',
  belongUserName: ''
})

Component({
  properties: {
    bill: { type: Object, value: {} },
    mode: { type: String, value: 'add' },
    initial: { type: Object, value: {} }
  },
  data: {
    type: 1,
    amount: '',
    date: '',
    remark: '',
    contentTag: '',
    suggestions: [] as any[],
    removingSuggestion: false,
    belongUserId: '',
    belongUserName: '全部',
    categoryId: '',
    categoryName: '',
    categories: [] as any[],
    userNames: ['全部'] as string[],
    userIds: [''] as string[],
    showUsers: false,
    recordId: '',
    reimbursement: 0,
    showKeyboard: false,
    canDelete: false,
    canEdit: true
  },
  observers: {
    'bill, initial': function () {
      this.syncFromProps()
    }
  },
  methods: {
    /** 账本或待编辑记录变化时初始化分类、归属人，避免覆盖用户正在输入的内容 */
    syncFromProps() {
      const bill = this.data.bill as any
      if (!bill || !bill.id) return
      const initial = this.data.initial as any
      if (this.data.mode === 'edit' && !(initial && initial.id)) return
      const key = `${bill.id}|${(initial && initial.id) || ''}|${this.data.mode}`
      if ((this as any)._synced === key) return
      ;(this as any)._synced = key

      const users = bill.users || []
      const userNames = ['全部'].concat(users.map((item: any) => item.name))
      const userIds = [''].concat(users.map((item: any) => item.id))
      const patch: any = { userNames, userIds }

      if (initial && initial.id) {
        const type = initial.type === 2 ? 2 : 1
        patch.type = type
        patch.amount = initial.money != null ? String(initial.money) : ''
        patch.date = toDayText(initial.dateText) || toDayText(initial.date)
        patch.rawRemark = initial.remark || ''
        patch.belongUserId = initial.belongUserId || ''
        patch.belongUserName = initial.belongUserName || '全部'
        patch.recordId = initial.id
        patch.reimbursement = initial.reimbursement || 0
        patch.categoryId = type === 2 ? initial.incomesTypeId : initial.costTypeId
        patch.categoryName = type === 2 ? initial.incomesTypeName : initial.costTypeName
      } else {
        patch.date = this.data.date || today()
        const pref = getLastPref()
        const me = getUser()
        if (pref && (pref.belongUserId || pref.belongUserName)) {
          patch.belongUserId = pref.belongUserId || ''
          patch.belongUserName = pref.belongUserName || '全部'
        } else if (me) {
          const mine = users.find((item: any) => item.id === me.userId)
          if (mine) {
            patch.belongUserId = mine.id
            patch.belongUserName = mine.name
          }
        }
        const type = this.data.type === 2 ? 2 : 1
        if (pref) {
          patch.categoryId = type === 2 ? pref.incomesTypeId : pref.costTypeId
          patch.categoryName = type === 2 ? pref.incomesTypeName : pref.costTypeName
        }
      }

      const type = patch.type || this.data.type || 1
      const categories = visibleTypes(type === 2 ? bill.incomesTypes : bill.costTypes)
      if (patch.categoryId && !categories.some((item: any) => item.id === patch.categoryId)) {
        patch.categoryId = ''
        patch.categoryName = ''
      }
      patch.categories = categories
      const me = getUser()
      const mine = !!me && String(initial && initial.userId) === String(me.userId)
      patch.canDelete = this.data.mode === 'edit' && mine
      patch.canEdit = this.data.mode !== 'edit' || mine
      if (patch.rawRemark != null) {
        const parts = splitRemark(patch.rawRemark, patch.categoryId || '', patch.categoryName || '')
        patch.contentTag = parts.tag
        patch.remark = parts.desc
      }
      patch.suggestions = suggestionChips(patch.categoryId || '', patch.categoryName || '', patch.contentTag || '')
      patch.removingSuggestion = false
      this.setData(patch)
    },

    refreshSuggestions(categoryId: string, categoryName: string, contentTag: string) {
      this.setData({
        categoryId,
        categoryName,
        contentTag,
        removingSuggestion: false,
        suggestions: suggestionChips(categoryId, categoryName, contentTag)
      })
    },

    onType(e: WechatMiniprogram.TouchEvent) {
      const type = Number(e.currentTarget.dataset.type) === 2 ? 2 : 1
      const bill = this.data.bill as any
      const categories = visibleTypes(type === 2 ? bill.incomesTypes : bill.costTypes)
      const pref = getLastPref()
      let categoryId = ''
      let categoryName = ''
      if (pref) {
        categoryId = type === 2 ? pref.incomesTypeId : pref.costTypeId
        categoryName = type === 2 ? pref.incomesTypeName : pref.costTypeName
      }
      if (!categories.some((item: any) => item.id === categoryId)) {
        categoryId = ''
        categoryName = ''
      }
      this.refreshSuggestions(categoryId, categoryName, '')
      this.setData({ type, categories, showKeyboard: false })
    },

    onSelectCat(e: WechatMiniprogram.CustomEvent) {
      this.setData({ showKeyboard: false })
      this.refreshSuggestions(e.detail.id, e.detail.name, '')
    },

    onPickSuggestion(e: WechatMiniprogram.TouchEvent) {
      this.setData({ showKeyboard: false })
      const text = e.currentTarget.dataset.text
      const custom = String(e.currentTarget.dataset.custom) === 'true'
      if (this.data.removingSuggestion) {
        if (!custom) {
          wx.showToast({ title: '默认建议不能删除', icon: 'none' })
          return
        }
        removeCustomSuggestion(this.data.categoryId, text)
        const contentTag = this.data.contentTag === text ? '' : this.data.contentTag
        this.refreshSuggestions(this.data.categoryId, this.data.categoryName, contentTag)
        return
      }
      const contentTag = this.data.contentTag === text ? '' : text
      this.refreshSuggestions(this.data.categoryId, this.data.categoryName, contentTag)
    },

    onAddSuggestion() {
      if (!this.data.categoryId) {
        wx.showToast({ title: '请先选择分类', icon: 'none' })
        return
      }
      wx.showModal({
        title: '自定义内容',
        editable: true,
        placeholderText: '例如：地铁',
        success: (res) => {
          if (!res.confirm) return
          const text = (res.content || '').trim()
          if (!text) return
          if (text.length > 10) {
            wx.showToast({ title: '最多10个字', icon: 'none' })
            return
          }
          addCustomSuggestion(this.data.categoryId, text)
          this.refreshSuggestions(this.data.categoryId, this.data.categoryName, text)
        }
      })
    },

    onToggleRemove() {
      this.setData({ removingSuggestion: !this.data.removingSuggestion })
    },

    openKeyboard() {
      this.setData({ showKeyboard: true })
    },

    closeKeyboard() {
      this.setData({ showKeyboard: false })
    },

    onKey(e: WechatMiniprogram.CustomEvent) {
      this.setData({ amount: applyAmountKey(this.data.amount, e.detail.key) })
    },

    onDate(e: WechatMiniprogram.CustomEvent) {
      this.setData({ date: e.detail.value })
    },

    onRemark(e: WechatMiniprogram.CustomEvent) {
      const detail = e.detail as unknown
      const raw = typeof detail === 'string' ? detail : String((detail as { value?: string }).value || '')
      this.setData({ remark: raw.slice(0, 150) })
    },

    openUsers() {
      this.setData({ showUsers: true, showKeyboard: false })
    },

    closeUsers() {
      this.setData({ showUsers: false })
    },

    onUser(e: WechatMiniprogram.CustomEvent) {
      const raw = e.detail.index
      const index = Array.isArray(raw) ? raw[0] : raw
      this.setData({
        belongUserId: this.data.userIds[index] || '',
        belongUserName: this.data.userNames[index] || '全部',
        showUsers: false
      })
    },

    mergePref(): RecordPref {
      const prev = getLastPref() || emptyPref()
      if (this.data.type === 1) {
        return {
          costTypeId: this.data.categoryId,
          costTypeName: this.data.categoryName,
          incomesTypeId: prev.incomesTypeId,
          incomesTypeName: prev.incomesTypeName,
          belongUserId: this.data.belongUserId,
          belongUserName: this.data.belongUserName
        }
      }
      return {
        costTypeId: prev.costTypeId,
        costTypeName: prev.costTypeName,
        incomesTypeId: this.data.categoryId,
        incomesTypeName: this.data.categoryName,
        belongUserId: this.data.belongUserId,
        belongUserName: this.data.belongUserName
      }
    },

    buildPayload() {
      const money = Number(this.data.amount)
      if (!money) {
        wx.showToast({ title: '请输入金额', icon: 'none' })
        return null
      }
      if (!this.data.categoryId) {
        wx.showToast({ title: '请选择分类', icon: 'none' })
        return null
      }
      const bill = this.data.bill as any
      const dateText = this.data.recordId ? toDayText(this.data.date) : (this.data.date || today())
      if (this.data.recordId && !dateText) {
        wx.showToast({ title: '请选择日期', icon: 'none' })
        return null
      }
      const payload: any = {
        billId: bill.id,
        date: dayStartTs(dateText),
        money,
        type: this.data.type,
        belongUserId: this.data.belongUserId,
        remark: composeRemark(this.data.contentTag, this.data.remark)
      }
      if (this.data.recordId) payload.id = this.data.recordId
      if (this.data.type === 1) {
        payload.costTypeId = this.data.categoryId
        payload.reimbursement = this.data.reimbursement || 0
      } else {
        payload.incomesTypeId = this.data.categoryId
      }
      return payload
    },

    onConfirm() {
      if (!this.data.canEdit) {
        wx.showToast({ title: '只能编辑自己记的账单', icon: 'none' })
        return
      }
      const payload = this.buildPayload()
      if (!payload) return
      this.triggerEvent('submit', { payload, again: false, pref: this.mergePref() })
    },

    onAgain() {
      const payload = this.buildPayload()
      if (!payload) return
      this.triggerEvent('submit', { payload, again: true, pref: this.mergePref() })
    },

    /** 再记一笔：保留日期和归属人，清空金额与内容 */
    resetForAgain() {
      this.refreshSuggestions(this.data.categoryId, this.data.categoryName, '')
      this.setData({ amount: '', remark: '', showKeyboard: true })
    },

    onDelete() {
      this.triggerEvent('delete', { id: this.data.recordId })
    }
  }
})
