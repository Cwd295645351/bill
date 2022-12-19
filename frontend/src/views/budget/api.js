import { BUDGET } from '@/utils/api-services'

const service = BUDGET

export const getBudgetList = service.get('/list')
export const addBudget = service.post('/add')
export const editBudget = service.post('/edit')
export const deleteBudget = service.post('/delete')
