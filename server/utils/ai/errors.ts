/** AI 统一错误类别（与 data-model / 审计 errorCategory 对齐） */
type AiErrorCategory =
  | 'not_configured'
  | 'rate_limited'
  | 'rate_limit_unavailable'
  | 'timeout'
  | 'upstream_http'
  | 'upstream_invalid'
  | 'forbidden_bill'
  | 'none'

/** 用户可见中文文案（勿包含密钥或上游原文） */
const AI_ERROR_MESSAGES: Record<Exclude<AiErrorCategory, 'none'>, string> = {
  not_configured: 'AI 服务未配置，请联系管理员',
  rate_limited: 'AI 调用过于频繁，请稍后再试或明天再试',
  rate_limit_unavailable: '服务繁忙，请稍后再试',
  timeout: 'AI 服务请求超时，请稍后重试',
  upstream_http: 'AI 服务请求失败，请稍后重试',
  upstream_invalid: 'AI 解析失败，请稍后重试',
  forbidden_bill: '无权访问该账本'
}

/** 取某错误类别的用户可见文案 */
const messageFor = (category: Exclude<AiErrorCategory, 'none'>, detail?: string) => {
  if (category === 'upstream_http' && detail) {
    return `AI 服务请求失败（${detail}）`
  }
  return AI_ERROR_MESSAGES[category]
}

export type { AiErrorCategory }
export { AI_ERROR_MESSAGES, messageFor }
