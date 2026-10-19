/** 资产类型。存储值保持英文，页面只显示中文 */
export const ASSET_TYPES = [
  { value: 'living', label: '流动资金' },
  { value: 'steady', label: '固定资产' },
  { value: 'longterm', label: '投资理财' },
  { value: 'receivable', label: '应收款' },
  { value: 'debt', label: '负债' },
]

/** 四笔钱。和资产类型是两套分类 */
export const FOUR_TYPES = [
  { value: 'living', label: '活钱' },
  { value: 'steady', label: '稳健' },
  { value: 'longterm', label: '长期' },
  { value: 'insurance', label: '保险' },
]

export const typeLabel = (value: string) => ASSET_TYPES.find((item) => item.value === value)?.label || value
export const fourLabel = (value: string) => FOUR_TYPES.find((item) => item.value === value)?.label || value

/** 金额先收到分，避免浮点相加后出现一长串小数 */
export const roundMoney = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(Number(value))) return null
  return Math.round(Number(value) * 100) / 100
}

/** 金额显示为人民币样式，固定两位小数 */
export const formatMoney = (value: number | null | undefined) => {
  const amount = roundMoney(value)
  if (amount == null) return '—'
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 变化额：上涨绿色，下降红色 */
export const changeClass = (value: number | null | undefined) => {
  if (value == null || value === 0) return 'flat'
  return value > 0 ? 'up' : 'down'
}

export const changeText = (value: number | null | undefined) => {
  if (value == null) return '—'
  const sign = value > 0 ? '+' : ''
  return sign + formatMoney(value)
}
