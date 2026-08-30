const DEFAULT_BASE_URL = 'https://api.siliconflow.cn/v1'
const DEFAULT_MODEL = 'Pro/deepseek-ai/DeepSeek-V3.2'

module.exports = {
  apiKey: process.env.AI_API_KEY || '',
  baseURL: (process.env.AI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ''),
  model: process.env.AI_MODEL || DEFAULT_MODEL
}
