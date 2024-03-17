import { BILL, BUDGET, TRANSACTION } from '@/utils/api-services'

/** 获取预算列表 */
export const getBudgetListApi = BUDGET.get('/list')

/** 获取当月花费 */
export const getCurrentMonthCostApi = TRANSACTION.get('currentMonthCost')


