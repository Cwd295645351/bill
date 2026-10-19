import type { Row, WhereBag } from '../../types/domain'
import { AssetRecord } from '../../database/index'
import { Op } from 'sequelize'
import { toTimestamp } from '../../utils/dateUtil'
import { placeRecordDate, recomputeLatestAmount } from '../../database/services/assetRecordService'

/** 盘点金额必须大于 0 */
const readAmount = (amount: unknown): [string, null] | [null, number] => {
  if (amount === undefined || amount === null || amount === '') return ['金额不能为空', null]
  const value = Number(amount)
  if (!Number.isFinite(value) || value <= 0) return ['盘点金额必须大于0', null]
  return [null, value]
}

/** 添加资产记录
 * @param {string} assetId 资产id
 * @param {number} amount 金额
 * @param {number} date 日期
 * @returns {Array} [错误信息, 资产记录对象]
 */
export const addAssetRecord = async ({ assetId, amount, date }: Row) => {
  if (!assetId) return ['资产id不能为空', null]
  const [amountErr, value] = readAmount(amount)
  if (amountErr || value == null) return [amountErr, null]
  const ts = toTimestamp(date as string | number)
  if (ts == null) return ['日期不能为空', null]

  const placed = await placeRecordDate(String(assetId), ts)
  const record = await AssetRecord.create({
    assetId,
    amount: value,
    date: placed
  })
  if (!record) return ['盘点记录创建失败', null]
  const latest = await recomputeLatestAmount(String(assetId))
  if (!latest) return ['资产主表更新失败，资产可能已被删除', null]
  return [null, record]
}

/** 编辑资产记录
 * @param {string} id 资产记录id
 * @param {string} assetId 资产id
 * @param {number} amount 金额
 * @param {number} date 日期
 * @returns {Array} [错误信息, 资产记录对象]
 */
export const editAssetRecord = async ({ id, assetId, amount, date }: Row) => {
  if (!id) return ['资产记录id不能为空', null]
  if (!assetId) return ['资产id不能为空', null]
  const [amountErr, value] = readAmount(amount)
  if (amountErr || value == null) return [amountErr, null]
  const ts = toTimestamp(date as string | number)
  if (ts == null) return ['日期不能为空', null]

  const placed = await placeRecordDate(String(assetId), ts, String(id))
  const [affected] = await AssetRecord.update({ amount: value, date: placed }, { where: { id, isDel: false } })
  const res = affected ? await AssetRecord.findByPk(id) : null
  if (!res) return ['编辑资产记录失败，资产记录可能已被删除', null]
  const latest = await recomputeLatestAmount(String(assetId))
  if (!latest) return ['资产主表更新失败，资产可能已被删除', null]
  return [null, res]
}

/** 删除资产记录
 * @param {string} id 资产记录id
 * @returns {Array} [错误信息, 是否成功]
 */
export const delAssetRecord = async ({ id }: Row) => {
  if (!id) return ['资产记录id不能为空', null]

  const record = await AssetRecord.findOne({ where: { id, isDel: false } })
  if (!record) return ['资产记录不存在', null]

  const assetId = record.assetId

  const recordCount = await AssetRecord.count({ where: { assetId, isDel: false } })
  if (recordCount <= 1) return ['只剩一条记录时不能删除', null]

  const [affected] = await AssetRecord.update({ isDel: true }, { where: { id, isDel: false } })
  if (!affected) return ['删除资产记录失败，资产记录可能已被删除', null]
  const latest = await recomputeLatestAmount(String(assetId))
  if (!latest) return ['资产主表更新失败，资产可能已被删除', null]
  return [null, true]
}

/** 获取资产记录
 * @param {string} assetId 资产id
 * @param {number} startDate 开始日期
 * @param {number} endDate 结束日期
 * @returns {Array} [错误信息, 资产记录列表]
 */
export const getAssetRecords = async ({ assetId, startDate, endDate }: Row) => {
  if (!assetId) return ['资产id不能为空', null]
  const query: WhereBag = { assetId, isDel: false }
  if (startDate || endDate) {
    const dateWhere: WhereBag = {}
    if (startDate) dateWhere[Op.gte] = startDate
    if (endDate) dateWhere[Op.lte] = endDate
    query.date = dateWhere
  }
  const res = await AssetRecord.findAll({ where: query, order: [['date', 'DESC']] })
  return [null, res]
}
