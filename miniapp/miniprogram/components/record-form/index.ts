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
  belongUserName: ''
})

interface BillMember {
  id: string
  name: string
}

/** 按账本成员顺序重排名单并拼出名字；不在账本里的 id 会被去掉。这只是表单预览，保存后以服务端为准 */
function normalizeBelong(users: BillMember[], ids: string[]) {
  const picked = new Set(ids.map(String))
  const ordered = users.filter((user) => picked.has(String(user.id)))
  return {
    belongUserIds: ordered.map((user) => String(user.id)),
    belongUserName: ordered.length ? ordered.map((user) => user.name).join('、') : '全部'
  }
}

/** 平铺标签：支出带「全部」（id 为空串），收入只有成员 */
function belongTags(users: BillMember[], ids: string[], type: number) {
  const picked = new Set(ids.map(String))
  const tags = users.map((user) => ({ id: String(user.id), name: user.name, on: picked.has(String(user.id)) }))
  if (type === 1) tags.unshift({ id: '', name: '全部', on: ids.length === 0 })
  return tags
}

/** 收入的默认归属人：上次是本账本的单人就用他，否则用自己 */
function incomeDefault(users: BillMember[], prefIds: string[] | undefined, selfId: string): string[] {
  if (prefIds && prefIds.length === 1 && users.some((user) => String(user.id) === String(prefIds[0]))) return [String(prefIds[0])]
  return users.some((user) => String(user.id) === String(selfId)) ? [String(selfId)] : []
}

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
    /** 归属人名单，「全部」为空数组 */
    belongUserIds: [] as string[],
    belongUserName: '全部',
    belongTags: [] as Array<{ id: string; name: string; on: boolean }>,
    categoryId: '',
    categoryName: '',
    categories: [] as any[],
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

      const users: BillMember[] = bill.users || []
      const patch: any = {}

      if (initial && initial.id) {
        const type = initial.type === 2 ? 2 : 1
        patch.type = type
        patch.amount = initial.money != null ? String(initial.money) : ''
        patch.date = toDayText(initial.dateText) || toDayText(initial.date)
        patch.rawRemark = initial.remark || ''
        // 编辑时原样回填，不改归属人保存时名单不变
        patch.belongUserIds = Array.isArray(initial.belongUserIds) ? initial.belongUserIds.map(String) : []
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
        const selfId = me ? String(me.userId) : ''
        const type = this.data.type === 2 ? 2 : 1
        const prefIds = pref ? pref.belongUserIds : undefined
        let ids: string[]
        if (type === 2) ids = incomeDefault(users, prefIds, selfId)
        else if (prefIds) ids = prefIds
        else ids = incomeDefault(users, undefined, selfId)
        // 上次名单里已不在账本的人会被去掉，名字随之重算，避免保存时被服务端拒绝
        Object.assign(patch, normalizeBelong(users, ids))
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
      patch.belongTags = belongTags(users, patch.belongUserIds || [], type)
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
      this.applyTypeToBelong(type)
    },

    /** 切到收入时，「全部」或多人改为自己并提示；只有一人时保留 */
    applyTypeToBelong(type: number) {
      const users: BillMember[] = (this.data.bill as any).users || []
      let ids = this.data.belongUserIds
      if (type === 2 && ids.length !== 1) {
        const me = getUser()
        ids = incomeDefault(users, undefined, me ? String(me.userId) : '')
        wx.showToast({ title: '收入只能选一名归属人，已改为自己', icon: 'none' })
        this.setData(normalizeBelong(users, ids))
      }
      this.setData({ belongTags: belongTags(users, this.data.belongUserIds, type) })
    },

    /** 点归属人标签：支出时「全部」与成员互斥、成员可多选；收入时单选 */
    onToggleBelong(e: WechatMiniprogram.TouchEvent) {
      const id = String(e.currentTarget.dataset.id || '')
      const users: BillMember[] = (this.data.bill as any).users || []
      const type = this.data.type
      let ids: string[]
      if (type === 2) {
        if (!id) return
        ids = [id]
      } else if (!id) {
        ids = []
      } else {
        const current = this.data.belongUserIds
        ids = current.includes(id) ? current.filter((item: string) => item !== id) : current.concat(id)
      }
      const next = normalizeBelong(users, ids)
      this.setData({ ...next, belongTags: belongTags(users, next.belongUserIds, type), showKeyboard: false })
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

    mergePref(): RecordPref {
      const prev = getLastPref() || emptyPref()
      if (this.data.type === 1) {
        return {
          costTypeId: this.data.categoryId,
          costTypeName: this.data.categoryName,
          incomesTypeId: prev.incomesTypeId,
          incomesTypeName: prev.incomesTypeName,
          belongUserIds: this.data.belongUserIds,
          belongUserName: this.data.belongUserName
        }
      }
      return {
        costTypeId: prev.costTypeId,
        costTypeName: prev.costTypeName,
        incomesTypeId: this.data.categoryId,
        incomesTypeName: this.data.categoryName,
        belongUserIds: this.data.belongUserIds,
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
      if (this.data.type === 2 && this.data.belongUserIds.length !== 1) {
        wx.showToast({ title: '收入必须选一名归属人', icon: 'none' })
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
        belongUserIds: this.data.belongUserIds,
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

    /** 再记一笔：先保存当前数据，成功后由父页调用 resetForAgain */
    onAgain() {
      if (!this.data.canEdit) {
        wx.showToast({ title: '只能编辑自己记的账单', icon: 'none' })
        return
      }
      const payload = this.buildPayload()
      if (!payload) return
      this.triggerEvent('submit', {
        payload,
        again: true,
        pref: this.mergePref(),
        photos: this.getPhotos()
      })
    },

    /** 保存成功后清空金额、内容与照片，保留日期/分类/归属人，继续记下一笔 */
    resetForAgain() {
      this.refreshSuggestions(this.data.categoryId, this.data.categoryName, '')
      this.setData({ amount: '', remark: '', photos: [], showKeyboard: true })
    },

    onDelete() {
      this.triggerEvent('delete', { id: this.data.recordId })
    }
  }
})
