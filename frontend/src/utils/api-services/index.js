import generator from './generator'

export const COMMON = generator('/api/common') // 公共网关
export const BILL = generator('/api/bill') // 账本网关
export const TRANSACTION = generator('/api/transaction') // 交易明细网关
export const BUDGET = generator('/api/budget') // 预算网关
export const OVERVIEW = generator('/api/overview') // 概览网关
