<template>
  <div class="record-form">
    <div class="body" :class="{ 'with-kb': showKeyboard && canEdit }">
      <div class="type-switch">
        <button
          type="button"
          class="type"
          :class="{ on: type === 1, cost: type === 1 }"
          :disabled="!canEdit"
          @click="setType(1)"
        >
          支出
        </button>
        <button
          type="button"
          class="type"
          :class="{ on: type === 2, income: type === 2 }"
          :disabled="!canEdit"
          @click="setType(2)"
        >
          收入
        </button>
      </div>

      <div
        class="amount"
        :class="[type === 1 ? 'cost' : 'income', { editing: showKeyboard }]"
        @click="canEdit && openKeyboard()"
      >
        <span class="yen">¥</span>
        <span>{{ amount || '0.00' }}</span>
      </div>

      <!-- 分类：与小程序 category-grid 一致 -->
      <div class="cat-section">
        <div v-if="!categories.length" class="cat-empty muted">暂无可用分类</div>
        <div v-else class="cat-grid">
          <button
            v-for="(item, index) in categories"
            :key="item.id"
            type="button"
            class="cat-item"
            :class="{ on: categoryId === item.id }"
            :disabled="!canEdit"
            @click="onSelectCat(item)"
          >
            <span class="cat-icon" :style="{ background: COLORS[index % COLORS.length] }">
              {{ (item.name || '?').slice(0, 1) }}
            </span>
            <span class="cat-name">{{ item.name }}</span>
          </button>
        </div>
      </div>

      <!-- 内容建议 chips + 描述（与小程序一致） -->
      <div v-if="categoryId" class="suggest">
        <div class="chips">
          <button
            v-for="item in suggestions"
            :key="item.text"
            type="button"
            class="chip"
            :class="{ on: item.on }"
            :disabled="!canEdit"
            @click="onPickSuggestion(item)"
          >
            {{ removingSuggestion && item.custom ? '× ' : '' }}{{ item.text }}
          </button>
          <button type="button" class="chip tool" :disabled="!canEdit" @click="onAddSuggestion">+</button>
          <button
            type="button"
            class="chip tool"
            :class="{ on: removingSuggestion }"
            :disabled="!canEdit"
            @click="onToggleRemove"
          >
            -
          </button>
        </div>
        <div class="desc-box">
          <textarea
            v-model="remark"
            class="desc"
            maxlength="150"
            placeholder="描述这笔记账..."
            :disabled="!canEdit"
            @focus="closeKeyboard"
          />
          <div class="count">{{ remark.length }}/150</div>
        </div>
      </div>

      <!-- 照片（可选，最多 9 张） -->
      <div v-if="mode === 'add' || mode === 'edit'" class="photos">
        <div class="photos-title">照片（可选，最多 {{ maxPhotos }} 张）</div>
        <div class="photos-grid">
          <div
            v-for="(img, index) in images"
            :key="img.id"
            class="photo-item"
            @click="onPreviewExisting(index)"
          >
            <img class="photo-thumb" :src="img.viewUrl" alt="" />
            <button
              v-if="mode === 'edit' && canEdit"
              type="button"
              class="photo-del"
              @click.stop="onRemoveExisting(index)"
            >
              ×
            </button>
          </div>
          <div
            v-for="(photo, index) in photos"
            :key="photo.url"
            class="photo-item"
            @click="onPreviewLocal(index)"
          >
            <img class="photo-thumb" :src="photo.url" alt="" />
            <button
              v-if="canEdit"
              type="button"
              class="photo-del"
              @click.stop="onRemovePhoto(index)"
            >
              ×
            </button>
          </div>
          <button
            v-if="canEdit && images.length + photos.length < maxPhotos"
            type="button"
            class="photo-add"
            @click="onAddPhoto"
          >
            +
          </button>
        </div>
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          multiple
          class="file-hidden"
          @change="onFilePicked"
        />
      </div>

      <van-cell-group>
        <van-field
          :model-value="date"
          is-link
          readonly
          label="日期"
          :disabled="!canEdit"
          @click="openDate"
        />
      </van-cell-group>

      <div class="belong">
        <div class="belong-title">归属人</div>
        <div class="belong-tags">
          <button
            v-for="tag in belongTags"
            :key="tag.id === '' ? 'all' : tag.id"
            type="button"
            class="belong-tag"
            :class="{ on: tag.on }"
            :disabled="!canEdit"
            @click="onToggleBelong(tag.id)"
          >
            {{ tag.name }}
          </button>
        </div>
      </div>

      <button v-if="canDelete" type="button" class="danger" @click="onDelete">
        删除这条记录
      </button>
    </div>

    <div v-if="!showKeyboard && canEdit" class="submit-bar">
      <button v-if="mode === 'add'" type="button" class="again" :disabled="saving" @click="onAgain">
        再记一笔
      </button>
      <button type="button" class="ok" :disabled="saving" @click="onConfirm">
        {{ mode === 'add' ? '完成' : '保存' }}
      </button>
    </div>

    <MoneyKeyboard
      v-if="showKeyboard && canEdit"
      :show-again="false"
      confirm-text="完成"
      @key="onKey"
      @confirm="closeKeyboard"
    />

    <van-popup v-model:show="showDate" position="bottom" round>
      <van-date-picker
        title="选择日期"
        :min-date="minDate"
        :max-date="maxDate"
        :columns-type="['year', 'month', 'day']"
        @confirm="onDateConfirm"
        @cancel="showDate = false"
      />
    </van-popup>

    <van-dialog
      v-model:show="showAddChip"
      title="自定义内容"
      show-cancel-button
      @confirm="confirmAddChip"
    >
      <van-field v-model="newChipText" maxlength="10" placeholder="例如：地铁" />
    </van-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { showImagePreview, showToast } from 'vant'
