<template>
  <div class="page bills-page">
    <van-nav-bar title="账本" fixed placeholder />
    <van-pull-refresh v-model="refreshing" class="list-wrap" @refresh="load">
      <div class="page-pad">
        <van-loading v-if="loading && !bills.length" class="center" />
        <van-empty
          v-else-if="!loading && !bills.length"
          description="还没有账本，创建一个或让家人邀请你"
        >
          <van-button size="small" type="primary" color="#4285F4" @click="openCreate">
            新建账本
          </van-button>
        </van-empty>
        <template v-else>
          <van-cell-group inset>
            <template v-for="bill in bills" :key="bill.id">
              <van-swipe-cell v-if="bill.creator === userId" :right-width="72">
                <van-cell :title="bill.name" is-link @click="openBill(bill)" />
                <template #right>
                  <div class="del" @click.stop="onDelete(bill)">删除</div>
                </template>
              </van-swipe-cell>
              <van-cell v-else :title="bill.name" is-link @click="openBill(bill)" />
            </template>
          </van-cell-group>
          <p v-if="error" class="err">{{ error }} <a href="#" @click.prevent="load">重试</a></p>
        </template>
      </div>
    </van-pull-refresh>

    <div class="footer">
      <van-button type="primary" block round color="#4285F4" @click="openCreate">新建账本</van-button>
    </div>

    <van-dialog
      v-model:show="createVisible"
      title="新建账本"
      show-cancel-button
      confirm-button-color="#4285F4"
      :before-close="onCreateBeforeClose"
    >
      <div class="create-body">
        <van-field
          v-model="createName"
          maxlength="10"
          placeholder="3-10个字，中文、字母或数字"
          clearable
        />
      </div>
    </van-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { createBill, deleteBill, getBillList } from '@/api/bill'
import { useSessionStore } from '@/stores/session'
import { useBillContextStore } from '@/stores/bill-context'

const NAME_REG = /^[\u4E00-\u9FA5A-Za-z0-9_]{3,10}$/

const router = useRouter()
const session = useSessionStore()
const billCtx = useBillContextStore()

const bills = ref<any[]>([])
const loading = ref(false)
const refreshing = ref(false)
const error = ref('')
const userId = session.userInfo?.userId || ''

const createVisible = ref(false)
const createName = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await getBillList()
    if (res.retCode === 0 && Array.isArray(res.data)) {
      bills.value = res.data
    } else {
      bills.value = []
      error.value = res.message || '加载失败'
    }
  } catch {
    error.value = '加载失败，请检查网络'
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function openBill(bill: any) {
  billCtx.setCurrentBillId(bill.id, bill.name)
  router.push({ name: 'bill-detail', params: { id: bill.id } })
}

function openCreate() {
  createName.value = ''
  createVisible.value = true
}

async function onCreateBeforeClose(action: string) {
  if (action !== 'confirm') return true
  const name = createName.value.trim()
  if (!NAME_REG.test(name)) {
    showToast('名称需为 3-10 位中文、字母或数字')
    return false
  }
  const ret = await createBill(name)
  if (ret.retCode !== 0) {
    showToast(ret.message || '创建失败')
    return false
  }
  showToast('已创建')
  await load()
  return true
}

async function onDelete(bill: any) {
  try {
    await showConfirmDialog({
      title: '确定删除吗？',
      message: '删除后账本相关数据将无法恢复',
      confirmButtonColor: '#ee0a24',
    })
  } catch {
    return
  }
  const ret = await deleteBill(bill.id)
  if (ret.retCode === 0) {
    showToast('已删除')
    await load()
  } else {
    showToast(ret.message || '删除失败')
  }
}

onMounted(load)
</script>

<style scoped>
.bills-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding-bottom: 0;
}
.list-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-bottom: 80px;
}
.center {
  display: flex;
  justify-content: center;
  padding: 48px 0;
}
.err {
  margin: 16px;
  color: #ee0a24;
  font-size: 13px;
}
.del {
  width: 72px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: #f74f4f;
}
.footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 50px;
  z-index: 10;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);
}
.create-body {
  padding: 12px 16px 8px;
}
</style>
