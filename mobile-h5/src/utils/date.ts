import dayjs from 'dayjs'

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const DAY_TEXT = /^\d{4}-\d{2}-\d{2}$/

export function dayStartTs(date: string | number): number {
  return dayjs(date).startOf('day').valueOf()
}

export function dayEndTs(date: string | number): number {
  return dayjs(date).endOf('day').valueOf()
}

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
  return parsed.format('YYYY-MM-DD')
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

export function yearStartTs(year?: number): number {
  const y = year || dayjs().year()
  return dayjs(`${y}-01-01`).startOf('day').valueOf()
}

export function moneyText(n: number | string | undefined | null): string {
  return Number(n || 0).toFixed(2)
}
