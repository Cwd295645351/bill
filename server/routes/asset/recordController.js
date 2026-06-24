const { Asset, AssetRecord } = require('../../database/index')
const { Op } = require('sequelize')

/** 添加资产记录
 * @param {string} assetId 资产id
 * @param {number} amount 金额
 * @param {number} date 日期
 * @returns {Array} [错误信息, 资产记录对象]
 */
exports.addAssetRecord = async ({ assetId, amount, date }) => {
  if (!assetId) return ['资产id不能为空', null]
  if (amount === undefined || amount === null) return ['金额不能为空', null]
  if (!date) return ['日期不能为空', null]

  const record = await AssetRecord.create({
    assetId,
    amount,
    date: date
  })

  if (!record) return ['盘点记录创建失败', null]

  const [affected] = await Asset.update(
    { latestAmount: amount, lastUpdatedDate: date },
    { where: { id: assetId, isDel: false } }
  )
  const updateRes = affected ? await Asset.findByPk(assetId) : null

  if (!updateRes) return ['资产主表更新失败，资产可能已被删除', null]

  return [null, record]
}

/** 编辑资产记录
 * @param {string} id 资产记录id
 * @param {string} assetId 资产id
 * @param {number} amount 金额
 * @param {number} date 日期
 * @returns {Array} [错误信息, 资产记录对象]
 */
exports.editAssetRecord = async ({ id, assetId, amount, date }) => {
  if (!id) return ['资产记录id不能为空', null]
  if (!assetId) return ['资产id不能为空', null]
  if (amount === undefined || amount === null) return ['金额不能为空', null]
  if (!date) return ['日期不能为空', null]

  const [affected] = await AssetRecord.update({ amount, date }, { where: { id, isDel: false } })
  const res = affected ? await AssetRecord.findByPk(id) : null
  if (!res) return ['编辑资产记录失败，资产记录可能已被删除', null]

  const latestRecord = await AssetRecord.findOne({ 
    where: { assetId, isDel: false },
    order: [['date', 'DESC']]
  })

  if (latestRecord) {
    const [assetAffected] = await Asset.update(
      { latestAmount: latestRecord.amount, lastUpdatedDate: latestRecord.date },
      { where: { id: assetId, isDel: false } }
    )
    const updateRes = assetAffected ? await Asset.findByPk(assetId) : null
    if (!updateRes) return ['资产主表更新失败，资产可能已被删除', null]
  }

  return [null, res]
}

/** 删除资产记录
 * @param {string} id 资产记录id
 * @returns {Array} [错误信息, 是否成功]
 */
exports.delAssetRecord = async ({ id }) => {
  if (!id) return ['资产记录id不能为空', null]

  const record = await AssetRecord.findOne({ where: { id, isDel: false } })
  if (!record) return ['资产记录不存在', null]

  const assetId = record.assetId

  const recordCount = await AssetRecord.count({ where: { assetId, isDel: false } })
  if (recordCount <= 1) return ['只剩一条记录时不能删除', null]

  const [affected] = await AssetRecord.update({ isDel: true }, { where: { id, isDel: false } })
  if (!affected) return ['删除资产记录失败，资产记录可能已被删除', null]

  const latestRecord = await AssetRecord.findOne({ where: { assetId, isDel: false }, order: [['date', 'DESC']] })
  
  if (latestRecord) {
    const [assetAffected] = await Asset.update(
      { latestAmount: latestRecord.amount, lastUpdatedDate: latestRecord.date },
      { where: { id: assetId, isDel: false } }
    )
    const updateRes = assetAffected ? await Asset.findByPk(assetId) : null
    if (!updateRes) return ['资产主表更新失败，资产可能已被删除', null]
  }

  return [null, true]
}

/** 获取资产记录
 * @param {string} assetId 资产id
 * @param {number} startDate 开始日期
 * @param {number} endDate 结束日期
 * @returns {Array} [错误信息, 资产记录列表]
 */
exports.getAssetRecords = async ({ assetId, startDate, endDate }) => {
  if (!assetId) return ['资产id不能为空', null]
  const query = { assetId, isDel: false }
  if (startDate || endDate) {
    query.date = {}
    if (startDate) query.date[Op.gte] = startDate
    if (endDate) query.date[Op.lte] = endDate
  }
  const res = await AssetRecord.findAll({ where: query, order: [['date', 'DESC']] })
  return [null, res]
}
