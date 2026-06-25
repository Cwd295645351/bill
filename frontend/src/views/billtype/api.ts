import { BILLTYPE } from '@/utils/api-services'

export const createCostType = BILLTYPE.post('/costType/create')
export const editCostType = BILLTYPE.put('/costType/edit')
export const deleteCostType = BILLTYPE.post('/costType/delete')

export const createIncomeType = BILLTYPE.post('/incomeType/create')
export const editIncomeType = BILLTYPE.put('/incomeType/edit')
export const deleteIncomeType = BILLTYPE.post('/incomeType/delete')

export const toggleCostTypeShow = BILLTYPE.post('/costType/toggle')
export const toggleIncomeTypeShow = BILLTYPE.post('/incomeType/toggle')
