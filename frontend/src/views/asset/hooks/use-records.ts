import { ref } from 'vue'
import dayjs from 'dayjs'
import { addRecord, delRecord, editRecord, getRecords } from '../api'
import type { AssetRecordItem, AssetRow } from '../type'

/** 盘点历史。改旧记录后由服务端按日期重算当前金额 */
export const useRecords = (reload: () => Promise<void>) => {
  const visible = ref(false)
  const asset = ref<AssetRow | null>(null)
  const records = ref<AssetRecordItem[]>([])
  const editingId = ref('')
  const amount = ref('')
  const date = ref<number | ''>('')
  const startDate = ref<number | ''>('')
  const endDate = ref<number | ''>('')
  const saving = ref(false)

  const load = async () => {
    if (!asset.value) return
    const params: { assetId: string; startDate?: number; endDate?: number } = { assetId: asset.value.id }
    if (startDate.value) params.startDate = dayjs(Number(startDate.value)).startOf('day').valueOf()
    if (endDate.value) params.endDate = dayjs(Number(endDate.value)).endOf('day').valueOf()
    const [err, res] = await getRecords({ params })
    if (err || !res || res.retCode !== 0) {
      ElMessage.error(res?.message || '读取盘点失败')
      return
    }
    records.value = res.data || []
  }

  const open = async (row: AssetRow) => {
    asset.value = row
    editingId.value = ''
    amount.value = ''
    date.value = Date.now()
    startDate.value = ''
    endDate.value = ''
    visible.value = true
    await load()
  }

  const beginEdit = (item: AssetRecordItem) => {
    editingId.value = item.id
    amount.value = String(item.amount)
    date.value = Number(item.date)
  }

  const beginCreate = () => {
    editingId.value = ''
    amount.value = ''
    date.value = Date.now()
  }

  const save = async () => {
    if (!asset.value) return
    const value = Number(amount.value)
    if (!amount.value || !Number.isFinite(value) || value <= 0) {
      ElMessage.warning('盘点金额必须大于0')
      return
    }
    if (!date.value) {
      ElMessage.warning('日期不能为空')
      return
    }
    saving.value = true
    const payload = { assetId: asset.value.id, amount: value, date: Number(date.value), id: editingId.value || undefined }
    const request = editingId.value ? editRecord({ data: payload }) : addRecord({ data: payload })
    const [err, res] = await request
    saving.value = false
    if (err || !res || res.retCode !== 0) {
      ElMessage.error(res?.message || '保存盘点失败')
      return
    }
    beginCreate()
    await load()
    await reload()
  }

  const remove = async (item: AssetRecordItem) => {
    if (records.value.length <= 1) {
      ElMessage.warning('只剩一条记录时不能删除')
      return
    }
    const [err, res] = await delRecord({ params: { id: item.id } })
    if (err || !res || res.retCode !== 0) {
      ElMessage.error(res?.message || '删除失败')
      return
    }
    await load()
    await reload()
  }

  const formatDay = (ts: number) => dayjs(Number(ts)).format('YYYY-MM-DD')

  return {
    visible,
    asset,
    records,
    editingId,
    amount,
    date,
    saving,
    startDate,
    endDate,
    load,
    open,
    beginEdit,
    beginCreate,
    save,
    remove,
    formatDay,
  }
}
