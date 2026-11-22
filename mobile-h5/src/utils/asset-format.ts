/** 手机资产页共用的金额、日期和分组展示。 */

import type { AssetGroup, AssetRow, AssetStats } from '@/api/asset'
import { toneOf, type Tone } from './asset-tone'

export const TYPE_ORDER = ['流动资金', '固定资产', '投资理财', '应收款', '负债']
export const ASSET_TYPES = [
  { value: 'living', label: '流动资金' },
  { value: 'steady', label: '固定资产' },
  { value: 'longterm', label: '投资理财' },
  { value: 'receivable', label: '应收款' },
  { value: 'debt', label: '负债' }
]
export const FOUR_TYPES = [
  { value: 'living', label: '活钱' },
  { value: 'steady', label: '稳健' },
  { value: 'longterm', label: '长期' },
  { value: 'insurance', label: '保险' }
]
export const CURRENCIES = [
  { value: 'CNY', label: '人民币' },
  { value: 'HKD', label: '港币' },
  { value: 'USD', label: '美元' }
]

export function labelOf(list: { value: string; label: string }[], value?: string) {
  return list.find((item) => item.value === value)?.label || value || ''
}

export function moneyText(value: number | null | undefined, hidden = false) {
  if (hidden) return '****'
  if (value == null || Number.isNaN(Number(value))) return '—'
  return Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function deltaText(value: number | null | undefined, hidden = false) {
  if (hidden) return '****'
  if (value == null) return '—'
  if (Math.abs(Number(value)) < 0.005) return '没有变化'
  const sign = Number(value) > 0 ? '+' : ''
  return sign + moneyText(value, false)
}

export function toneName(value: number | null | undefined, debt = false): Tone {
  return toneOf(value, debt)
}

export function rawNote(currency?: string, rawAmount?: number | null, hidden = false) {
  if (!currency || currency === 'CNY' || rawAmount == null) return ''
  const name = currency === 'HKD' ? '港币' : currency === 'USD' ? '美元' : currency
  return `${name} ${moneyText(rawAmount, hidden)}`
}

export function todayText() {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function monthText(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** 把 YYYY-MM-DD 转成当天零点的毫秒时间戳，供盘点接口使用。 */
export function dayStamp(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1).getTime()
}

export function stampDay(value?: number) {
  if (!value) return ''
  const date = new Date(value)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function orderedGroups(stats: AssetStats | null) {
  const all = [...(stats?.assetGroups || []), ...(stats?.debtGroups || [])]
  return TYPE_ORDER.map((name) => all.find((item) => item.typeName === name)).filter((item): item is AssetGroup => !!item && item.assets.length > 0)
}

export interface MemberBlock {
  name: string
  amount: number
  change: number
  rows: AssetRow[]
}

/** 组内先按成员小计，再列出每一笔。变化相加，空变化按 0。 */
export function memberBlocks(rows: AssetRow[]): MemberBlock[] {
  const blocks: MemberBlock[] = []
  rows.forEach((row) => {
    const name = row.memberName || row.member?.name || '未命名'
    let block = blocks.find((item) => item.name === name)
    if (!block) {
      block = { name, amount: 0, change: 0, rows: [] }
      blocks.push(block)
    }
    block.amount += Number(row.latestAmount) || 0
    block.change += Number(row.change) || 0
    block.rows.push(row)
  })
  return blocks
}

export function fixedAmount(stats: AssetStats | null) {
  const groups = [...(stats?.assetGroups || []), ...(stats?.debtGroups || [])]
  return groups.find((item) => item.typeName === '固定资产')?.amount || 0
}

export const ASSET_COLORS: Record<string, string> = {
  流动资金: '#5b8ff9',
  固定资产: '#f6bd16',
  投资理财: '#5ad8a6',
  应收款: '#6dc8ec',
  负债: '#f08bb4',
  活钱: '#5b8ff9',
  稳健: '#5ad8a6',
  长期: '#f6bd16',
  保险: '#b37feb',
  总资产: '#4285f4',
  总净资产: '#18a356',
  总负债: '#f74f4f'
}

const SYMBOLS: Record<string, string> = { CNY: '¥', HKD: 'HK$', USD: 'US$' }

/** 原型卡片上的简写：不到一万写全额，超过则写万。 */
export function shortText(value: number | null | undefined, hidden = false) {
  if (hidden) return '****'
  const abs = Math.abs(Number(value) || 0)
  if (abs < 10000) return moneyText(abs, false)
  const wan = Math.round(abs / 100) / 100
  return (Math.abs(wan - Math.round(wan)) < 0.001 ? String(Math.round(wan)) : wan.toFixed(2)) + '万'
}

export function signedText(value: number | null | undefined, hidden = false) {
  if (hidden) return '****'
  if (value == null || Number.isNaN(Number(value))) return '—'
  return moneyText(value, false)
}

/**
 * 与电脑端 shortAmount 一致：绝对值不超过 100 显示原金额，超过则用「万」。
 */
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

export function percentText(part: number, total: number) {
  return (!total ? '0.0' : ((part / total) * 100).toFixed(1)) + '%'
}

export function dayLabel(day: string) {
  if (!day) return '上一笔盘点'
  const [year, month, date] = day.split('-').map(Number)
  const thisYear = new Date().getFullYear()
  return year === thisYear ? `${month}月${date}日` : `${year}年${month}月${date}日`
}

export function currencySymbol(currency?: string) {
  return SYMBOLS[currency || 'CNY'] || ''
}

/** 涨跌用原型的 income / cost，持平不加色。负债增减对调。 */
export function changeClass(value: number | null | undefined, debt = false) {
  const tone = toneOf(value, debt)
  if (tone === 'up') return 'income'
  if (tone === 'down') return 'cost'
  return ''
}
