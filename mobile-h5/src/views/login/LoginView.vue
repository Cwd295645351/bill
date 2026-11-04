<template>
  <div class="login page">
    <div class="login__hero">
      <div class="login__title">记账</div>
      <div class="login__sub muted">使用与电脑端相同的账号密码登录</div>
    </div>
    <van-form @submit="onSubmit">
      <van-cell-group inset>
        <van-field
          v-model="username"
          name="username"
          label="账号"
          placeholder="请输入账号"
          maxlength="20"
          :rules="[{ required: true, message: '请输入账号' }]"
        />
        <van-field
          v-model="password"
          type="password"
          name="password"
          label="密码"
          placeholder="请输入密码"
          maxlength="64"
          :rules="[{ required: true, message: '请输入密码' }]"
        />
      </van-cell-group>
      <div class="login__actions">
        <van-button round block type="primary" native-type="submit" color="#4285F4" :loading="loading">
          登录
        </van-button>
      </div>
    </van-form>
    <p v-if="error" class="login__error">{{ error }}</p>

    <van-popup
      v-model:show="captchaVisible"
      round
      position="center"
      :style="{ width: '92%', maxWidth: '360px', padding: '16px 12px 12px' }"
      :close-on-click-overlay="true"
      @closed="onCaptchaClosed"
    >
      <div class="login__captcha-title">安全验证</div>
      <SliderCaptcha v-if="captchaVisible" ref="captchaRef" @update="onCaptchaUpdate" />
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { getLoginConfig, login } from '@/api/common'
import SliderCaptcha from '@/components/SliderCaptcha.vue'
import { encryptPassword } from '@/utils/rsa'
import { useSessionStore } from '@/stores/session'

const router = useRouter()
const route = useRoute()
const session = useSessionStore()

const username = ref('')
const password = ref('')
const publicKey = ref('')
const loading = ref(false)
const error = ref('')
const captchaVisible = ref(false)
const captchaRef = ref<{ reload: () => void } | null>(null)
const captcha = ref({ captchaId: '', captchaX: 0, ready: false })

function onCaptchaUpdate(payload: { captchaId: string; captchaX: number; ready: boolean }) {
  captcha.value = payload
  if (payload.ready && captchaVisible.value && !loading.value) {
    void doLogin()
  }
}

function onCaptchaClosed() {
  captcha.value = { captchaId: '', captchaX: 0, ready: false }
}

async function loadConfig() {
  try {
    const res = await getLoginConfig()
    if (res.retCode === 0 && res.data?.publicKey) {
      publicKey.value = res.data.publicKey
    } else {
      error.value = res.message || '获取登录配置失败'
    }
  } catch {
    error.value = '获取登录配置失败'
  }
}

async function doLogin() {
  if (loading.value) return
  if (!captcha.value.ready || !captcha.value.captchaId) return
  error.value = ''
  loading.value = true
  try {
    const res = await login({
      username: username.value.trim(),
      password: encryptPassword(password.value, publicKey.value),
      captchaId: captcha.value.captchaId,
      captchaX: captcha.value.captchaX,
    })
    if (res.retCode !== 0 || !res.data) {
      error.value = res.message || '登录失败'
      showToast(error.value)
      captchaRef.value?.reload()
      return
    }
    captchaVisible.value = false
    session.setSession(res.data)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
      await router.replace(redirect)
    } else {
      await router.replace({ name: 'bills' })
    }
  } catch (e: any) {
    error.value = e?.message || '登录失败'
    showToast(error.value)
    captchaRef.value?.reload()
  } finally {
    loading.value = false
  }
}

async function onSubmit() {
  error.value = ''
  if (!publicKey.value) {
    await loadConfig()
    if (!publicKey.value) {
      showToast('无法获取登录配置')
      return
    }
  }
  captcha.value = { captchaId: '', captchaX: 0, ready: false }
  captchaVisible.value = true
}

onMounted(loadConfig)
</script>

<style scoped>
.login {
  padding: 48px 0 24px;
}
.login__hero {
  padding: 0 28px 28px;
}
.login__title {
  font-size: 28px;
  font-weight: 600;
  color: #4285f4;
}
.login__sub {
  margin-top: 8px;
}
.login__actions {
  margin: 24px 16px 0;
}
.login__error {
  margin: 16px 28px 0;
  color: #ee0a24;
  font-size: 13px;
}
.login__captcha-title {
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #323233;
}
</style>