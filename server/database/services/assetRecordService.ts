import type { Row, WhereBag } from '../../types/domain'
import { sequelize, Asset, AssetRecord } from '../index'
import { Op, QueryTypes } from 'sequelize'
import dayjs from 'dayjs'

/**
 * 获取每个资产在指定时间点之前的最新快照（参数化查询，防 SQL 注入）
 * @param {string[]} assetIds 资产 id 列表
 * @param {number} maxTimestamp 最大时间戳
 */
const getLatestSnapshotsBefore = async (
  assetIds: (string | null | undefined)[],
  maxTimestamp: number
): Promise<Row[]> => {
  if (!assetIds.length) return []
  const rows = await sequelize.query(
    `SELECT t.asset_id AS assetId, t.amount, t.date
     FROM asset_records t
     INNER JOIN (
       SELECT asset_id, MAX(date) AS max_date
       FROM asset_records
       WHERE asset_id IN (:assetIds)
         AND date <= :maxTimestamp
         AND is_del = 0
       GROUP BY asset_id
     ) latest ON t.asset_id = latest.asset_id AND t.date = latest.max_date
     WHERE t.is_del = 0`,
    { replacements: { assetIds, maxTimestamp }, type: QueryTypes.SELECT }
  )
  return rows as Row[]
}

/**
 * 获取每个资产最近 N 条记录（应用层分组，避免复杂 SQL）
 */
const getRecentRecordsGrouped = async (assetIds: (string | null | undefined)[], limitPerAsset = 2) => {
  if (!assetIds.length) return {}
  const records = await AssetRecord.findAll({
    where: { assetId: { [Op.in]: assetIds }, isDel: false },
    order: [['date', 'DESC']],
    raw: true
  })
  const map: Record<string, Row[]> = {}
  for (const r of records as Row[]) {
    const key = r.assetId || ''
    if (!map[key]) map[key] = []
    if (map[key].length < limitPerAsset) map[key].push(r)
  }
  return map
}

/**
 * 同一自然日内，把时间放在已有盘点之后 1 毫秒，并且不跨出这一天。
 * 这一天还没有别的盘点时，保留调用方给出的时间。
 * @param assetId 资产 id
 * @param dateInput 用户选择的日期时间戳
 * @param excludeId 修改时排除自己
 */
const placeRecordDate = async (assetId: string, dateInput: number, excludeId?: string) => {
  const start = dayjs(dateInput).startOf('day').valueOf()
  const end = dayjs(dateInput).endOf('day').valueOf()
  const where: WhereBag = { assetId, isDel: false, date: { [Op.gte]: start, [Op.lte]: end } }
  if (excludeId) where.id = { [Op.ne]: excludeId }
  const latest = await AssetRecord.findOne({ where, order: [['date', 'DESC']] })
  if (!latest) {
    const ts = Number(dateInput)
    if (!Number.isFinite(ts) || ts < start || ts > end) return start
    return ts
  }
  const next = Number(latest.date) + 1
  return next > end ? end : next
}

/**
 * 按未删除盘点的日期从新到旧，重算当前金额和最近更新日期。
 * @param assetId 资产 id
 */
const recomputeLatestAmount = async (assetId: string) => {
  const latest = await AssetRecord.findOne({
    where: { assetId, isDel: false },
    order: [['date', 'DESC']]
  })
  if (!latest) return null
  await Asset.update(
    { latestAmount: latest.amount, lastUpdatedDate: latest.date },
    { where: { id: assetId, isDel: false } }
  )
  return latest
}

export { getLatestSnapshotsBefore, getRecentRecordsGrouped, placeRecordDate, recomputeLatestAmount }
