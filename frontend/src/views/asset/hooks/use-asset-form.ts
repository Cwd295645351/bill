import { computed, reactive, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import { addAsset, delAsset, editAsset } from '../api'
import type { AssetForm, AssetRow } from '../type'

const emptyForm = (): AssetForm => ({
  id: '',
  name: '',
  memberId: '',
  type: 'living',
  fourMoneyType: 'living',
  latestAmount: '',
  insuranceCategory: '',
  annualPremium: '',
  currency: 'CNY',
})

/** 登记和编辑。金额数值没变时，服务端不会新增盘点 */
export const useAssetForm = (reload: () => Promise<void>) => {
  const { billId } = storeToRefs(useBillStore())
  const visible = ref(false)
  const saving = ref(false)
  const form = reactive<AssetForm>(emptyForm())
  const originAmount = ref<number | null>(null)
  const amountUnchanged = computed(() => {
    if (!form.id || originAmount.value == null) return false
    return Number(form.latestAmount) === originAmount.value
  })

  const openCreate = (memberId: string) => {
    originAmount.value = null
    Object.assign(form, emptyForm(), { memberId })
    visible.value = true
  }

  const openEdit = (row: AssetRow) => {
    originAmount.value = Number(row.rawAmount ?? row.latestAmount)
    Object.assign(form, emptyForm(), {
      id: row.id,
      name: row.name,
      memberId: row.memberId,
      type: row.type,
      fourMoneyType: row.fourMoneyType,
      latestAmount: String(row.rawAmount ?? row.latestAmount ?? ''),
      insuranceCategory: row.insuranceCategory || '',
      annualPremium: row.annualPremium == null ? '' : String(row.annualPremium),
      currency: row.currency || 'CNY',
    })
    visible.value = true
  }

  const save = async () => {
    if (!form.name.trim()) {
      ElMessage.warning('资产名称不能为空')
      return
    }
    if (!form.memberId) {
      ElMessage.warning('请选择成员')
      return
    }
    const amount = Number(form.latestAmount)
    if (!form.latestAmount || !Number.isFinite(amount) || amount <= 0) {
      ElMessage.warning('最新金额必须大于0')
      return
    }
    if (form.type !== 'debt' && !form.fourMoneyType) {
      ElMessage.warning('请选择四笔钱')
      return
    }
    if (form.fourMoneyType === 'insurance' && form.annualPremium !== '') {
      const premium = Number(form.annualPremium)
      if (!Number.isFinite(premium) || premium < 0) {
        ElMessage.warning('年交保费不能小于0')
        return
      }
    }
    const moneyType = form.type === 'debt' ? '' : form.fourMoneyType
    const payload = {
      id: form.id || undefined,
      name: form.name.trim(),
      billId: billId.value,
      memberId: form.memberId,
      type: form.type,
      fourMoneyType: moneyType,
      latestAmount: amount,
      currency: form.currency || 'CNY',
      insuranceCategory: moneyType === 'insurance' ? form.insuranceCategory : '',
      annualPremium: moneyType === 'insurance' ? form.annualPremium : '',
    }
    saving.value = true
    const request = form.id ? editAsset({ data: payload }) : addAsset({ data: payload })
    const [err, res] = await request
    saving.value = false
    if (err || !res || res.retCode !== 0) {
      ElMessage.error(res?.message || '保存失败')
      return
    }
    visible.value = false
    await reload()
  }

  const remove = async () => {
    if (!form.id) return
    const [err, res] = await delAsset({ params: { id: form.id } })
    if (err || !res || res.retCode !== 0) {
      ElMessage.error(res?.message || '删除失败')
      return
    }
    visible.value = false
    await reload()
  }

  return { visible, saving, form, amountUnchanged, openCreate, openEdit, save, remove }
}
