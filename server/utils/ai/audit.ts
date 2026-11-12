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

/**
 * 写入可检索的结构化审计日志。
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
}

export type { AiAuditEntry }
export { writeAiAudit }
