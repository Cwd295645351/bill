import type { Row } from '../../types/domain'
import { buildLedger } from './ledger-core'

/** 年度对账。只读记账和概览规则 */
export const getLedger = async (data: Row) => buildLedger(data)
