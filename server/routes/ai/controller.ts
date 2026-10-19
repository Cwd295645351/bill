import type { Row } from '../../types/domain'
import * as AI_CONFIG from '../../config/ai'

/** 批量解析可能含多行文本，与 Nginx proxy_read_timeout 对齐为 5 分钟 */
const REQUEST_TIMEOUT = 5 * 60 * 1000

/** 获取东八区当前日期 */
const getCurrentDate = () => {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

/** 判断是否为真实存在的 YYYY-MM-DD 日期 */
const isValidDate = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

/** 从模型回复中提取 JSON 数组 */
const parseModelResponse = (content: unknown) => {
  const normalized = String(content || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
  const parsed = JSON.parse(normalized)
  if (!Array.isArray(parsed)) {
    throw new Error('模型未返回 JSON 数组')
  }
  return parsed
}

/** 校验并收敛模型输出，避免返回未定义的支出类型 */
const normalizeParsedResults = (
  parsed: { index?: number | string; costTypeId?: string | number; money?: number | string; date?: unknown }[],
  lines: string[],
  costTypes: { id?: string | number; name?: string }[]
) => {
  const costTypeMap = new Map(costTypes.map((item) => [String(item.id), item]))
  const resultMap = new Map<number, { index: number; costTypeId: string; costTypeName: string; money: number; date: string }>()

  parsed.forEach((item) => {
    const index = Number(item?.index)
    if (!Number.isInteger(index) || index < 1 || index > lines.length || resultMap.has(index)) {
      return
    }

    const matchedCostType = costTypeMap.get(String(item.costTypeId ?? ''))
    const money = Number(item.money)
    const date = isValidDate(item.date) ? item.date : ''
    resultMap.set(index, {
      index,
      costTypeId: String(matchedCostType?.id ?? ''),
      costTypeName: matchedCostType?.name || '',
      money: Number.isFinite(money) ? money : 0,
      date: typeof date === 'string' ? date : ''
    })
  })

  return Array.from(resultMap.values()).sort((a, b) => a.index - b.index)
}

/** 构造批量支出解析提示词 */
const buildBatchPrompt = (lines: string[], costTypes: { id?: string; name?: string }[]) => {
  const numberedLines = lines.map((line, index) => `${index + 1}. ${line}`).join('\n')
  return `
有多条支出内容如下，每行开头的数字是 index：
${numberedLines}

请严格按以下 JSON 数组格式输出，每条输入对应一个对象：
[
  {
    "index": 1,
    "costTypeId": "支出类型id",
    "costTypeName": "支出类型名称",
    "money": 0,
    "date": "YYYY-MM-DD"
  }
]

## 解析规则：
1. 所有内容都从对应行文本中获取，index 必须与行首编号一致。
2. costTypeId 和 costTypeName 从以下支出类型中选择最匹配的一项：
${JSON.stringify(costTypes)}
3. 金额从每行文本末尾获取，并输出数字。
4. 日期使用 YYYY-MM-DD 格式，时区为东八区；当前日期是 ${getCurrentDate()}，日期缺少年份或月份时据此补全。
5. 无法确定的字段使用空字符串，不得编造支出类型。
---
只输出 JSON 数组，不要添加解释、Markdown 标记或其他内容。
`.trim()
}

/** 调用 OpenAI Chat Completions 兼容接口批量解析支出记录 */
const parseBatch = async (lines: string[], costTypes: { id?: string; name?: string }[]) => {
  if (!AI_CONFIG.apiKey) {
    return ['AI 服务未配置，请联系管理员', null]
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const response = await fetch(`${AI_CONFIG.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AI_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        messages: [{ role: 'user', content: buildBatchPrompt(lines, costTypes) }],
        stream: false
      }),
      signal: controller.signal
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      console.error(`AI 服务请求失败，HTTP 状态码：${response.status}`, errorBody.slice(0, 300))
      return [`AI 服务请求失败（${response.status}）`, null]
    }

    const result = (await response.json()) as { choices?: { message?: { content?: string } }[] }
    const content = result.choices?.[0]?.message?.content
    const parsed = parseModelResponse(content)
    return [null, normalizeParsedResults(parsed, lines, costTypes)]
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error(`AI 服务请求超时（${REQUEST_TIMEOUT / 1000}s）`)
      return ['AI 服务请求超时，请稍后重试', null]
    }
    console.error('批量 AI 解析失败：', err instanceof Error ? err.message : err)
    return ['AI 解析失败，请稍后重试', null]
  } finally {
    clearTimeout(timeout)
  }
}

export { parseBatch }
