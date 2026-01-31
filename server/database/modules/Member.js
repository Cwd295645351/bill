const mongoose = require('../index')

/**
 * 家庭成员模型
 */
const MemberSchema = mongoose.Schema({
  name: { type: String, required: true }, // 成员名称
  avatarUrl: { type: String, required: false, default: '' }, // 头像地址
  isDel: { type: Boolean, required: true, default: false } // 是否删除
})

const Member = mongoose.model('members', MemberSchema)

module.exports = Member
