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
