<template>
  <div class="page">
    <van-nav-bar title="记一笔" fixed placeholder>
      <template #right>
        <span class="link" @click="openBills">{{ billName }}</span>
      </template>
    </van-nav-bar>

    <van-empty v-if="!loading && !bills.length" description="还没有账本，请先加入或在电脑端创建">
      <van-button size="small" type="primary" color="#4285F4" @click="goBills">去账本</van-button>
    </van-empty>

    <van-loading v-else-if="loading && !bill" class="center" />

    <RecordForm
      v-else-if="bill"
      ref="formRef"
      :bill="bill"
      mode="add"
      :saving="saving"
      @submit="onSubmit"
    />

    <van-popup v-model:show="showBills" position="bottom" round>
      <van-picker
        title="选择账本"
        :columns="billColumns"
        @confirm="onPickBill"
        @cancel="showBills = false"
      />
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import RecordForm from '@/components/RecordForm.vue'
import { getBillDetail, getBillList } from '@/api/bill'
import { addTransaction } from '@/api/transaction'
import { useBillContextStore } from '@/stores/bill-context'
import { setLastPref, type RecordPref } from '@/utils/record-pref'
import {
  hideSaveLoading,
  showSaveLoading,
  uploadPendingPhotos,
  type PendingPhoto,
} from '@/utils/upload-photos'

const router = useRouter()
const billCtx = useBillContextStore()

const bills = ref<any[]>([])
const bill = ref<any>(null)
const billName = ref('请选择账本')
const loading = ref(false)
const saving = ref(false)
const showBills = ref(false)
const formRef = ref<InstanceType<typeof RecordForm> | null>(null)

const billColumns = computed(() => bills.value.map((b) => ({ text: b.name, value: b.id })))

async function useBill(id: string, name?: string) {
  const res = await getBillDetail(id)
  if (res.retCode !== 0 || !res.data) {
    showToast(res.message || '加载账本失败')
    return
  }
  bill.value = res.data
  billName.value = name || res.data.name
  billCtx.setCurrentBill(res.data)
}

async function loadBills() {
  loading.value = true
  try {
    const res = await getBillList()
    bills.value = res.retCode === 0 && Array.isArray(res.data) ? res.data : []
    if (!bills.value.length) {
      bill.value = null
      billName.value = '还没有账本'
      return
    }
    const last = billCtx.currentBillId
    const current = bills.value.find((b) => b.id === last) || bills.value[0]
    await useBill(current.id, current.name)
  } finally {
    loading.value = false
  }
}

function openBills() {
  if (!bills.value.length) {
    goBills()
    return
  }
  showBills.value = true
}

function onPickBill({ selectedOptions }: any) {
  showBills.value = false
  const id = selectedOptions?.[0]?.value
  const name = selectedOptions?.[0]?.text
  if (id) useBill(id, name)
}

function goBills() {
  router.replace({ name: 'bills' })
}

async function onSubmit(detail: {
  payload: Record<string, any>
  pref: RecordPref
  photos: PendingPhoto[]
  again: boolean
}) {
  if (saving.value) return
  const { payload, pref, photos, again } = detail
  saving.value = true
  try {
    const list = Array.isArray(photos) ? photos : []
    if (list.length) {
      const serverIds = await uploadPendingPhotos(payload.billId, list, (ids) => {
        formRef.value?.setPhotoServerIds?.(ids)
      })
      if (!serverIds) return
      showSaveLoading('保存中')
      const res = await addTransaction({ ...payload, imageIds: serverIds })
      if (res.retCode !== 0) {
        showToast(res.message || '保存失败')
        return
      }
    } else {
      showSaveLoading('保存中')
      const res = await addTransaction(payload)
      if (res.retCode !== 0) {
        showToast(res.message || '保存失败')
        return
      }
    }
    setLastPref(pref)
    billCtx.setCurrentBillId(payload.billId)
    hideSaveLoading()
    showToast('已保存')
    // 再记一笔：留在本页并重置表单；完成：进入账本详情
    if (again) {
      formRef.value?.resetForAgain?.()
    } else {
      router.push({ name: 'bill-detail', params: { id: payload.billId } })
    }
  } finally {
    hideSaveLoading()
    saving.value = false
  }
}

onMounted(loadBills)
</script>

<style scoped>
.link {
  color: #4285f4;
  font-size: 13px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.center {
  display: flex;
  justify-content: center;
  padding: 48px;
}
.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
