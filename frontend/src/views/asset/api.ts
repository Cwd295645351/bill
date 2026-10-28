import { ASSET } from '@/utils/api-services'

const service = ASSET

/** 资产成员 */
export const getMembers = service.get('/members')
export const addMember = service.post('/member')
export const editMember = service.put('/member')
export const delMember = service.delete('/member')

/** 资产登记与列表 */
export const getAssetList = service.get('/list')
export const getAssetListStats = service.get('/list-stats')
export const addAsset = service.post('/')
export const editAsset = service.put('/')
export const delAsset = service.delete('/')

/** 盘点记录 */
export const addRecord = service.post('/record')
export const getRecords = service.get('/records')
export const editRecord = service.put('/record')
export const delRecord = service.delete('/record')

/** 汇总、构成、四笔钱、月历 */
export const getOverview = service.get('/overview')
export const getSankey = service.get('/sankey')
export const getFourMoney = service.get('/four-money')
export const getMonthlyReport = service.get('/monthly-report')
export const getAssetTrend = service.get('/trend')

/** 汇率、年度对账、养老计划 */
export const getExchangeRate = service.get('/exchange-rate')
export const saveExchangeRate = service.put('/exchange-rate')
export const getLedger = service.post('/ledger')
export const getRetirePlan = service.get('/retire-plan')
export const saveRetirePlan = service.put('/retire-plan')
