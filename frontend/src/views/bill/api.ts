import { BILL } from '@/utils/api-services'

export const getBillList = BILL.get('/list')
export const createBill = BILL.post('')
export const deleteBill = BILL.delete('')
export const shareBill = BILL.post('/invite')
