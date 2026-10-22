import type { Row } from '../../types/domain'
import { BillExchangeRate } from '../../database/index'
import { getBillRates } from '../../database/services/assetFx'

/** 读取汇率。尚未保存时返回大于 0 的初始值，不写入 */
export const getExchangeRate = async ({ billId }: Row) => {
  if (!billId) return ['账本id不能为空', null]
  const rates = await getBillRates(String(billId))
  return [null, { hkdRate: rates.hkdRate, usdRate: rates.usdRate, saved: rates.saved }]
}

/** 保存汇率。任一不是大于 0 的数字则整次失败，原值不变 */
export const saveExchangeRate = async ({ billId, hkdRate, usdRate }: Row) => {
  if (!billId) return ['账本id不能为空', null]
  const hkd = Number(hkdRate)
  const usd = Number(usdRate)
  if (!Number.isFinite(hkd) || hkd <= 0 || !Number.isFinite(usd) || usd <= 0) {
    return ['汇率必须大于0', null]
  }
  const current = await BillExchangeRate.findOne({ where: { billId } })
  if (current) {
    await BillExchangeRate.update({ hkdRate: hkd, usdRate: usd }, { where: { billId } })
  } else {
    await BillExchangeRate.create({ billId, hkdRate: hkd, usdRate: usd })
  }
  return [null, { hkdRate: hkd, usdRate: usd, saved: true }]
}
