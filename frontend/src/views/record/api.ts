import { TRANSACTION } from '@/utils/api-services'

export const getRecordList = TRANSACTION.get('list') // 查询列表
export const addTransaction = TRANSACTION.post('') // 新增交易明细
export const editTransaction = TRANSACTION.put('') // 编辑交易明细
export const deleteTransaction = TRANSACTION.delete('') // 删除交易明细

// 导出交易明细
export const exportData = TRANSACTION.post('export', (config) => {
  config.responseType = 'blob'
  return config
})
