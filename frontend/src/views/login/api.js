import { COMMON } from '@/utils/api-services'

export const getLoginConfig = COMMON.get('/getLoginConfig')
export const login = COMMON.post('/login')
