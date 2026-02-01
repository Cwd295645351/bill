const mongoose = require('../index')

/**
 * 家庭成员模型
 */
const MemberSchema = mongoose.Schema({
  billId: { type: mongoose.Schema.Types.ObjectId, ref: 'bills', required: true }, // 所属账本
  name: { type: String, required: true }, // 成员名称
  isDel: { type: Boolean, required: true, default: false } // 是否删除
})

const Member = mongoose.model('members', MemberSchema)

module.exports = Member
