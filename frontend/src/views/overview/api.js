import { OVERVIEW } from '@/utils/api-services'

const service = OVERVIEW

export const getBalance = service.get('/balance')