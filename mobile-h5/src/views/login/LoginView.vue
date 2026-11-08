<template>
  <div class="login page">
    <div class="login__hero">
      <div class="login__title">记账</div>
      <div class="login__sub muted">
        {{ mode === 'register' ? '注册账号后即可登录记账' : '使用账号密码登录，也可在本页注册新账号' }}
      </div>
    </div>
    <van-form @submit="onSubmit">
      <van-cell-group inset>
        <van-field
          v-model="username"
          name="username"
          label="账号"
          :placeholder="mode === 'register' ? '英文与数字，3～20 位' : '请输入账号'"
          maxlength="20"
          :rules="[{ required: true, message: '请输入账号' }]"
        />
        <van-field
          v-if="mode === 'register'"
          v-model="nickName"
          name="nickName"
          label="昵称"
          placeholder="选填，默认与账号相同"
          maxlength="20"
        />
        <van-field
          v-model="password"
          type="password"
          name="password"
          label="密码"
          :placeholder="mode === 'register' ? '至少 8 位，含大小写与数字' : '请输入密码'"
          maxlength="64"
          :rules="[{ required: true, message: '请输入密码' }]"
        />
      </van-cell-group>
      <div class="login__switch">
        <template v-if="mode === 'register'">
          <span class="muted">已有账号？</span>
          <button type="button" class="login__link" @click="switchMode('login')">返回登录</button>
        </template>
        <template v-else>
          <span class="muted">还没有账号？</span>
          <button type="button" class="login__link" @click="switchMode('register')">注册账号</button>
        </template>
      </div>
      <div class="login__actions">
        <van-button round block type="primary" native-type="submit" color="#4285F4" :loading="loading">
          {{ mode === 'register' ? '注册' : '登录' }}
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
import { getLoginConfig, login, register } from '@/api/common'
import SliderCaptcha from '@/components/SliderCaptcha.vue'
import { encryptPassword } from '@/utils/rsa'
import { useSessionStore } from '@/stores/session'

type Mode = 'login' | 'register'

const router = useRouter()
const route = useRoute()
const session = useSessionStore()

const mode = ref<Mode>('login')
const username = ref('')
const nickName = ref('')
const password = ref('')
const publicKey = ref('')
const loading = ref(false)
const error = ref('')
const captchaVisible = ref(false)
const captchaRef = ref<{ reload: () => void } | null>(null)
const captcha = ref({ captchaId: '', captchaX: 0, ready: false })
const pendingAction = ref<Mode | null>(null)

function switchMode(next: Mode) {
  mode.value = next
  error.value = ''
  nickName.value = ''
  captchaVisible.value = false
  pendingAction.value = null
  captcha.value = { captchaId: '', captchaX: 0, ready: false }
}

function onCaptchaUpdate(payload: { captchaId: string; captchaX: number; ready: boolean }) {
  captcha.value = payload
  if (!payload.ready || !captchaVisible.value || loading.value) return
  if (pendingAction.value === 'login') {
    void doLogin()
  } else if (pendingAction.value === 'register') {
    void doRegister()
  }
}

function onCaptchaClosed() {
  captcha.value = { captchaId: '', captchaX: 0, ready: false }
  pendingAction.value = null
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

/** 与电脑端注册规则对齐的客户端预检 */
function validateRegisterForm(): string | null {
  const name = username.value.trim()
  if (!/^[A-Za-z0-9]{3,20}$/.test(name)) {
    return '用户名为 3～20 位英文字母或数字'
  }
  const pwd = password.value
  if (pwd.length < 8) return '密码至少 8 位'
  if (!/[a-z]/.test(pwd)) return '密码必须包含小写字母'
  if (!/[A-Z]/.test(pwd)) return '密码必须包含大写字母'
  if (!/\d/.test(pwd)) return '密码必须包含数字'
  return null
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
    pendingAction.value = null
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

async function doRegister() {
  if (loading.value) return
  if (!captcha.value.ready || !captcha.value.captchaId) return
  error.value = ''
  loading.value = true
  try {
    const name = username.value.trim()
    const res = await register({
      username: name,
      password: encryptPassword(password.value, publicKey.value),
      nickName: (nickName.value || '').trim() || name,
      captchaId: captcha.value.captchaId,
      captchaX: captcha.value.captchaX,
    })
    if (res.retCode !== 0) {
      error.value = res.message || '注册失败'
      showToast(error.value)
      captchaRef.value?.reload()
      return
    }
    captchaVisible.value = false
    pendingAction.value = null
    password.value = ''
    nickName.value = ''
    mode.value = 'login'
    showToast('注册成功，请登录')
  } catch (e: any) {
    error.value = e?.message || '注册失败'
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
  if (mode.value === 'register') {
    const formErr = validateRegisterForm()
    if (formErr) {
      error.value = formErr
      showToast(formErr)
      return
    }
  } else {
    const name = username.value.trim()
    if (!name || !password.value) {
      showToast('请输入账号和密码')
      return
    }
  }
  captcha.value = { captchaId: '', captchaX: 0, ready: false }
  pendingAction.value = mode.value
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
.login__switch {
  margin: 16px 28px 0;
  font-size: 14px;
}
.login__link {
  margin-left: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #4285f4;
  font-size: 14px;
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