import MoneyKeyboard from '@/components/MoneyKeyboard.vue'
import { useSessionStore } from '@/stores/session'
import { dayStartTs, today, toDayText } from '@/utils/date'
import { emptyPref, getLastPref, setLastPref, type RecordPref } from '@/utils/record-pref'
import {
  addCustomSuggestion,
  composeRemark,
  removeCustomSuggestion,
  splitRemark,
  suggestionChips,
  type SuggestionChip,
} from '@/utils/content-suggestions'
import { applyAmountKey } from '@/utils/money-key'
import type { PendingPhoto } from '@/utils/upload-photos'
import type { RecordImage } from '@/utils/records'

const COLORS = ['#4285F4', '#34A853', '#FBBC05', '#EA4335', '#9C27B0', '#00ACC1', '#FF7043', '#5C6BC0']
const MAX_PHOTOS = 9
const MAX_PHOTO_BYTES = 10485760

interface BillMember {
  id: string
  name: string
}

const props = defineProps<{
  bill: any
  mode?: 'add' | 'edit'
  initial?: any
  saving?: boolean
}>()

const emit = defineEmits<{
  submit: [
    detail: {
      payload: Record<string, any>
      pref: RecordPref
      photos: PendingPhoto[]
      /** 为 true 时表示保存后继续记下一笔，不离开页面 */
      again: boolean
    },
  ]
  delete: [id: string]
}>()

