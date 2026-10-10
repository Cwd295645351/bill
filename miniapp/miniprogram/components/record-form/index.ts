import {
  addCustomSuggestion,
  composeRemark,
  removeCustomSuggestion,
  splitRemark,
  suggestionChips
} from '../../utils/content-suggestions'
import { dayStartTs, today, toDayText } from '../../utils/date'
import { applyAmountKey, RecordImage } from '../../utils/records'
import { getLastPref, getUser, RecordPref } from '../../utils/storage'

const MAX_PHOTOS = 9
const MAX_PHOTO_BYTES = 10485760

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

/** 本地待上传或已上传成功的照片 */
export interface LocalPhoto {
  path: string
  size: number
  serverId?: string
}

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
    canEdit: true,
    /** 新增时本地选择的照片；编辑增删在后续阶段开放 */
    photos: [] as LocalPhoto[],
    /** 编辑时已有照片（只展示，本阶段不提供增删） */
    images: [] as RecordImage[],
    maxPhotos: MAX_PHOTOS
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
        // 编辑：展示已有照片；增删在后续阶段开放
        const imgs = Array.isArray(initial.images) ? initial.images.slice() : []
        imgs.sort((a: RecordImage, b: RecordImage) => (a.sort || 0) - (b.sort || 0))
        patch.images = imgs
        patch.photos = []
      } else {
        patch.date = this.data.date || today()
        patch.images = []
        patch.photos = this.data.photos || []
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
      // 编辑保存时提交当前照片 id 列表（含未改动的原图）；新增由页面上传后再挂 imageIds
      if (this.data.recordId) {
        const fromExisting = (this.data.images || []).map((img: RecordImage) => img.id)
        const fromLocal = (this.data.photos || [])
          .map((p: LocalPhoto) => p.serverId)
          .filter(Boolean) as string[]
        payload.imageIds = fromExisting.concat(fromLocal)
      }
      return payload
    },

    photoCount() {
      return (this.data.images || []).length + (this.data.photos || []).length
    },

    /** 相册或拍照；已满 9 张时拒绝。新增与编辑（本人）均可 */
    onAddPhoto() {
      if (!this.data.canEdit) return
      const remain = MAX_PHOTOS - this.photoCount()
      if (remain <= 0) {
        wx.showToast({ title: '最多 9 张', icon: 'none' })
        return
      }
      wx.chooseMedia({
        count: remain,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed', 'original'],
        success: (res) => {
          const accepted = (this.data.photos || []).slice()
          let total = this.photoCount()
          for (const file of res.tempFiles || []) {
            if (total >= MAX_PHOTOS) {
              wx.showToast({ title: '最多 9 张', icon: 'none' })
              break
            }
            const size = Number(file.size || 0)
            if (!size || size > MAX_PHOTO_BYTES) {
              wx.showToast({ title: '单张照片不能超过 10MB', icon: 'none' })
              continue
            }
            if (!file.tempFilePath) {
              wx.showToast({ title: '无法当作照片打开', icon: 'none' })
              continue
            }
            accepted.push({ path: file.tempFilePath, size })
            total += 1
          }
          this.setData({ photos: accepted, showKeyboard: false })
        },
        fail: (err) => {
          // 用户取消不提示；无权限时说明原因
          const msg = (err && err.errMsg) || ''
          if (/auth|authorize|permission|deny/i.test(msg)) {
            wx.showToast({ title: '需要允许访问相机或相册后才能选照片', icon: 'none' })
          }
        }
      })
    },

    onRemovePhoto(e: WechatMiniprogram.TouchEvent) {
      if (!this.data.canEdit) return
      const index = Number(e.currentTarget.dataset.index)
      if (!Number.isFinite(index)) return
      const photos = (this.data.photos || []).slice()
      photos.splice(index, 1)
      this.setData({ photos })
    },

    /** 编辑时去掉已挂接的原图 */
    onRemoveExisting(e: WechatMiniprogram.TouchEvent) {
      if (!this.data.canEdit || this.data.mode !== 'edit') return
      const index = Number(e.currentTarget.dataset.index)
      if (!Number.isFinite(index)) return
      const images = (this.data.images || []).slice()
      images.splice(index, 1)
      this.setData({ images })
    },

    onPreviewLocal(e: WechatMiniprogram.TouchEvent) {
      const index = Number(e.currentTarget.dataset.index)
      const urls = (this.data.photos || []).map((p: LocalPhoto) => p.path)
      if (!urls.length) return
      wx.previewImage({ current: urls[index] || urls[0], urls })
    },

    onPreviewExisting(e: WechatMiniprogram.TouchEvent) {
      const index = Number(e.currentTarget.dataset.index)
      const urls = (this.data.images || []).map((img: RecordImage) => img.viewUrl).filter(Boolean)
      if (!urls.length) return
      wx.previewImage({ current: urls[index] || urls[0], urls })
    },

    /** 上传成功后回写 serverId，便于失败重试时只补传未成功的 */
    setPhotoServerIds(ids: Array<string | undefined>) {
      const photos = (this.data.photos || []).map((p: LocalPhoto, i: number) => {
        if (ids[i]) return { ...p, serverId: ids[i] }
        return p
      })
      this.setData({ photos })
    },

    getPhotos(): LocalPhoto[] {
      return (this.data.photos || []).slice()
    },

    onConfirm() {
      if (!this.data.canEdit) {
        wx.showToast({ title: '只能编辑自己记的账单', icon: 'none' })
        return
      }
      const payload = this.buildPayload()
      if (!payload) return
      this.triggerEvent('submit', {
        payload,
        again: false,
        pref: this.mergePref(),
        photos: this.getPhotos()
      })
    },

    /** 再记一笔：不产生记账，清空照片、金额和描述，保留日期和归属人 */
    onAgain() {
      this.resetForAgain()
    },

    /** 再记一笔：保留日期和归属人，清空金额、内容与已选照片 */
    resetForAgain() {
      this.refreshSuggestions(this.data.categoryId, this.data.categoryName, '')
      this.setData({ amount: '', remark: '', photos: [], showKeyboard: true })
    },

    onDelete() {
      this.triggerEvent('delete', { id: this.data.recordId })
    }
  }
})
