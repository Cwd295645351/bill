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
    if (!text || text === member.name) return
    const [err, res] = await editMember({ data: { id: member.id, name: text } })
    if (err || !res || res.retCode !== 0) {
      ElMessage.error(res?.message || '编辑成员失败')
      return
    }
    await load()
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

  return { members, visible, draftName, saving, open, create, rename, hide, load }
}

export type MemberFilter = Ref<string>
