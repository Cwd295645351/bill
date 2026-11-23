import type { Row, WhereBag } from '../../types/domain'
import { Asset, AssetRecord, sequelize } from '../../database/index'
import { Op } from 'sequelize'
import { toTimestamp } from '../../utils/dateUtil'
import { placeRecordDate, recomputeLatestAmount } from './record-service'

/** 盘点金额允许为 0 */
const readAmount = (amount: unknown): [string, null] | [null, number] => {
  if (amount === undefined || amount === null || amount === '') return ['金额不能为空', null]
  const value = Number(amount)
  if (!Number.isFinite(value) || value < 0) return ['盘点金额必须大于等于0', null]
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

  const tx = await sequelize.transaction()
  try {
    const asset = await Asset.findOne({
      where: { id: String(assetId), isDel: false },
      transaction: tx,
      lock: tx.LOCK.UPDATE
    })
    if (!asset) {
      await tx.rollback()
      return ['资产不存在', null]
    }
    const placed = await placeRecordDate(String(assetId), ts, undefined, tx)
    const record = await AssetRecord.create({ assetId, amount: value, date: placed }, { transaction: tx })
    if (!record) {
      await tx.rollback()
      return ['盘点记录创建失败', null]
    }
    const latest = await recomputeLatestAmount(String(assetId), tx)
    if (latest == null) {
      await tx.rollback()
      return ['资产主表更新失败，资产可能已被删除', null]
    }
    await tx.commit()
    return [null, record]
  } catch (error) {
    await tx.rollback()
    throw error
  }
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
  const current = await AssetRecord.findOne({ where: { id, isDel: false } })
  if (!current) return ['编辑资产记录失败，资产记录可能已被删除', null]
  if (String(current.assetId || '') !== String(assetId)) return ['盘点不属于该资产', null]

  const ownerId = String(current.assetId)
  const tx = await sequelize.transaction()
  try {
    const asset = await Asset.findOne({
      where: { id: ownerId, isDel: false },
      transaction: tx,
      lock: tx.LOCK.UPDATE
    })
    if (!asset) {
      await tx.rollback()
      return ['资产主表更新失败，资产可能已被删除', null]
    }
    const row = await AssetRecord.findOne({
      where: { id, assetId: ownerId, isDel: false },
      transaction: tx,
      lock: tx.LOCK.UPDATE
    })
    if (!row) {
      await tx.rollback()
      return ['编辑资产记录失败，资产记录可能已被删除', null]
    }
    const placed = await placeRecordDate(ownerId, ts, String(id), tx)
    await AssetRecord.update(
      { amount: value, date: placed },
      { where: { id, assetId: ownerId, isDel: false }, transaction: tx }
    )
    const res = await AssetRecord.findOne({ where: { id, assetId: ownerId, isDel: false }, transaction: tx })
    if (!res) {
      await tx.rollback()
      return ['编辑资产记录失败，资产记录可能已被删除', null]
    }
    const latest = await recomputeLatestAmount(ownerId, tx)
    if (latest == null) {
      await tx.rollback()
      return ['资产主表更新失败，资产可能已被删除', null]
    }
    await tx.commit()
    return [null, res]
  } catch (error) {
    await tx.rollback()
    throw error
  }
}

/** 删除资产记录
 * @param {string} id 资产记录id
 * @returns {Array} [错误信息, 是否成功]
 */
export const delAssetRecord = async ({ id }: Row) => {
  if (!id) return ['资产记录id不能为空', null]

  const record = await AssetRecord.findOne({ where: { id, isDel: false } })
  if (!record) return ['资产记录不存在', null]
  const assetId = String(record.assetId || '')

  const tx = await sequelize.transaction()
  try {
    const asset = await Asset.findOne({
      where: { id: assetId, isDel: false },
      transaction: tx,
      lock: tx.LOCK.UPDATE
    })
    if (!asset) {
      await tx.rollback()
      return ['资产主表更新失败，资产可能已被删除', null]
    }
    const row = await AssetRecord.findOne({
      where: { id, assetId, isDel: false },
      transaction: tx,
      lock: tx.LOCK.UPDATE
    })
    if (!row) {
      await tx.rollback()
      return ['删除资产记录失败，资产记录可能已被删除', null]
    }
    const recordCount = await AssetRecord.count({ where: { assetId, isDel: false }, transaction: tx })
    if (recordCount <= 1) {
      await tx.rollback()
      return ['只剩一条记录时不能删除', null]
    }
    const [affected] = await AssetRecord.update(
      { isDel: true },
      { where: { id, assetId, isDel: false }, transaction: tx }
    )
    if (!affected) {
      await tx.rollback()
      return ['删除资产记录失败，资产记录可能已被删除', null]
    }
    const latest = await recomputeLatestAmount(assetId, tx)
    if (latest == null) {
      await tx.rollback()
      return ['资产主表更新失败，资产可能已被删除', null]
    }
    await tx.commit()
    return [null, true]
  } catch (error) {
    await tx.rollback()
    throw error
  }
}

/** 获取资产记录
 * @param {string} assetId 资产id
 * @param {number} startDate 开始日期
 * @param {number} endDate 结束日期
 * @returns {Array} [错误信息, 资产记录列表]
 */
export const getAssetRecords = async ({ assetId, startDate, endDate, page, pageSize }: Row) => {
  if (!assetId) return ['资产id不能为空', null]
  const query: WhereBag = { assetId, isDel: false }
  if (startDate || endDate) {
    const dateWhere: WhereBag = {}
    if (startDate) dateWhere[Op.gte] = startDate
    if (endDate) dateWhere[Op.lte] = endDate
    query.date = dateWhere
  }
  const paged = page !== undefined && page !== null && page !== '' || pageSize !== undefined && pageSize !== null && pageSize !== ''
  if (!paged) {
    const res = await AssetRecord.findAll({ where: query, order: [['date', 'DESC']] })
    return [null, res]
  }
  const pageNum = Math.max(1, Number(page) || 1)
  const size = Math.max(1, Number(pageSize) || 10)
  const result = await AssetRecord.findAndCountAll({
    where: query,
    order: [['date', 'DESC']],
    limit: size,
    offset: (pageNum - 1) * size
  })
  return [null, { list: result.rows, total: result.count, page: pageNum, pageSize: size }]
}
