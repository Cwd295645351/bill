const DEFAULT_BASE_URL = 'https://api.siliconflow.cn/v1'
const DEFAULT_MODEL = 'Pro/deepseek-ai/DeepSeek-V3.2'
const DEFAULT_DAILY_LIMIT = 60

const apiKey = process.env.AI_API_KEY || ''
const baseURL = (process.env.AI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')
const model = process.env.AI_MODEL || DEFAULT_MODEL

/** 每用户东八区自然日 AI 调用上限，可用 AI_DAILY_LIMIT 覆盖 */
const parsedDailyLimit = Number.parseInt(process.env.AI_DAILY_LIMIT || '', 10)
const dailyLimit =
  Number.isFinite(parsedDailyLimit) && parsedDailyLimit > 0 ? parsedDailyLimit : DEFAULT_DAILY_LIMIT

export { apiKey, baseURL, model, dailyLimit, DEFAULT_DAILY_LIMIT }