const session = useSessionStore()
const type = ref(1)
const amount = ref('')
const date = ref(today())
const remark = ref('')
const contentTag = ref('')
const categoryId = ref('')
const categoryName = ref('')
const belongUserIds = ref<string[]>([])
const belongUserName = ref('全部')
const recordId = ref('')
const reimbursement = ref(0)
const showDate = ref(false)
const showKeyboard = ref(true)
const suggestions = ref<SuggestionChip[]>([])
const removingSuggestion = ref(false)
const showAddChip = ref(false)
const newChipText = ref('')
const images = ref<RecordImage[]>([])
const photos = ref<PendingPhoto[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const maxPhotos = MAX_PHOTOS
const minDate = new Date(2018, 0, 1)
const maxDate = new Date()

const mode = computed(() => props.mode || 'add')
const saving = computed(() => !!props.saving)

const canEdit = computed(() => {
  if (props.mode !== 'edit') return true
  const me = session.userInfo?.userId
  return !!me && String(props.initial?.userId) === String(me)
})

const canDelete = computed(() => props.mode === 'edit' && canEdit.value && !!recordId.value)

function visibleTypes(list: any[]) {
  return (list || []).filter((item) => !item.isDel && !item.hidden)
}

const categories = computed(() =>
  visibleTypes(type.value === 2 ? props.bill?.incomesTypes : props.bill?.costTypes),
)

function normalizeBelong(users: BillMember[], ids: string[]) {
  const picked = new Set(ids.map(String))
  const ordered = users.filter((u) => picked.has(String(u.id)))
  return {
    belongUserIds: ordered.map((u) => String(u.id)),
    belongUserName: ordered.length ? ordered.map((u) => u.name).join('、') : '全部',
  }
}

function belongTagsComputed(users: BillMember[], ids: string[], t: number) {
  const picked = new Set(ids.map(String))
  const tags = users.map((u) => ({
    id: String(u.id),
    name: u.name,
    on: picked.has(String(u.id)),
  }))
  if (t === 1) tags.unshift({ id: '', name: '全部', on: ids.length === 0 })
  return tags
}

const belongTags = computed(() =>
  belongTagsComputed((props.bill?.users || []) as BillMember[], belongUserIds.value, type.value),
)

function incomeDefault(users: BillMember[], prefIds: string[] | undefined, selfId: string): string[] {
  if (
    prefIds &&
    prefIds.length === 1 &&
    users.some((u) => String(u.id) === String(prefIds[0]))
  ) {
    return [String(prefIds[0])]
  }
  return users.some((u) => String(u.id) === String(selfId)) ? [String(selfId)] : []
}

function refreshSuggestions(catId: string, catName: string, tag: string) {
  contentTag.value = tag
  categoryId.value = catId
  categoryName.value = catName
  suggestions.value = suggestionChips(catId, catName, tag)
}

function applyCategoryFromPref(t: number) {
  const list = visibleTypes(t === 2 ? props.bill?.incomesTypes : props.bill?.costTypes)
  const pref = getLastPref()
  let id = ''
  let name = ''
  if (pref) {
    id = t === 2 ? pref.incomesTypeId : pref.costTypeId
    name = t === 2 ? pref.incomesTypeName : pref.costTypeName
  }
  if (!list.some((item: any) => item.id === id)) {
    id = ''
    name = ''
  }
  refreshSuggestions(id, name, '')
}

function onSelectCat(item: { id: string; name: string }) {
  if (!canEdit.value) return
  showKeyboard.value = false
  refreshSuggestions(item.id, item.name, '')
}

function setType(next: number) {
  if (!canEdit.value || next === type.value) return
  type.value = next === 2 ? 2 : 1
  onTypeChange()
}

function syncFromProps() {
  const bill = props.bill
  if (!bill?.id) return
  const initial = props.initial
  const users: BillMember[] = bill.users || []
  const me = session.userInfo?.userId || ''
  const pref = getLastPref()

  if (props.mode === 'edit' && initial?.id) {
    type.value = initial.type === 2 ? 2 : 1
    amount.value = initial.money != null ? String(initial.money) : ''
    date.value = toDayText(initial.dateText) || toDayText(initial.date) || today()
    belongUserIds.value = Array.isArray(initial.belongUserIds)
      ? initial.belongUserIds.map(String)
      : []
    belongUserName.value = initial.belongUserName || '全部'
    recordId.value = initial.id
    reimbursement.value = initial.reimbursement || 0
    const catId = type.value === 2 ? initial.incomesTypeId : initial.costTypeId
    const catName = type.value === 2 ? initial.incomesTypeName : initial.costTypeName
    const list = visibleTypes(type.value === 2 ? bill.incomesTypes : bill.costTypes)
    const ok = list.some((item: any) => item.id === catId)
    const parts = splitRemark(initial.remark || '', ok ? catId : '', ok ? catName || '' : '')
    remark.value = parts.desc
    refreshSuggestions(ok ? catId || '' : '', ok ? catName || '' : '', parts.tag)
    images.value = Array.isArray(initial.images)
      ? initial.images.map((img: any) => ({
          id: img.id,
          sort: img.sort || 0,
          viewUrl: img.viewUrl || '',
        }))
      : []
    photos.value = []
    showKeyboard.value = false
  } else {
    date.value = today()
    recordId.value = ''
    amount.value = ''
    remark.value = ''
    type.value = 1
    images.value = []
    photos.value = []
    showKeyboard.value = true
    const prefIds = pref?.belongUserIds
    const ids =
      type.value === 2
        ? incomeDefault(users, prefIds, me)
        : prefIds && prefIds.length
          ? prefIds.filter((id) => users.some((u) => String(u.id) === String(id)))
          : incomeDefault(users, undefined, me)
    const next = normalizeBelong(users, ids)
    belongUserIds.value = next.belongUserIds
    belongUserName.value = next.belongUserName
    applyCategoryFromPref(type.value)
  }
}

watch(
  () => [props.bill, props.initial, props.mode],
  () => syncFromProps(),
  { immediate: true, deep: true },
)

function onTypeChange() {
  const users: BillMember[] = props.bill?.users || []
  const me = session.userInfo?.userId || ''
  if (type.value === 2 && belongUserIds.value.length !== 1) {
    const ids = incomeDefault(users, undefined, me)
    const next = normalizeBelong(users, ids)
    belongUserIds.value = next.belongUserIds
    belongUserName.value = next.belongUserName
    showToast('收入只能选一名归属人，已改为自己')
  }
  applyCategoryFromPref(type.value)
  remark.value = ''
}

function onToggleBelong(id: string) {
  if (!canEdit.value) return
  showKeyboard.value = false
  const users: BillMember[] = props.bill?.users || []
  let ids: string[]
  if (type.value === 2) {
    if (!id) return
    ids = [id]
  } else if (!id) {
    ids = []
  } else {
    const current = belongUserIds.value
    ids = current.includes(id) ? current.filter((x) => x !== id) : current.concat(id)
  }
  const next = normalizeBelong(users, ids)
  belongUserIds.value = next.belongUserIds
  belongUserName.value = next.belongUserName
}

function onPickSuggestion(item: SuggestionChip) {
  if (!canEdit.value) return
  showKeyboard.value = false
  if (removingSuggestion.value) {
    if (!item.custom) {
      showToast('默认建议不能删除')
      return
    }
    removeCustomSuggestion(categoryId.value, item.text)
    const tag = contentTag.value === item.text ? '' : contentTag.value
    refreshSuggestions(categoryId.value, categoryName.value, tag)
    return
  }
  const tag = contentTag.value === item.text ? '' : item.text
  refreshSuggestions(categoryId.value, categoryName.value, tag)
}

function onAddSuggestion() {
  if (!canEdit.value) return
  if (!categoryId.value) {
    showToast('请先选择分类')
    return
  }
  newChipText.value = ''
  showAddChip.value = true
}

function confirmAddChip() {
  const text = newChipText.value.trim()
  if (!text) return
  if (text.length > 10) {
    showToast('最多 10 个字')
    return
  }
  addCustomSuggestion(categoryId.value, text)
  refreshSuggestions(categoryId.value, categoryName.value, text)
}

function onToggleRemove() {
  removingSuggestion.value = !removingSuggestion.value
}

function openKeyboard() {
  showKeyboard.value = true
}

function closeKeyboard() {
  showKeyboard.value = false
}

function onKey(key: string) {
  amount.value = applyAmountKey(amount.value, key)
}

function openDate() {
  if (!canEdit.value) return
  closeKeyboard()
  showDate.value = true
}

function onDateConfirm({ selectedValues }: any) {
  if (selectedValues && selectedValues.length >= 3) {
    const [y, m, d] = selectedValues
    date.value = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  showDate.value = false
}

function photoCount() {
  return images.value.length + photos.value.length
}

function onAddPhoto() {
  if (!canEdit.value) return
  const remain = MAX_PHOTOS - photoCount()
  if (remain <= 0) {
    showToast('最多 9 张')
    return
  }
  fileInput.value?.click()
}

function onFilePicked(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  if (!files.length) return
  const accepted = photos.value.slice()
  let total = photoCount()
  for (const file of files) {
    if (total >= MAX_PHOTOS) {
      showToast('最多 9 张')
      break
    }
    if (!file.size || file.size > MAX_PHOTO_BYTES) {
      showToast('单张照片不能超过 10MB')
      continue
    }
    if (!file.type.startsWith('image/')) {
      showToast('只能选择图片')
      continue
    }
    accepted.push({
      file,
      url: URL.createObjectURL(file),
      size: file.size,
    })
    total += 1
  }
  photos.value = accepted
  showKeyboard.value = false
}

function onRemovePhoto(index: number) {
  if (!canEdit.value) return
  const list = photos.value.slice()
  const removed = list.splice(index, 1)[0]
  if (removed?.url) URL.revokeObjectURL(removed.url)
  photos.value = list
}

function onRemoveExisting(index: number) {
  if (!canEdit.value || mode.value !== 'edit') return
  const list = images.value.slice()
  list.splice(index, 1)
  images.value = list
}

function onPreviewLocal(index: number) {
  const urls = photos.value.map((p) => p.url)
  if (!urls.length) return
  showImagePreview({ images: urls, startPosition: index })
}

function onPreviewExisting(index: number) {
  const urls = images.value.map((img) => img.viewUrl).filter(Boolean)
  if (!urls.length) return
  showImagePreview({ images: urls, startPosition: index })
}

/** 供父页上传成功后回写 serverId */
function setPhotoServerIds(ids: Array<string | undefined>) {
  photos.value = photos.value.map((p, i) => (ids[i] ? { ...p, serverId: ids[i] } : p))
}

defineExpose({ setPhotoServerIds, resetForAgain, images, photos })

function mergePref(): RecordPref {
  const prev = getLastPref() || emptyPref()
  if (type.value === 1) {
    return {
      ...prev,
      costTypeId: categoryId.value,
      costTypeName: categoryName.value,
      belongUserIds: belongUserIds.value.slice(),
      belongUserName: belongUserName.value,
    }
  }
  return {
    ...prev,
    incomesTypeId: categoryId.value,
    incomesTypeName: categoryName.value,
    belongUserIds: belongUserIds.value.slice(),
    belongUserName: belongUserName.value,
  }
}

function buildPayload(): Record<string, any> | null {
  const money = Number(amount.value)
  if (!money) {
    showToast('请输入金额')
    return null
  }
  if (!categoryId.value) {
    showToast('请先选择分类')
    return null
  }
  if (type.value === 2 && belongUserIds.value.length !== 1) {
    showToast('收入必须选一名归属人')
    return null
  }
  const payload: Record<string, any> = {
    billId: props.bill.id,
    date: dayStartTs(date.value),
    money,
    type: type.value,
    belongUserIds: belongUserIds.value,
    remark: composeRemark(contentTag.value, remark.value),
  }
  if (recordId.value) payload.id = recordId.value
  if (type.value === 1) {
    payload.costTypeId = categoryId.value
    payload.reimbursement = reimbursement.value || 0
  } else {
    payload.incomesTypeId = categoryId.value
  }
  if (recordId.value) {
    const fromExisting = images.value.map((img) => img.id)
    const fromLocal = photos.value.map((p) => p.serverId).filter(Boolean) as string[]
    payload.imageIds = fromExisting.concat(fromLocal)
  }
  return payload
}

function onConfirm() {
  if (!canEdit.value) {
    showToast('只能编辑自己记的账单')
    return
  }
  const payload = buildPayload()
  if (!payload) return
  const pref = mergePref()
  setLastPref(pref)
  emit('submit', { payload, pref, photos: photos.value.slice(), again: false })
}

/** 再记一笔：先保存当前数据，成功后由父页调用 resetForAgain */
function onAgain() {
  if (!canEdit.value) {
    showToast('只能编辑自己记的账单')
    return
  }
  if (saving.value) return
  const payload = buildPayload()
  if (!payload) return
  const pref = mergePref()
  setLastPref(pref)
  emit('submit', { payload, pref, photos: photos.value.slice(), again: true })
}

/** 保存成功后清空金额、内容与照片，保留日期/分类/归属人，继续记下一笔 */
function resetForAgain() {
  refreshSuggestions(categoryId.value, categoryName.value, '')
  amount.value = ''
  remark.value = ''
  photos.value.forEach((p) => {
    if (p.url) URL.revokeObjectURL(p.url)
  })
  photos.value = []
  showKeyboard.value = true
}

function onDelete() {
  if (recordId.value) emit('delete', recordId.value)
}
</script>

<style scoped>
.record-form {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: calc(100vh - 46px);
  background: #fff;
}
.body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 8px;
}
/* 键盘悬浮后为滚动区预留高度，避免底部内容被遮挡 */
.body.with-kb {
  padding-bottom: calc(240px + env(safe-area-inset-bottom));
}
.type-switch {
  display: flex;
  width: 140px;
  margin: 10px auto 0;
  overflow: hidden;
  background: #f2f3f5;
  border-radius: 16px;
}
.type {
  flex: 1;
  margin: 0;
  padding: 0;
  color: #999;
  font-size: 14px;
  line-height: 32px;
  text-align: center;
  background: transparent;
  border: none;
}
.type.on {
  background: #fff;
  font-weight: 600;
}
.type.on.cost {
  color: #f74f4f;
}
.type.on.income {
  color: #07c160;
}
.amount {
  display: flex;
  align-items: baseline;
  justify-content: center;
  width: fit-content;
  margin: 0 auto;
  padding: 12px 6px 4px;
  font-size: 36px;
  font-weight: 600;
  border-bottom: 2px solid transparent;
}
.amount.cost {
  color: #f74f4f;
}
.amount.income {
  color: #07c160;
}
.amount.editing {
  border-bottom-color: currentColor;
}
.yen {
  margin-right: 4px;
  font-size: 20px;
}
.cat-section {
  margin-top: 4px;
}
.cat-empty {
  padding: 16px;
  text-align: center;
}
.cat-grid {
  display: flex;
  flex-wrap: wrap;
  padding: 4px 6px 8px;
}
.cat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 25%;
  margin: 0;
  padding: 8px 0;
  background: transparent;
  border: none;
}
.cat-icon {
  width: 42px;
  height: 42px;
  color: #fff;
  font-size: 16px;
  line-height: 42px;
  text-align: center;
  border-radius: 21px;
}
.cat-item.on .cat-icon {
  box-shadow:
    0 0 0 2px #fff,
    0 0 0 4px #4285f4;
}
.cat-name {
  max-width: 72px;
  margin-top: 4px;
  overflow: hidden;
  color: #666;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cat-item.on .cat-name {
  color: #4285f4;
}
.suggest {
  padding: 4px 12px 0;
}
.chips {
  display: flex;
  flex-wrap: wrap;
}
.chip {
  margin: 0 8px 8px 0;
  padding: 5px 11px;
  border: none;
  border-radius: 14px;
  color: #666;
  font-size: 13px;
  background: #f3f4f6;
  cursor: pointer;
}
.chip.on {
  color: #4285f4;
  background: #e8f1ff;
}
.chip.tool {
  min-width: 32px;
  text-align: center;
  color: #999;
}
.desc-box {
  position: relative;
  margin: 4px 0 8px;
}
.desc {
  width: 100%;
  height: 70px;
  padding: 4px 0 18px;
  border: none;
  resize: none;
  font-size: 14px;
  line-height: 1.5;
  box-sizing: border-box;
}
.count {
  position: absolute;
  right: 0;
  bottom: 0;
  color: #bbb;
  font-size: 11px;
}
.photos {
  padding: 8px 12px 4px;
}
.photos-title {
  margin-bottom: 6px;
  color: #666;
  font-size: 13px;
}
.photos-grid {
  display: flex;
  flex-wrap: wrap;
}
.photo-item,
.photo-add {
  position: relative;
  width: 74px;
  height: 74px;
  margin: 0 8px 8px 0;
  overflow: hidden;
  border-radius: 6px;
  background: #f3f4f6;
}
.photo-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.photo-del {
  position: absolute;
  top: 0;
  right: 0;
  width: 20px;
  height: 20px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 0 0 0 6px;
  color: #fff;
  font-size: 14px;
  line-height: 20px;
  text-align: center;
  background: rgba(0, 0, 0, 0.45);
}
.photo-add {
  color: #999;
  font-size: 32px;
  line-height: 74px;
  text-align: center;
  border: 1px dashed #d0d3d9;
  background: #fafafa;
}
.file-hidden {
  display: none;
}
.belong {
  padding: 10px 16px 2px;
  border-top: 1px solid #f0f0f0;
}
.belong-title {
  margin-bottom: 8px;
  color: #323233;
  font-size: 14px;
}
.belong-tags {
  display: flex;
  flex-wrap: wrap;
}
.belong-tag {
  margin: 0 8px 8px 0;
  padding: 5px 14px;
  border: 1px solid #dcdee0;
  border-radius: 14px;
  color: #666;
  font-size: 13px;
  background: #fff;
}
.belong-tag.on {
  color: #fff;
  border-color: #4285f4;
  background: #4285f4;
}
.danger {
  display: block;
  width: calc(100% - 24px);
  margin: 12px auto;
  padding: 0;
  border: none;
  color: #f74f4f;
  font-size: 15px;
  line-height: 40px;
  text-align: center;
  background: transparent;
}
.submit-bar {
  display: flex;
  flex-shrink: 0;
  padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.04);
}
.submit-bar .again,
.submit-bar .ok {
  flex: 1;
  height: 44px;
  margin: 0 4px;
  border: none;
  border-radius: 6px;
  font-size: 15px;
}
.submit-bar .again {
  color: #4285f4;
  background: #e8f1ff;
}
.submit-bar .ok {
  color: #fff;
  background: #4285f4;
}
.submit-bar .again:disabled,
.submit-bar .ok:disabled {
  opacity: 0.6;
}
</style>
