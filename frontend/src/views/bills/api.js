import { BILL } from '@/utils/api-services'

export const getBillList = BILL.get('/list')
export const createBill = BILL.post('/create')
export const deleteBill = BILL.post('/delete')
