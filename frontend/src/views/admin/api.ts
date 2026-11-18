import { ADMIN } from '@/utils/api-services'

/** 运营总览 */
export const getAdminOverview = ADMIN.get('/overview')
/** 用户列表 */
export const getAdminUsers = ADMIN.get('/users')
/** 用户详情（路径参数 id） */
export const getAdminUserDetail = (id: string) => ADMIN.get(`/users/${encodeURIComponent(id)}`)()
/** 账本列表 */
export const getAdminBills = ADMIN.get('/bills')
/** 账本详情（路径参数 id） */
export const getAdminBillDetail = (id: string) => ADMIN.get(`/bills/${encodeURIComponent(id)}`)()
/** AI 审计列表 */
export const getAdminAiAudits = ADMIN.get('/ai-audits')
/** 默认类型列表 */
export const getCatalogDefaults = ADMIN.get('/catalog-defaults')
/** 新增默认类型 */
export const createCatalogDefault = ADMIN.post('/catalog-defaults')
/** 改名默认类型 */
export const renameCatalogDefault = (kind: string, id: string, name: string) =>
  ADMIN.put(`/catalog-defaults/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`)({ data: { name } })
/** 软删默认类型 */
export const deleteCatalogDefault = (kind: string, id: string) =>
  ADMIN.post(`/catalog-defaults/${encodeURIComponent(kind)}/${encodeURIComponent(id)}/delete`)()
