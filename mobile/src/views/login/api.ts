import { COMMON } from '@/utils/api-services'

export const getLoginConfig = COMMON.get('/login_config')
export const userLogin = COMMON.post('/login')
