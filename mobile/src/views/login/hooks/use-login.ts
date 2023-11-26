import { onMounted, ref } from 'vue'
import { showFailToast, showLoadingToast, closeToast } from 'vant'
import router from '@/router'
import { KEYUTIL, KJUR, hextob64 } from 'jsrsasign'

import { userLogin, getLoginConfig } from '../api'

import type { Status, FormInfo } from '../type'

export const useLogin = () => {
  /** 公钥 */
  const publicKey = ref('')

  /** 表单信息 */
  const formInfo = ref<FormInfo>({
    username: '',
    password: '',
  })

  /** 校验规则 */
  const rules = {
    username: (val: string) => /^[A-Za-z\d]+$/.test(val),
    password: (val: string) => /^[A-Za-z_\d]+$/.test(val),
  }

  /** 密码加密 */
  const encryptPassword = (password: string) => {
    const pub: any = KEYUTIL.getKey(publicKey.value)
    const encryptData = KJUR.crypto.Cipher.encrypt(password, pub, 'RSA')
    return hextob64(encryptData)
  }

  /** 登录 */
  const onSubmit = async (values: { username: string; password: string }) => {
    console.log('submit', values)
    const password = values.password
    const data = {
      username: values.username,
      password: encryptPassword(password),
    }
    showLoadingToast({
      message: '登录中...',
      forbidClick: true,
    })
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
        userId: data.userInfo._id,
      }
      sessionStorage.setItem('expiresAt', expiresAt.toString())
      sessionStorage.setItem('userInfo', JSON.stringify(userInfo))
      closeToast()
      // router.push('/layout/bill')
    } else {
      showFailToast('登录失败，' + res.message)
    }
  }

  /** 获取登录配置 */
  const getConfig = async () => {
    const [err, res] = await getLoginConfig()
    if (err) return
    if (res.retCode === 0) {
      publicKey.value = res.data.publicKey
    } else {
      showFailToast('获取登录配置失败，' + res.data)
    }
  }

  onMounted(getConfig)

  return { formInfo, rules, getConfig, onSubmit }
}
