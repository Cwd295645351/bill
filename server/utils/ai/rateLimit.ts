import { client } from '../redis'
import { dailyLimit } from '../../config/ai'

/** Redis 不可用时抛出，供路由失败关闭 */
class RateLimitUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('AI 日额度存储不可用')
    this.name = 'RateLimitUnavailableError'
    if (cause !== undefined) {
      ;(this as Error & { cause?: unknown }).cause = cause
    }
  }
}

/** 东八区自然日 yyyyMMdd */
const shanghaiDayKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}${values.month}${values.day}`
}

/** 距下一东八区 0 点的秒数，至少 48 小时兜底，避免 Key 过早过期 */
const ttlSecondsUntilNextShanghaiMidnight = () => {
  const now = Date.now()
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  const parts = Object.fromEntries(formatter.formatToParts(new Date(now)).map((p) => [p.type, p.value]))
  const hour = Number(parts.hour)
  const minute = Number(parts.minute)
  const second = Number(parts.second)
  const elapsedToday = hour * 3600 + minute * 60 + second
  const untilMidnight = 24 * 3600 - elapsedToday
  const minTtl = 48 * 3600
  return Math.max(untilMidnight > 0 ? untilMidnight : 24 * 3600, minTtl)
}

const dailyKey = (userId: string) => `bill:ai:daily:${userId}:${shanghaiDayKey()}`

type AcquireDailyQuotaResult = { ok: true; count: number } | { ok: false; reason: 'rate_limited' }

/**
 * 占用一次当日 AI 额度（INCR 后超限则 DECR，净不计次）。
 * 并发安全：依赖 Redis 原子 INCR。
 * @throws {RateLimitUnavailableError} Redis 读写失败
 */
const acquireDailyQuota = async (userId: string, limit = dailyLimit): Promise<AcquireDailyQuotaResult> => {
  if (!userId) {
    throw new RateLimitUnavailableError(new Error('userId 为空，无法计量额度'))
  }
  const key = dailyKey(userId)
  try {
    const count = await client.incr(key)
    if (count === 1) {
      await client.expire(key, ttlSecondsUntilNextShanghaiMidnight())
    }
    if (count > limit) {
      await client.decr(key)
      return { ok: false, reason: 'rate_limited' }
    }
    return { ok: true, count }
  } catch (err) {
    throw new RateLimitUnavailableError(err)
  }
}

export type { AcquireDailyQuotaResult }
export { RateLimitUnavailableError, acquireDailyQuota, shanghaiDayKey, dailyKey }
