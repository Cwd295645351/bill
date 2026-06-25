import { computed, onMounted, ref } from 'vue'
import router from '@/router'
import { KEYUTIL, KJUR, hextob64 } from 'jsrsasign'

import { userLogin, userRegister, getLoginConfig } from '../api'

import type { Status, FormInfo } from '../type'

export const useLogin = () => {
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

  /** 切换到注册 */
  const registerUser = () => {
    status.value = 'register'
    formInfo.value.nickName = ''
  }

  /** 返回登录 */
  const backToLogin = () => {
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

  /** 注册 */
  const register = async () => {
    $loginForm.value.validate(async (valid: boolean) => {
      if (valid) {
        const password = formInfo.value.password
        const data = {
          username: formInfo.value.username,
          password: encryptPassword(password),
          nickName: formInfo.value.nickName || formInfo.value.username,
        }
        const [err, res] = await userRegister({ data })
        if (err) return
        if (res.retCode === 0) {
          ElMessage.success('注册成功，请登录')
          status.value = 'login'
          formInfo.value.password = ''
          formInfo.value.nickName = ''
        } else {
          ElMessage.error('注册失败，' + res.message)
        }
      } else {
        console.log('error submit!!')
        return false
      }
    })
  }

  // 登录
  const login = async () => {
    $loginForm.value.validate(async (valid: boolean) => {
      if (valid) {
        console.log('校验通过')
        const password = formInfo.value.password
        const data = {
          username: formInfo.value.username,
          password: encryptPassword(password),
        }
        const [err, res] = await userLogin({ data })
        if (err) return
        if (res.retCode === 0) {
          console.log(res.data)
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
          router.push('/layout/bill')
        } else {
          ElMessage.error('登录失败，' + res.message)
        }
      } else {
        console.log('error submit!!')
        return false
      }
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

  return { operationDisabled, status, title, $loginForm, formInfo, registerUser, backToLogin, forgetPassword, register, login, getConfig }
}
