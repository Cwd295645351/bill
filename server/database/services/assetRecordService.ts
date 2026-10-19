import type { Row } from '../../types/domain'
import { sequelize, AssetRecord } from '../index'
import { Op, QueryTypes } from 'sequelize'

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

export { getLatestSnapshotsBefore, getRecentRecordsGrouped }
