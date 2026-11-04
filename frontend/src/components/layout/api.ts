import { BILL, COMMON } from '@/utils/api-services'

export const joinBill = BILL.post('/join')
export const getBillInfo = BILL.get('')
export const updateProfile = COMMON.put('/profile')
export const changePassword = COMMON.put('/password')
export const getLoginConfig = COMMON.get('/login_config')
export const uploadAvatar = COMMON.post('/avatar', (config) => {
  config.headers = { ...config.headers, 'Content-Type': 'multipart/form-data' }
  return config
})