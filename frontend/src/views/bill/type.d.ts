import { Bill as BillInfo } from '@/types/bill'

export type Bill = Pick<BillInfo, 'id' | 'name' | 'creator'>
