import { computed, onMounted, ref } from 'vue'
import router from '@/router'
import { useRoute } from 'vue-router'
import { sanitizeRedirect } from '@/router/helpers'
import { KEYUTIL, KJUR, hextob64 } from 'jsrsasign'

import { userLogin, userRegister, getLoginConfig } from '../api'

import type { Status, FormInfo } from '../type'

export type CaptchaPayload = { captchaId: string; captchaX: number; ready: boolean }

export const useLogin = () => {
  const route = useRoute()
  const operationDisabled = false
  /** 表单状态 */
  const status = ref<Status>('login')
  /** 公钥 */
  const publicKey = ref('')
  const $loginForm = ref()

  /** 表单标题 */
  const title = computed(() => {
    switch (status.value) {
      case 'register':
        return '注册账号'
      default:
        return '账号登录'
    }
  })

  /** 表单信息 */
  const formInfo = ref<FormInfo>({
    username: '',
    password: '',
    nickName: '',
  })

  const captcha = ref<{ captchaId: string; captchaX: number; ready: boolean }>({ captchaId: '', captchaX: 0, ready: false })
  const captchaRef = ref<{ reload: () => void } | null>(null)
  const captchaVisible = ref(false)
  const pendingAction = ref<'login' | 'register' | null>(null)
  const submitting = ref(false)

  const onCaptchaUpdate = (payload: { captchaId: string; captchaX: number; ready: boolean }) => {
    captcha.value = payload
    if (!payload.ready || !captchaVisible.value || submitting.value) return
    if (pendingAction.value === 'login') {
      void submitLogin()
    } else if (pendingAction.value === 'register') {
      void submitRegister()
    }
  }

  const openCaptcha = (action: 'login' | 'register') => {
    captcha.value = { captchaId: '', captchaX: 0, ready: false }
    pendingAction.value = action
    captchaVisible.value = true
  }

  const closeCaptcha = () => {
    captchaVisible.value = false
    pendingAction.value = null
    captcha.value = { captchaId: '', captchaX: 0, ready: false }
  }

  const onCaptchaDialogClosed = () => {
    pendingAction.value = null
    captcha.value = { captchaId: '', captchaX: 0, ready: false }
  }

  /** 切换到注册 */
  const registerUser = () => {
    closeCaptcha()
    status.value = 'register'
    formInfo.value.nickName = ''
  }

  /** 返回登录 */
  const backToLogin = () => {
    closeCaptcha()
    status.value = 'login'
    formInfo.value.nickName = ''
  }

  /** 忘记密码 */
  const forgetPassword = () => {
    console.log('忘记密码')
  }

  /** 密码加密 */
  const encryptPassword = (password: string) => {
    const pub: any = KEYUTIL.getKey(publicKey.value)
    const encryptData = KJUR.crypto.Cipher.encrypt(password, pub, 'RSA')
    return hextob64(encryptData)
  }

  const submitRegister = async () => {
    if (submitting.value) return
    if (!captcha.value.ready || !captcha.value.captchaId) return
    submitting.value = true
    try {
      const password = formInfo.value.password
      const data = {
        username: formInfo.value.username,
        password: encryptPassword(password),
        nickName: formInfo.value.nickName || formInfo.value.username,
        captchaId: captcha.value.captchaId,
        captchaX: captcha.value.captchaX,
      }
      const [err, res] = await userRegister({ data })
      if (err) {
        captchaRef.value?.reload()
        return
      }
      if (res.retCode === 0) {
        ElMessage.success('注册成功，请登录')
        closeCaptcha()
        status.value = 'login'
        formInfo.value.password = ''
        formInfo.value.nickName = ''
      } else {
        ElMessage.error('注册失败，' + res.message)
        captchaRef.value?.reload()
      }
    } finally {
      submitting.value = false
    }
  }

  /** 注册：先校验表单，再弹滑块 */
  const register = async () => {
    $loginForm.value.validate(async (valid: boolean) => {
      if (!valid) return false
      openCaptcha('register')
    })
  }

  const submitLogin = async () => {
    if (submitting.value) return
    if (!captcha.value.ready || !captcha.value.captchaId) return
    submitting.value = true
    try {
      const password = formInfo.value.password
      const data = {
        username: formInfo.value.username,
        password: encryptPassword(password),
        captchaId: captcha.value.captchaId,
        captchaX: captcha.value.captchaX,
      }
      const [err, res] = await userLogin({ data })
      if (err) {
        captchaRef.value?.reload()
        return
      }
      if (res.retCode === 0) {
        const data = res.data
        const expiresAt = new Date().getTime() + data.expiresIn * 1000
        const userInfo = {
          ...data.userInfo,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          userId: data.userInfo.id,
        }
        sessionStorage.setItem('expiresAt', expiresAt.toString())
        sessionStorage.setItem('userInfo', JSON.stringify(userInfo))
        closeCaptcha()
        const redirect = sanitizeRedirect(route.query.redirect)
        router.push(redirect || '/layout/bill')
      } else {
        ElMessage.error('登录失败，' + res.message)
        captchaRef.value?.reload()
      }
    } finally {
      submitting.value = false
    }
  }

  // 登录：先校验表单，再弹滑块
  const login = async () => {
    $loginForm.value.validate(async (valid: boolean) => {
      if (!valid) return false
      openCaptcha('login')
    })
  }

  /** 获取登录配置 */
  const getConfig = async () => {
    const [err, res] = await getLoginConfig()
    if (err) return
    if (res.retCode === 0) {
      publicKey.value = res.data.publicKey
    } else {
      ElMessage.error('获取登录配置失败，' + res.data)
    }
  }

  onMounted(getConfig)

  return {
    operationDisabled,
    status,
    title,
    $loginForm,
    formInfo,
    registerUser,
    backToLogin,
    forgetPassword,
    register,
    login,
    getConfig,
    captchaRef,
    onCaptchaUpdate,
    captchaVisible,
    onCaptchaDialogClosed,
  }
}