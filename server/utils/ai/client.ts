/**
 * 统一 AI 客户端（Chat Completions 兼容）。
 * 后续新能力应复用本模块的超时 / 错误归类；业务侧只换提示词与结果处理。
 */
import * as AI_CONFIG from '../../config/ai'
import { messageFor, type AiErrorCategory } from './errors'

/** 批量解析默认超时：与现网 / Nginx 对齐为 5 分钟 */
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000

class AiClientError extends Error {
  category: AiErrorCategory
  constructor(category: Exclude<AiErrorCategory, 'none'>, message?: string) {
    super(message || messageFor(category))
    this.name = 'AiClientError'
    this.category = category
  }
}

interface ChatMessage {
  role: string
  content: string
}

interface ChatCompletionsOptions {
  messages: ChatMessage[]
  model?: string
  timeoutMs?: number
  /** 预留：工具型调用，本期可不传 */
  tools?: unknown
  tool_choice?: unknown
}

interface ChatCompletionsResult {
  content: string
  usage: unknown
  raw: unknown
}

/**
 * 调用上游 Chat Completions。
 * 禁止在日志中输出 API Key 或 Authorization。
 */
const chatCompletions = async (options: ChatCompletionsOptions): Promise<ChatCompletionsResult> => {
  if (!AI_CONFIG.apiKey) {
    throw new AiClientError('not_configured')
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  const body: Record<string, unknown> = {
    model: options.model || AI_CONFIG.model,
    messages: options.messages,
    stream: false
  }
  if (options.tools !== undefined) body.tools = options.tools
  if (options.tool_choice !== undefined) body.tool_choice = options.tool_choice

  try {
    const response = await fetch(`${AI_CONFIG.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AI_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      // 仅记录状态码与截断正文，不含密钥
      console.error(`AI 服务请求失败，HTTP 状态码：${response.status}`, errorBody.slice(0, 300))
      throw new AiClientError('upstream_http', messageFor('upstream_http', String(response.status)))
    }

    let result: { choices?: { message?: { content?: string } }[]; usage?: unknown }
    try {
      result = (await response.json()) as typeof result
    } catch {
      throw new AiClientError('upstream_invalid')
    }

    const content = result.choices?.[0]?.message?.content
    if (content === undefined || content === null) {
      throw new AiClientError('upstream_invalid')
    }

    return {
      content: String(content),
      usage: result.usage ?? null,
      raw: result
    }
  } catch (err: unknown) {
    if (err instanceof AiClientError) throw err
    if (err instanceof Error && err.name === 'AbortError') {
      console.error(`AI 服务请求超时（${timeoutMs / 1000}s）`)
      throw new AiClientError('timeout')
    }
    console.error('AI 上游调用失败：', err instanceof Error ? err.message : err)
    throw new AiClientError('upstream_invalid')
  } finally {
    clearTimeout(timeout)
  }
}

export type { ChatCompletionsOptions, ChatCompletionsResult, ChatMessage }
export { AiClientError, DEFAULT_TIMEOUT_MS, chatCompletions }
