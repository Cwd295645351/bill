<template>
  <div class="page">
    <van-nav-bar title="我的" fixed placeholder />
    <div class="profile">
      <div class="avatar">{{ avatarText }}</div>
      <div class="name">{{ nickName }}</div>
      <div class="muted">账号登录 · 与电脑端同一账号</div>
    </div>

    <van-cell-group inset>
      <van-cell title="总收入" :value="incomes" value-class="income" />
      <van-cell title="总支出" :value="expenses" value-class="cost" />
    </van-cell-group>

    <van-cell-group inset class="mt">
      <van-cell title="通过邀请码加入" is-link @click="goJoin" />
      <van-cell title="退出登录" is-link @click="onLogout" />
    </van-cell-group>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { logout } from '@/api/common'
import { useSessionStore } from '@/stores/session'
import { useBillContextStore } from '@/stores/bill-context'
import { moneyText } from '@/utils/date'

const router = useRouter()
const session = useSessionStore()
const billCtx = useBillContextStore()

const nickName = computed(() => session.userInfo?.nickName || '未命名')
const avatarText = computed(() => nickName.value.slice(0, 1))
const incomes = computed(() => moneyText(session.userInfo?.incomes))
const expenses = computed(() => moneyText(session.userInfo?.expenses))

function goJoin() {
  router.push({ name: 'join' })
}

async function onLogout() {
  try {
    await showConfirmDialog({ title: '退出登录', message: '退出后需要重新登录才能查看账本' })
  } catch {
    return
  }
  try {
    await logout()
  } catch {
    /* ignore */
  }
  session.clearSession()
  billCtx.clearBillContext()
  showToast('已退出')
  router.replace({ name: 'login' })
}
</script>

<style scoped>
.profile {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28px 16px 20px;
}
.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #4285f4;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}
.name {
  margin-top: 12px;
  font-size: 18px;
  font-weight: 600;
}
.mt {
  margin-top: 12px;
}
:deep(.income) {
  color: #07c160;
}
:deep(.cost) {
  color: #f74f4f;
}
</style>
