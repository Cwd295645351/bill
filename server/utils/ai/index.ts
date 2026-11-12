/**
 * 统一 AI 调用底座导出。
 *
 * 扩展约定（SC-005）：
 * - 后续新增 AI 能力时，复用本目录的超时、错误归类、审计与日额度限流；
 * - 业务侧只需注册提示词与结果处理（如 routes 内 buildPrompt / normalize），
 *   不要再复制一套 fetch / 限流 / 审计逻辑。
 */
export { messageFor, AI_ERROR_MESSAGES } from './errors'
export type { AiErrorCategory } from './errors'

export { writeAiAudit } from './audit'
export type { AiAuditEntry } from './audit'

export { acquireDailyQuota, RateLimitUnavailableError, shanghaiDayKey, dailyKey } from './rateLimit'
export type { AcquireDailyQuotaResult } from './rateLimit'

export { chatCompletions, AiClientError, DEFAULT_TIMEOUT_MS } from './client'
export type { ChatCompletionsOptions, ChatCompletionsResult, ChatMessage } from './client'
