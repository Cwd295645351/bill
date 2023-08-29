import { PLAN } from "@/utils/api-services";

const service = PLAN

/** 查询计划列表 */
export const getPlanList = service.get('/list')
/** 新增计划 */
export const planAdd = service.post('/')
/** 编辑计划 */
export const planEdit = service.put('/')
/** 删除计划 */
export const planDelete = service.delete('/')