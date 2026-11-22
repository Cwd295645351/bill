import { toneOf } from './asset-tone'

export function shortText(value: number | null | undefined, hidden = false) {
  if (hidden) return '****'
  const abs = Math.abs(Number(value) || 0)
  if (abs < 10000) return moneyText(abs, false)
  const wan = Math.round(abs / 100) / 100
  return (Math.abs(wan - Math.round(wan)) < 0.001 ? String(Math.round(wan)) : wan.toFixed(2)) + '万'
}
/**
 * 小程序的 toLocaleString 会忽略小数位数，浮点误差会整段显示出来。
 * 先收到两位再补千分位。
 */
export function moneyText(value: number | null | undefined, hidden = false) {
  if (hidden) return '****'
  const amount = Number(value)
  if (value == null || Number.isNaN(amount)) return '—'
  const negative = amount < 0
  const [intPart, decPart] = Math.abs(Math.round(amount * 100) / 100).toFixed(2).split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${negative ? '-' : ''}${grouped}.${decPart}`
}

/** 与电脑端 shortAmount 一致：绝对值不超过 100 显示原金额，超过则用「万」。 */
export function shortAmount(value: number | null | undefined, hidden = false) {
  if (hidden) return '****'
  if (value == null || Number.isNaN(Number(value))) return '—'
  const amount = Math.round(Number(value) * 100) / 100
  const abs = Math.abs(amount)
  if (abs <= 100) return moneyText(amount, false)
  const wan = Math.round((abs / 10000) * 100) / 100
  const text = Math.abs(wan - Math.round(wan)) < 0.001 ? String(Math.round(wan)) : wan.toFixed(2)
  return `${amount < 0 ? '-' : ''}${text}万`
}

/** 变化额。不到半分钱视为没有变化；超过 100 用万，正数带加号。 */
export function changeShort(value: number | null | undefined, hidden = false) {
  if (hidden) return '****'
  if (value == null || Number.isNaN(Number(value))) return '—'
  if (Math.abs(Number(value)) < 0.005) return '没有变化'
  const text = shortAmount(Math.abs(Number(value)), false)
  return Number(value) > 0 ? `+${text}` : `-${text}`
}

export function deltaText(value: number | null | undefined, hidden = false) {
  if (hidden) return '****'
  if (value == null) return '—'
  if (Math.abs(Number(value)) < 0.005) return '没有变化'
  return `${Number(value) > 0 ? '+' : ''}${moneyText(value, false)}`
}

/** 涨跌用 income / cost，持平不加色。负债增减对调，与移动端同一套类名。 */
export function toneClass(value: number | null | undefined, debt = false) {
  const tone = toneOf(value, debt)
  if (tone === 'up') return 'income'
  if (tone === 'down') return 'cost'
  return ''
}

/** 卡片净资产：保留正负号，不缩成「万」。 */
export function signedText(value: number | null | undefined, hidden = false) {
  if (hidden) return '****'
  if (value == null || Number.isNaN(Number(value))) return '—'
  return moneyText(value, false)
}

/** 今年只写月日，跨年带上年份，月份不补零。 */
export function dayLabel(day: string) {
  if (!day) return '上一笔盘点'
  const [year, month, date] = day.split('-').map(Number)
  const thisYear = new Date().getFullYear()
  return year === thisYear ? `${month}月${date}日` : `${year}年${month}月${date}日`
}

export function todayText() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function dayStamp(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1).getTime()
}

export function stampDay(value?: number) {
  if (!value) return ''
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
