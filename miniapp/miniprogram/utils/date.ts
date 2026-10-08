const dayjs = require('dayjs')

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** 当天 00:00:00 的毫秒时间戳 */
export function dayStartTs(date: string | number): number {
  return dayjs(date).startOf('day').valueOf()
}

/** 当天 23:59:59.999 的毫秒时间戳 */
export function dayEndTs(date: string | number): number {
  return dayjs(date).endOf('day').valueOf()
}

export function formatDay(ts: number | string): string {
  return dayjs(Number(ts)).format('YYYY-MM-DD')
}

const DAY_TEXT = /^\d{4}-\d{2}-\d{2}$/

/**
 * 转成日期选择器可用的日历日。
 * 接受毫秒时间戳或已是 YYYY-MM-DD 的文本；非法输入返回空字符串，不用今天填补。
 */
export function toDayText(value: string | number | null | undefined): string {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (DAY_TEXT.test(trimmed)) {
      const parsed = dayjs(trimmed)
      if (parsed.isValid() && parsed.format('YYYY-MM-DD') === trimmed) return trimmed
      return ''
    }
  }
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp)) return ''
  const parsed = dayjs(timestamp)
  if (!parsed.isValid()) return ''
  const text = parsed.format('YYYY-MM-DD')
  return DAY_TEXT.test(text) ? text : ''
}

export function formatDayLabel(ts: number | string): string {
  return dayjs(Number(ts)).format('YYYY年MM月DD日')
}

export function weekLabel(ts: number | string): string {
  return WEEK[dayjs(Number(ts)).day()]
}

export function today(): string {
  return dayjs().format('YYYY-MM-DD')
}

export function thisYear(): number {
  return dayjs().year()
}

/** 某年 1 月 1 日 00:00:00 的毫秒时间戳，默认今年 */
export function yearStartTs(year?: number): number {
  const y = year || dayjs().year()
  return dayjs(`${y}-01-01`).startOf('day').valueOf()
}
