<template>
  <div class="page">
    <van-nav-bar :title="billName || '记一笔'" left-arrow fixed placeholder @click-left="router.back()" />
    <van-loading v-if="loading" class="center" />
    <van-empty v-else-if="!bill" description="账本不存在或无权访问" />
    <RecordForm
      v-else
      ref="formRef"
      :bill="bill"
      mode="add"
      :saving="saving"
      @submit="onSubmit"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import RecordForm from '@/components/RecordForm.vue'
import { getBillDetail } from '@/api/bill'
import { addTransaction } from '@/api/transaction'
import { useBillContextStore } from '@/stores/bill-context'
import { setLastPref, type RecordPref } from '@/utils/record-pref'
import {
  hideSaveLoading,
  showSaveLoading,
  uploadPendingPhotos,
  type PendingPhoto,
} from '@/utils/upload-photos'

const route = useRoute()
const router = useRouter()
const billCtx = useBillContextStore()

const bill = ref<any>(null)
const billName = ref('')
const loading = ref(false)
const saving = ref(false)
const formRef = ref<InstanceType<typeof RecordForm> | null>(null)

async function load() {
  const billId = String(route.query.billId || billCtx.currentBillId || '')
  if (!billId) {
    showToast('请先选择账本')
    router.replace({ name: 'record-add' })
    return
  }
  loading.value = true
  try {
    const res = await getBillDetail(billId)
    if (res.retCode !== 0 || !res.data) {
      showToast(res.message || '加载失败')
      return
    }
    bill.value = res.data
    billName.value = res.data.name || ''
    billCtx.setCurrentBill(res.data)
  } finally {
    loading.value = false
  }
}

async function onSubmit(detail: {
  payload: Record<string, any>
  pref: RecordPref
  photos: PendingPhoto[]
}) {
  if (saving.value) return
  const { payload, pref, photos } = detail
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
    hideSaveLoading()
    showToast('已保存')
    router.back()
  } finally {
    hideSaveLoading()
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
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
