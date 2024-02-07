import { BILL } from '@/utils/api-services'

export const billListApi = BILL.get('/list')
export const createBillApi = BILL.post('')
export const deleteBillApi = BILL.delete('')
export const shareBillApi = BILL.post('/invite')
