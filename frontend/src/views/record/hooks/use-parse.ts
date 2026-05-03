import OpenAI from 'openai'
import type { CostType, IncomesType } from '@/types/bill'
import { ref, type Ref } from 'vue'

/** AI 请求地址 */
const AI_BASE_URL = 'https://api.siliconflow.cn/v1'

/** Siliconflow API Key */
const siliconflowKey = 'sk-vkqtbgoweftfpwoktjfaznydzdkteixhdizyyxhiurqgeaso'

/** 模型 */
const model = 'Pro/deepseek-ai/DeepSeek-V3.2'

export const useParse = (costTypes: Ref<CostType[]>) => {
  const loading = ref(false)
  const parse = async (value: string) => {
    loading.value = true
    const promote = `
    有份支出内容如下:
    ${value}
    请严格按此 JSON 结构化输出：
    {
      "costTypeId": "支出类型id",
      "costTypeName": "支出类型名称",
      "money": "金额",
      "date": "日期"
    }


    ## 解析规则：
    1. 所有内容都从 value 中获取
    2. 支出类型id 和 支出类型名称 根据内容从costTypes 中找到最符合的支出类型，costTypes 内容如下：
    ${JSON.stringify(costTypes.value)}
    3. 金额 从 value 中获取
    4. 日期应使用 Date 格式，时区为东八区，如果日期不完整（如缺少年份或月份），则补充为2026年和月份
    ---
    请直接输出JSON结构化信息，不要添加解释性内容。
    `
    const client = new OpenAI({
      apiKey: siliconflowKey,
      baseURL: AI_BASE_URL,
      dangerouslyAllowBrowser: true,
    })
    // 发送请求
    // @ts-ignore
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: promote }],
      stream: true,
      enable_thinking: false,
    })

    let responseText = ''

    // 处理流式响应
    for await (const chunk of completion) {
      if (chunk.choices) {
        if (chunk.choices[0]?.delta?.content) {
          const message = chunk.choices[0].delta.content
          responseText += message
        }
      }
    }
    loading.value = false
    try {
      const info = JSON.parse(responseText.replace('```json', '').replace('```', ''))
      return { info, error: false }
    } catch (error) {
      console.log('解析失败', error)
      return { info: null, error: true }
    }
  }

  /** 批量解析：一次请求解析所有行 */
  const parseBatch = async (text: string) => {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length === 0) return []

    loading.value = true
    const numberedLines = lines.map((line, i) => `${line}`).join('\n')
    const promote = `
有多条支出内容如下（每行一条）:
${numberedLines}
请严格按此 JSON 数组格式输出，每条对应一个对象：
[
  {
    "index": 1,
    "costTypeId": "支出类型id",
    "costTypeName": "支出类型名称",
    "money": "金额",
    "date": "日期"
  }
]

## 解析规则：
1. 所有内容都从每行文本中获取，index 对应行号。
2. 【costTypeId】从costTypes中找到最符合的支出类型，costTypes的内容如下：
${JSON.stringify(costTypes.value)}
3. 金额从每行文本末尾中获取。
4. 日期从每行开头获取，应使用 Date 格式，时区为东八区，如果日期不完整（如缺少年份或月份），则补充为2026年和月份。
---
请直接输出JSON数组，不要添加解释性内容。
`


    const client = new OpenAI({
      apiKey: siliconflowKey,
      baseURL: AI_BASE_URL,
      dangerouslyAllowBrowser: true,
    })
    // @ts-ignore
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: promote }],
      stream: true,
      enable_thinking: false,
    })

    let responseText = ''
    for await (const chunk of completion) {
      if (chunk.choices?.[0]?.delta?.content) {
        responseText += chunk.choices[0].delta.content
      }
    }
    loading.value = false

    try {
      const parsed: Array<{ index: number; costTypeId: string; money: number; date: string }> = JSON.parse(responseText.replace('```json', '').replace('```', ''))
      const parsedMap = new Map(parsed.map((item) => [item.index, item]))

      return lines.map((line, i) => {
        const info = parsedMap.get(i + 1)
        if (info) {
          return {
            remark: line,
            costTypeId: info.costTypeId || '',
            money: info.money || 0,
            date: info.date || '',
            belongUserId: '',
          }
        }
        return { remark: line, costTypeId: '', money: 0, date: '', belongUserId: '' }
      })
    } catch (error) {
      console.log('批量解析失败', error)
      return lines.map((line) => ({
        remark: line,
        costTypeId: '',
        money: 0,
        date: '',
        belongUserId: '',
      }))
    }
  }

  return { parse, parseBatch, loading }
}
