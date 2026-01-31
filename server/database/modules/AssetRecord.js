const mongoose = require('../index')

/**
 * 资产流水表（历史记录）
 * 存储资产在不同时间点的金额快照
 */
const AssetRecordSchema = mongoose.Schema({
  assetId: { type: mongoose.Schema.Types.ObjectId, ref: 'assets', required: true }, // 关联的资产 ID
  amount: { type: Number, required: true }, // 当时金额
  date: {
    type: Number,
    required: true,
    default: Date.now
  }, // 记录日期 (时间戳)
  isDel: { type: Boolean, required: true, default: false } // 是否删除
})

AssetRecordSchema.set('toJSON', { getters: true })

const AssetRecord = mongoose.model('assetRecords', AssetRecordSchema)

module.exports = AssetRecord
