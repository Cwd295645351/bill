const Asset = require('../../database/modules/Asset')
const AssetRecord = require('../../database/modules/AssetRecord')
const mongoose = require('../../database/index')

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
    assetId: mongoose.Types.ObjectId(assetId),
    amount,
    date: date
  })

  if (!record) return ['盘点记录创建失败', null]

  const updateRes = await Asset.findOneAndUpdate(
    { _id: mongoose.Types.ObjectId(assetId), isDel: false },
    {
      latestAmount: amount,
      lastUpdatedDate: date
    },
    { new: true }
  )

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

  const res = await AssetRecord.findOneAndUpdate(
    { _id: mongoose.Types.ObjectId(id), isDel: false },
    { amount, date },
    { new: true }
  )
  if (!res) return ['编辑资产记录失败，资产记录可能已被删除', null]

  const latestRecord = await AssetRecord.findOne({ 
    assetId: mongoose.Types.ObjectId(assetId), 
    isDel: false 
  }).sort({ date: -1 })

  if (latestRecord) {
    const updateRes = await Asset.findOneAndUpdate(
      { _id: mongoose.Types.ObjectId(assetId), isDel: false },
      { 
        latestAmount: latestRecord.amount, 
        lastUpdatedDate: latestRecord.date 
      },
      { new: true }
    )
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

  const record = await AssetRecord.findOne({ _id: mongoose.Types.ObjectId(id), isDel: false })
  if (!record) return ['资产记录不存在', null]

  const assetId = record.assetId

  const recordCount = await AssetRecord.countDocuments({ assetId: mongoose.Types.ObjectId(assetId), isDel: false })
  if (recordCount <= 1) return ['只剩一条记录时不能删除', null]

  const res = await AssetRecord.findOneAndUpdate(
    { _id: mongoose.Types.ObjectId(id), isDel: false },
    { isDel: true },
    { new: true }
  )
  if (!res) return ['删除资产记录失败，资产记录可能已被删除', null]

  const latestRecord = await AssetRecord.findOne({ assetId: mongoose.Types.ObjectId(assetId), isDel: false }).sort({ date: -1 })
  
  if (latestRecord) {
    const updateRes = await Asset.findOneAndUpdate(
      { _id: mongoose.Types.ObjectId(assetId), isDel: false },
      { 
        latestAmount: latestRecord.amount, 
        lastUpdatedDate: latestRecord.date 
      },
      { new: true }
    )
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
  const query = { assetId: mongoose.Types.ObjectId(assetId), isDel: false }
  if (startDate || endDate) {
    query.date = {}
    if (startDate) query.date.$gte = startDate
    if (endDate) query.date.$lte = endDate
  }
  const res = await AssetRecord.find(query).sort({ date: -1 })
  return [null, res]
}
