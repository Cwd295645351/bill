<template>
  <div class="page">
    <van-nav-bar title="编辑记账" left-arrow fixed placeholder @click-left="router.back()" />
    <van-loading v-if="loading" class="center" />
    <van-empty v-else-if="!canEdit" description="只能编辑自己记的账单" />
    <van-empty v-else-if="!bill || !initial" description="记录不存在" />
    <RecordForm
      v-else
      ref="formRef"
      :bill="bill"
      mode="edit"
      :initial="initial"
      :saving="saving"
      @submit="onSubmit"
      @delete="onDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import RecordForm from '@/components/RecordForm.vue'
import { getBillDetail } from '@/api/bill'
import { deleteTransaction, editTransaction } from '@/api/transaction'
import { useSessionStore } from '@/stores/session'
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
const session = useSessionStore()
const billCtx = useBillContextStore()

const bill = ref<any>(null)
const initial = ref<any>(null)
const loading = ref(false)
const saving = ref(false)
const formRef = ref<InstanceType<typeof RecordForm> | null>(null)

const canEdit = computed(() => {
  if (!initial.value) return false
  return String(initial.value.userId) === String(session.userInfo?.userId)
})

async function load() {
  loading.value = true
  try {
    const raw = sessionStorage.getItem('editingRecord')
    if (!raw) {
      showToast('记录不存在')
      router.back()
      return
    }
    initial.value = JSON.parse(raw)
    if (!canEdit.value) {
      showToast('只能编辑自己记的账单')
      return
    }
    const billId = String(route.query.billId || initial.value.billId || billCtx.currentBillId || '')
    const res = await getBillDetail(billId)
    if (res.retCode !== 0 || !res.data) {
      showToast(res.message || '加载账本失败')
      return
    }
    bill.value = res.data
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
    const serverIds = await uploadPendingPhotos(payload.billId, list, (ids) => {
      formRef.value?.setPhotoServerIds?.(ids)
    })
    if (serverIds == null) return

    const existingIds = (formRef.value?.images || []).map((img: any) => img.id)
    showSaveLoading('保存中')
    const res = await editTransaction({
      ...payload,
      imageIds: existingIds.concat(serverIds),
    })
    if (res.retCode !== 0) {
      showToast(res.message || '保存失败')
      return
    }
    setLastPref(pref)
    hideSaveLoading()
    showToast('已保存')
    sessionStorage.removeItem('editingRecord')
    router.back()
  } finally {
    hideSaveLoading()
    saving.value = false
  }
}

async function onDelete(id: string) {
  try {
    await showConfirmDialog({ title: '确定删除吗？', message: '删除后无法恢复' })
  } catch {
    return
  }
  const res = await deleteTransaction(id)
  if (res.retCode !== 0) {
    showToast(res.message || '删除失败')
    return
  }
  showToast('已删除')
  sessionStorage.removeItem('editingRecord')
  router.back()
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
