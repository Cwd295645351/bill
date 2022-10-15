import { TRANSACTION } from '@/utils/api-services'

export const getList = TRANSACTION.get('list') // 查询列表
export const addTransaction = TRANSACTION.post('add') // 新增交易明细
export const editTransaction = TRANSACTION.post('edit') // 编辑交易明细
export const deleteTransaction = TRANSACTION.post('delete') // 删除交易明细
