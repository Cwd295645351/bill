<template>
  <div class="page">
    <van-nav-bar title="加入账本" left-arrow fixed placeholder @click-left="goBack" />
    <div class="page-pad">
      <van-cell-group inset>
        <van-field v-model="code" label="邀请码" placeholder="请输入邀请码" clearable />
        <van-field v-if="name" v-model="name" label="账本" readonly />
      </van-cell-group>
      <div class="actions">
        <van-button block round type="primary" color="#4285F4" :loading="loading" @click="doJoin">
          加入
        </van-button>
      </div>
      <p v-if="message" class="msg" :class="{ ok: joined }">{{ message }}</p>
      <van-button v-if="joined" block round plain type="primary" class="mt" @click="goBills">
        查看账本
      </van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { joinBill } from '@/api/bill'

const route = useRoute()
const router = useRouter()

const code = ref('')
const name = ref('')
const message = ref('')
const joined = ref(false)
const loading = ref(false)
const autoTried = ref(false)

function goBack() {
  if (window.history.length > 1) router.back()
  else router.replace({ name: 'mine' })
}

function goBills() {
  router.replace({ name: 'bills' })
}

/** Map backend/raw join errors to user-facing invite-code copy. */
function mapJoinError(raw: string): string {
  const text = (raw || '').trim()
  if (!text) return '加入失败'
  if (text.includes('失效')) return '邀请码已失效，请让对方重新分享'
  if (text.includes('密钥') || text.includes('不正确') || text.includes('无效') || text.includes('不存在')) {
    return '邀请码不正确'
  }
  return text
}

async function doJoin() {
  const value = code.value.trim()
  if (!value) {
    showToast('邀请码不能为空')
    return
  }
  loading.value = true
  message.value = ''
  try {
    const res = await joinBill(value)
    if (res.retCode === 0) {
      joined.value = true
      message.value = '已加入账本'
      showToast('已加入账本')
      return
    }
    message.value = mapJoinError(res.message || '加入失败')
    showToast(message.value)
  } catch (err: any) {
    const raw = err?.response?.data?.message || err?.message || '加入失败'
    message.value = mapJoinError(String(raw))
    showToast(message.value)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (typeof route.query.code === 'string' && route.query.code) {
    code.value = decodeURIComponent(route.query.code)
  }
  if (typeof route.query.name === 'string' && route.query.name) {
    name.value = decodeURIComponent(route.query.name)
  }
  if (code.value && !autoTried.value) {
    autoTried.value = true
    doJoin()
  }
})
</script>

<style scoped>
.actions {
  margin-top: 24px;
}
.msg {
  margin-top: 16px;
  text-align: center;
  color: #ee0a24;
  font-size: 14px;
}
.msg.ok {
  color: #07c160;
}
.mt {
  margin-top: 12px;
}
</style>