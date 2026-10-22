import { ref, watch, type Ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import { addMember, delMember, editMember, getMembers } from '../api'
import type { AssetMember } from '../type'

/** 资产成员：新增、改名、隐藏。隐藏不改动名下资产 */
export const useMembers = () => {
  const { billId } = storeToRefs(useBillStore())
  const members = ref<AssetMember[]>([])
  const visible = ref(false)
  const draftName = ref('')
  const saving = ref(false)
  // 正在编辑的名称单独存放，避免输入时被原名覆盖
  const drafts = ref<Record<string, string>>({})

  const draftOf = (member: AssetMember) => drafts.value[member.id] ?? member.name

  const setDraft = (id: string, name: string) => {
    drafts.value[id] = name
  }

  const clearDraft = (id: string) => {
    delete drafts.value[id]
  }

  const load = async () => {
    if (!billId.value) {
      members.value = []
      return
    }
    const [err, res] = await getMembers({ params: { billId: billId.value } })
    if (err || !res || res.retCode !== 0) {
      if (res?.message) ElMessage.error(res.message)
      return
    }
    members.value = res.data || []
  }

  const open = () => {
    draftName.value = ''
    drafts.value = {}
    visible.value = true
  }

  const create = async () => {
    const name = draftName.value.trim()
    if (!name) {
      ElMessage.warning('成员名称不能为空')
      return
    }
    saving.value = true
    const [err, res] = await addMember({ data: { name, billId: billId.value } })
    saving.value = false
    if (err || !res || res.retCode !== 0) {
      ElMessage.error(res?.message || '创建成员失败')
      return
    }
    draftName.value = ''
    await load()
  }

  const rename = async (member: AssetMember, name: string) => {
    const text = name.trim()
    if (!text) {
      ElMessage.warning('成员名称不能为空')
      clearDraft(member.id)
      return false
    }
    if (text.length > 64) {
      ElMessage.warning('成员名称不能超过64个字')
      return false
    }
    if (text === member.name) {
      clearDraft(member.id)
      return false
    }
    const [err, res] = await editMember({ data: { id: member.id, name: text } })
    if (err || !res || res.retCode !== 0) {
      ElMessage.error(res?.message || '编辑成员失败')
      clearDraft(member.id)
      return false
    }
    member.name = text
    ElMessage.success('已修改成员名称')
    await load()
    clearDraft(member.id)
    return true
  }

  const hide = async (member: AssetMember) => {
    try {
      await ElMessageBox.confirm('只隐藏该成员，名下资产仍计入家庭合计', '隐藏成员', { type: 'warning' })
    } catch {
      return
    }
    const [err, res] = await delMember({ params: { id: member.id } })
    if (err || !res || res.retCode !== 0) {
      ElMessage.error(res?.message || '隐藏成员失败')
      return
    }
    ElMessage.success('已隐藏。名下资产仍计入家庭总额')
    await load()
  }

  watch(billId, load, { immediate: true })

  return { members, visible, draftName, saving, open, create, rename, draftOf, setDraft, hide, load }
}

export type MemberFilter = Ref<string>
