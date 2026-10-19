import dayjs from 'dayjs'

/** 日期入参：时间戳、日期字符串或 Date */
type DateInput = string | number | Date | null | undefined

/**
 * 将多种日期输入统一转为毫秒时间戳
 * @param value 时间戳、日期字符串或 Date
 * @returns 毫秒时间戳；无法解析时为 null
 */
const toTimestamp = (value: DateInput) => {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'number') {
    // 10 位秒级时间戳
    if (value > 0 && value < 1e12) return value * 1000
    return value
  }
  if (value instanceof Date) {
    const t = value.getTime()
    return Number.isNaN(t) ? null : t
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d+$/.test(trimmed)) {
      const n = Number(trimmed)
      return n < 1e12 ? n * 1000 : n
    }
    const d = dayjs(trimmed)
    return d.isValid() ? d.valueOf() : null
  }
  return null
}

/** 日期字符串当天 00:00:00 时间戳 */
const dayStart = (dateStr: string) => toTimestamp(`${dateStr} 00:00:00`)

/** 日期字符串当天 23:59:59.999 时间戳 */
const dayEnd = (dateStr: string) => toTimestamp(`${dateStr} 23:59:59`)

/** 时间戳格式化为 YYYY-MM-DD */
const formatDate = (ts: DateInput) => {
  if (ts === undefined || ts === null || ts === '') return ''
  return dayjs(Number(ts)).format('YYYY-MM-DD')
}

/** 从时间戳取年份 */
const yearFromTimestamp = (ts: DateInput) => dayjs(Number(ts)).year()

export { toTimestamp, dayStart, dayEnd, formatDate, yearFromTimestamp }
