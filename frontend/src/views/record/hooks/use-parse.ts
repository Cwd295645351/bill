import type { CostType } from '@/types/bill'
import { ref, type Ref } from 'vue'
import dayjs from 'dayjs'
import { parseBatchTransactions } from '../api'

interface ParsedItem {
  index: number
  costTypeId: string
  money: number
  date: string
}

export const useParse = (costTypes: Ref<CostType[]>) => {
  const loading = ref(false)

  /** 批量解析：由后端代理调用 AI 服务 */
  const parseBatch = async (text: string) => {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    if (lines.length === 0) return []

    const todayTs = dayjs().startOf('day').valueOf()
    const fallbackResults = () =>
      lines.map((line) => ({
        remark: line,
        costTypeId: '',
        money: 0,
        date: todayTs,
        belongUserId: '',
      }))

    loading.value = true
    try {
      const [requestError, response] = await parseBatchTransactions({
        data: { text, costTypes: costTypes.value },
      })
      if (requestError || response?.retCode !== 0 || !Array.isArray(response?.data)) {
        ElMessage.error(response?.message || '批量解析失败')
        return fallbackResults()
      }

      const parsed = response.data as ParsedItem[]
      const parsedMap = new Map(parsed.map((item) => [item.index, item]))
      return lines.map((line, index) => {
        const info = parsedMap.get(index + 1)
        if (!info) {
          return { remark: line, costTypeId: '', money: 0, date: todayTs, belongUserId: '' }
        }
        return {
          remark: line,
          costTypeId: info.costTypeId || '',
          money: info.money || 0,
          // 转为毫秒时间戳，与日期组件及后端接口保持一致
          date: info.date ? dayjs(info.date).startOf('day').valueOf() : todayTs,
          belongUserId: '',
        }
      })
    } catch (error) {
      ElMessage.error('批量解析失败')
      return fallbackResults()
    } finally {
      loading.value = false
    }
  }

  return { parseBatch, loading }
}
