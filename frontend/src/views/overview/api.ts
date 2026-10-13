import { OVERVIEW } from '@/utils/api-services'

const service = OVERVIEW

// 查询收支和各归属人概况
export const getBalance = service.get('/balance')

// 查询过去三年的支出类型
export const getThreeYearCost = service.get('/threeYearCost')

// 多人分账。总支出等汇总仍走 getBalance
export const getSettlement = service.post('/settlement')
