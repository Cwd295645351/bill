import { AI, TRANSACTION } from '@/utils/api-services'

export const getRecordList = TRANSACTION.post('list') // 查询列表
export const addTransaction = TRANSACTION.post('') // 新增交易明细
export const batchAddTransaction = TRANSACTION.post('batch') // 批量新增交易明细
export const editTransaction = TRANSACTION.put('') // 编辑交易明细
export const deleteTransaction = TRANSACTION.delete('') // 删除交易明细
export const parseBatchTransactions = AI.post('parse-batch') // 批量 AI 解析

// 导出交易明细
export const exportData = TRANSACTION.post('export', (config) => {
  config.responseType = 'blob'
  return config
})
