const DEFAULT_BASE_URL = 'https://api.siliconflow.cn/v1'
const DEFAULT_MODEL = 'Pro/deepseek-ai/DeepSeek-V3.2'

const apiKey = process.env.AI_API_KEY || ''
const baseURL = (process.env.AI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')
const model = process.env.AI_MODEL || DEFAULT_MODEL

export { apiKey, baseURL, model }
