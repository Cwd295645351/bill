import generator from './src/generator'

import { getConfig } from "@/utils/config"

const version = getConfig().version

export const COMMON = generator(`/api/${version}/common`) // 公共网关
export const BILL = generator(`/api/${version}/bill`) // 账本网关
export const TRANSACTION = generator(`/api/${version}/transaction`) // 交易明细网关
export const BUDGET = generator(`/api/${version}/budget`) // 预算网关
export const OVERVIEW = generator(`/api/${version}/overview`) // 概览网关
export const PLAN = generator(`/api/${version}/plan`) // 计划网关
