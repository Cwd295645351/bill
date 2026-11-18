import type { AiErrorCategory } from './errors'

/** 单次 AI 调用审计字段（禁止含密钥 / 完整 prompt / 响应正文） */
interface AiAuditEntry {
  userId: string
  billId?: string | null
  capability: string
  upstreamRequested: boolean
  outcome: 'success' | 'error'
  errorCategory: AiErrorCategory
  durationMs: number
  usage?: unknown
  dailyCount?: number
}

/** 从上游 usage 提取 token 整数，缺省为空 */
const extractTokenCounts = (usage: unknown) => {
  if (!usage || typeof usage !== 'object') {
    return { promptTokens: null as number | null, completionTokens: null as number | null, totalTokens: null as number | null }
  }
  const row = usage as Record<string, unknown>
  const toInt = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.trunc(n) : null
  }
  return {
    promptTokens: toInt(row.prompt_tokens),
    completionTokens: toInt(row.completion_tokens),
    totalTokens: toInt(row.total_tokens)
  }
}

/**
 * 写入可检索的结构化审计日志，并在有账本时入库。
 * 运维检索前缀：`[ai-audit]`
 */
const writeAiAudit = (entry: AiAuditEntry) => {
  const payload = {
    ts: new Date().toISOString(),
    userId: entry.userId || '',
    billId: entry.billId ?? null,
    capability: entry.capability,
    upstreamRequested: entry.upstreamRequested,
    outcome: entry.outcome,
    errorCategory: entry.errorCategory,
    durationMs: entry.durationMs,
    usage: entry.usage ?? null,
    ...(entry.dailyCount !== undefined ? { dailyCount: entry.dailyCount } : {})
  }
  console.info('[ai-audit]', JSON.stringify(payload))

  const userId = entry.userId || ''
  const billId = entry.billId ? String(entry.billId) : ''
  if (!userId || !billId) return

  const tokens = extractTokenCounts(entry.usage)
  // 延迟加载避免与 database 循环依赖；入库失败不影响业务响应
  void import('../../database/index')
    .then(({ AiCallAudit }) =>
      AiCallAudit.create({
        userId,
        billId,
        capability: entry.capability,
        upstreamRequested: entry.upstreamRequested,
        outcome: entry.outcome,
        errorCategory: entry.errorCategory,
        durationMs: entry.durationMs,
        promptTokens: tokens.promptTokens,
        completionTokens: tokens.completionTokens,
        totalTokens: tokens.totalTokens,
        dailyCount: entry.dailyCount ?? null,
        createdAt: new Date()
      })
    )
    .catch((err: unknown) => {
      console.error('AI 审计入库失败：', err instanceof Error ? err.message : err)
    })
}

export type { AiAuditEntry }
export { writeAiAudit }
