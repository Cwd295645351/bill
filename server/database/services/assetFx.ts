import { BillExchangeRate } from '../index'

/** 尚未保存时的初始汇率。只为了能折成人民币，不代表市场价格 */
const DEFAULT_HKD_RATE = 0.91
const DEFAULT_USD_RATE = 7.12

interface Rates {
  hkdRate: number
  usdRate: number
  saved: boolean
}

/** 读取账本汇率。没有记录时不插入 */
const getBillRates = async (billId: string): Promise<Rates> => {
  const row = await BillExchangeRate.findOne({ where: { billId } })
  if (!row) return { hkdRate: DEFAULT_HKD_RATE, usdRate: DEFAULT_USD_RATE, saved: false }
  return {
    hkdRate: Number(row.hkdRate) || DEFAULT_HKD_RATE,
    usdRate: Number(row.usdRate) || DEFAULT_USD_RATE,
    saved: true
  }
}

/** 原币折人民币，收到分。人民币乘 1，港币乘 hkdRate，美元乘 usdRate */
const toCny = (amount: unknown, currency: unknown, rates: { hkdRate: number; usdRate: number }) => {
  const raw = Math.abs(Number(amount) || 0)
  const code = String(currency || 'CNY')
  const rate = code === 'HKD' ? rates.hkdRate : code === 'USD' ? rates.usdRate : 1
  return Math.round(raw * rate * 100) / 100
}

export { DEFAULT_HKD_RATE, DEFAULT_USD_RATE, getBillRates, toCny }
export type { Rates }
