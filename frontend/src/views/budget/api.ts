import { BUDGET } from '@/utils/api-services'

const service = BUDGET

export const getBudgetList = service.get('/list')
export const budgetAdd = service.post('')
export const budgetEdit = service.put('')
export const budgetDelete = service.delete('')
