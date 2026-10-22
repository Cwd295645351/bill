import type { Row } from '../../types/domain'
import { getRetirePlan, saveRetirePlan } from '../../database/services/assetRetireService'

export const readRetirePlan = async (data: Row) => getRetirePlan(data)

export const writeRetirePlan = async (data: Row) => saveRetirePlan(data)
