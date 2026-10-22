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
  const saving = ref(false)
  const page = ref(1)
  const total = ref(0)
  const pageSize = 10

  const load = async () => {
    if (!asset.value) return
    const [err, res] = await getRecords({ params: { assetId: asset.value.id, page: page.value, pageSize } })
    if (err || !res || res.retCode !== 0) {
      ElMessage.error(res?.message || '读取盘点失败')
      return
    }
    const data = res.data
    if (Array.isArray(data)) {
      records.value = data
      total.value = data.length
      return
    }
    records.value = data?.list || []
    total.value = Number(data?.total) || 0
  }

  const open = async (row: AssetRow) => {
    asset.value = row
    editingId.value = ''
    amount.value = ''
    date.value = Date.now()
    page.value = 1
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
    page.value = 1
    await load()
    await reload()
  }

  const remove = async (item: AssetRecordItem) => {
    if (total.value <= 1) {
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
    page,
    total,
    pageSize,
    load,
    open,
    beginEdit,
    beginCreate,
    save,
    remove,
    formatDay,
  }
}
