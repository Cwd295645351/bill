const mongoose = require('../index')

/**
 * 资产模型
 * 代表一个具体的资产项（如：招行卡、平安保险）
 */
const AssetSchema = mongoose.Schema({
  name: { type: String, required: true }, // 资产名称
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'members', required: true }, // 所属成员 ID
  // 资产类型：流动资金、固定资金、投资理财、应收款、负债
  type: { type: String, required: true }, 
  // 四笔钱类型：living (活钱), steady (稳健), longterm (长期), insurance (保险)
  fourMoneyType: { type: String, required: true }, 
  isDebt: { type: Boolean, required: true, default: false }, // 是否负债
  latestAmount: { type: Number, required: true, default: 0 }, // 最新金额
  
  // 保险专项信息
  insuranceCategory: { type: String, required: false }, // 意外、医疗、重疾、寿险、其他
  annualPremium: { type: Number, required: false, default: 0 }, // 年交保费
  
  lastUpdatedDate: { type: Number, default: Date.now }, // 最近更新时间 (时间戳)
  sort: { type: Number, default: 0 }, // 排序
  isDel: { type: Boolean, required: true, default: false } // 是否删除
})

const Asset = mongoose.model('assets', AssetSchema)

module.exports = Asset
