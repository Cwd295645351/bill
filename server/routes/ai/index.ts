import { readBody, queryString, type HttpContext } from '../../types/domain'
import KoaRouter from 'koa-router'
import { ResModel } from '../../model/resModel'
import { parseBatch } from './controller'
import VERSION from '../../config/version'
import { BillUser } from '../../database'
import * as AI_CONFIG from '../../config/ai'
import {
  acquireDailyQuota,
  messageFor,
  RateLimitUnavailableError,
  writeAiAudit,
  type AiErrorCategory
} from '../../utils/ai'

const router = new KoaRouter({ prefix: `/api/${VERSION}/ai` })

const MAX_TEXT_LENGTH = 20000
const MAX_LINE_COUNT = 100
const MAX_LINE_LENGTH = 500
const MAX_COST_TYPE_COUNT = 200
const MAX_COST_TYPE_LENGTH = 100

/**
 * 批量解析支出记录。
 * 编排顺序（不得颠倒）：① 输入校验 → ② 可选 billId 成员校验 → ③ 未配置检测
 * → ④ Redis 日额度占用（含不可用失败关闭）→ ⑤ 上游调用 → ⑥ 审计
 */
router.post('/parse-batch', async (ctx: HttpContext) => {
  const started = Date.now()
  const userId = queryString(ctx.header.userid) || ''
  const body = readBody(ctx) || {}
  const { text, costTypes, billId: rawBillId } = body
  const billId =
    rawBillId === undefined || rawBillId === null || rawBillId === '' ? null : String(rawBillId)

  const durationMs = () => Date.now() - started
  const audit = (fields: {
    upstreamRequested: boolean
    outcome: 'success' | 'error'
    errorCategory: AiErrorCategory
    usage?: unknown
    dailyCount?: number
  }) => {
    writeAiAudit({
      userId,
      billId,
      capability: 'parse-batch',
      durationMs: durationMs(),
      ...fields
    })
  }

  // ① 输入校验（不计次、可不打审计）
  if (typeof text !== 'string' || !text.trim()) {
    ctx.body = new ResModel(null, '解析内容不能为空', 'error')
    return
  }
  if (text.length > MAX_TEXT_LENGTH) {
    ctx.body = new ResModel(null, `解析内容不能超过 ${MAX_TEXT_LENGTH} 个字符`, 'error')
    return
  }
  if (!Array.isArray(costTypes) || costTypes.length === 0) {
    ctx.body = new ResModel(null, '支出类型不能为空', 'error')
    return
  }
  if (costTypes.length > MAX_COST_TYPE_COUNT) {
    ctx.body = new ResModel(null, `支出类型不能超过 ${MAX_COST_TYPE_COUNT} 项`, 'error')
    return
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length > MAX_LINE_COUNT) {
    ctx.body = new ResModel(null, `每次最多解析 ${MAX_LINE_COUNT} 条记录`, 'error')
    return
  }
  if (lines.some((line) => line.length > MAX_LINE_LENGTH)) {
    ctx.body = new ResModel(null, `每条记录不能超过 ${MAX_LINE_LENGTH} 个字符`, 'error')
    return
  }

  const normalizedCostTypes = costTypes
    .filter((item) => item && !item.hidden && item.id !== undefined && typeof item.name === 'string')
    .map((item) => ({ id: String(item.id), name: (item.name || '').trim() }))
    .filter((item) => item.name)
  if (normalizedCostTypes.length === 0) {
    ctx.body = new ResModel(null, '没有可用的支出类型', 'error')
    return
  }
  if (normalizedCostTypes.some((item) => String(item.id).length > MAX_COST_TYPE_LENGTH || item.name.length > MAX_COST_TYPE_LENGTH)) {
    ctx.body = new ResModel(null, `支出类型 ID 和名称不能超过 ${MAX_COST_TYPE_LENGTH} 个字符`, 'error')
    return
  }

  // ② 可选 billId 成员校验
  if (billId) {
    if (!userId) {
      audit({ upstreamRequested: false, outcome: 'error', errorCategory: 'forbidden_bill' })
      ctx.body = new ResModel(null, messageFor('forbidden_bill'), 'error')
      return
    }
    const member = await BillUser.findOne({ where: { billId, userId } })
    if (!member) {
      audit({ upstreamRequested: false, outcome: 'error', errorCategory: 'forbidden_bill' })
      ctx.body = new ResModel(null, messageFor('forbidden_bill'), 'error')
      return
    }
  }

  // ③ 未配置检测（不计次、不打上游）
  if (!AI_CONFIG.apiKey) {
    audit({ upstreamRequested: false, outcome: 'error', errorCategory: 'not_configured' })
    ctx.body = new ResModel(null, messageFor('not_configured'), 'error')
    return
  }

  // ④ Redis 日额度占用（每次请求计 1 次；不可用则失败关闭）
  if (!userId) {
    ctx.body = new ResModel(null, '请先登录', 'error')
    return
  }
  let dailyCount: number | undefined
  try {
    const acquired = await acquireDailyQuota(userId)
    if (!acquired.ok) {
      audit({ upstreamRequested: false, outcome: 'error', errorCategory: 'rate_limited' })
      ctx.body = new ResModel(null, messageFor('rate_limited'), 'error')
      return
    }
    dailyCount = acquired.count
  } catch (err) {
    if (err instanceof RateLimitUnavailableError) {
      console.error('AI 日额度存储不可用：', err.message)
      audit({ upstreamRequested: false, outcome: 'error', errorCategory: 'rate_limit_unavailable' })
      ctx.body = new ResModel(null, messageFor('rate_limit_unavailable'), 'error')
      return
    }
    throw err
  }

  // ⑤ 上游调用（经 AiClient）
  const outcome = await parseBatch(lines, normalizedCostTypes)

  // ⑥ 审计
  if (outcome.ok) {
    audit({
      upstreamRequested: true,
      outcome: 'success',
      errorCategory: 'none',
      usage: outcome.usage,
      dailyCount
    })
    ctx.body = new ResModel(outcome.data, '批量解析成功')
    return
  }

  audit({
    upstreamRequested: outcome.upstreamRequested,
    outcome: 'error',
    errorCategory: outcome.errorCategory,
    usage: outcome.usage,
    dailyCount
  })
  ctx.body = new ResModel(null, outcome.message, 'error')
})

export default router
