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

export const CURRENCIES = [
  { value: 'CNY', label: '人民币' },
  { value: 'HKD', label: '港币' },
  { value: 'USD', label: '美元' },
]

export const CHANNEL_TYPES = [
  { value: '微信', label: '微信' },
  { value: '支付宝', label: '支付宝' },
  { value: '平安银行', label: '平安银行' },
  { value: '中国银行', label: '中国银行' },
  { value: '招商银行', label: '招商银行' },
  { value: '建设银行', label: '建设银行' },
  { value: '中信银行', label: '中信银行' },
  { value: '交通银行', label: '交通银行' },
  { value: '微众银行', label: '微众银行' },
  { value: '广发银行', label: '广发银行' },
  { value: '兴业银行', label: '兴业银行' },
  { value: '且慢', label: '且慢' },
  { value: '众安', label: '众安' },
  { value: '股票', label: '股票' },
  { value: '固定资产', label: '固定资产' },
  { value: '公积金', label: '公积金' },
  { value: '未知', label: '未知' },
]

export const TURNAROUND_TYPES = [
  { value: 'T+0', label: 'T+0' },
  { value: 'T+1', label: 'T+1' },
  { value: '长期', label: '长期' },
  { value: '不可提现', label: '不可提现' },
]

export const currencyLabel = (value?: string) => CURRENCIES.find((item) => item.value === value)?.label || '人民币'

export const typeLabel = (value: string) => ASSET_TYPES.find((item) => item.value === value)?.label || value
export const fourLabel = (value: string) => FOUR_TYPES.find((item) => item.value === value)?.label || value
export const turnaroundLabel = (value?: string) => TURNAROUND_TYPES.find((item) => item.value === value)?.label || 'T+0'
export const channelLabel = (value?: string) => CHANNEL_TYPES.find((item) => item.value === value)?.label || '未知'

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

/**
 * 缩短金额。绝对值不大于 100 时显示原金额；超过 100 时用「万」，整万不带小数，否则保留两位。
 */
export const shortAmount = (value: number | null | undefined) => {
  const amount = roundMoney(value)
  if (amount == null) return '—'
  const abs = Math.abs(amount)
  if (abs <= 100) return formatMoney(amount)
  const wan = Math.round((abs / 10000) * 100) / 100
  const text = Math.abs(wan - Math.round(wan)) < 0.001 ? String(Math.round(wan)) : wan.toFixed(2)
  return `${amount < 0 ? '-' : ''}${text}万`
}

/** 外币在人民币旁边标出原币。人民币不显示 */
export const rawNote = (currency?: string, rawAmount?: number | null) => {
  if (!currency || currency === 'CNY' || rawAmount == null) return ''
  const name = currency === 'HKD' ? '港币' : currency === 'USD' ? '美元' : currency
  return `${name} ${formatMoney(rawAmount)}`
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

/** 柱顶的变化。不到半分钱视为没有变化；100 及以上不带小数 */
export const compactDelta = (value: number | null | undefined) => {
  if (value == null) return '—'
  if (Math.abs(value) < 0.005) return '没有变化'
  const abs = Math.abs(value)
  const digits = abs >= 100 ? 0 : 2
  const text = abs.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: digits })
  return `${value > 0 ? '+' : '-'}${text}`
}
