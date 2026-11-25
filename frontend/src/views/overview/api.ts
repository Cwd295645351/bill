import { OVERVIEW } from '@/utils/api-services'

const service = OVERVIEW

// 查询收支和各归属人概况
export const getBalance = service.get('/balance')

// 查询近五年的收支趋势（原 threeYearCost 兼容路径）
export const getThreeYearCost = service.get('/threeYearCost')

// 多人分账。总支出等汇总仍走 getBalance
export const getSettlement = service.post('/settlement')

/** 点开某一支出分类的原始记账。手机概览与电脑概览共用 */
export const getCategoryRecords = service.get('/records')
