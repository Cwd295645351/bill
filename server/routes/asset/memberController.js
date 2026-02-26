const Member = require('../../database/modules/Member')
const mongoose = require('../../database/index')

exports.getMemberList = async ({ billId }) => {
  if (!billId) return ['账本id不能为空', null]
  const res = await Member.find({ billId: mongoose.Types.ObjectId(billId), isDel: false })
  return [null, res]
}

exports.addMember = async ({ name, billId }) => {
  if (!name) return ['成员名称不能为空', null]
  if (!billId) return ['账本id不能为空', null]
  const res = await Member.create({ name, billId: mongoose.Types.ObjectId(billId) })
  if (res) return [null, res]
  return ['创建成员失败', null]
}

exports.editMember = async ({ id, name }) => {
  if (!name) return ['成员名称不能为空', null]
  if (!id) return ['成员id不能为空', null]
  const res = await Member.findOneAndUpdate(
    { _id: mongoose.Types.ObjectId(id), isDel: false },
    { name },
    { new: true }
  )
  if (res) return [null, res]
  return ['编辑成员失败，成员可能已被删除', null]
}

exports.delMember = async ({ id }) => {
  if (!id) return ['成员id不能为空', null]
  const res = await Member.findOneAndUpdate(
    { _id: mongoose.Types.ObjectId(id), isDel: false },
    { isDel: true },
    { new: true }
  )
  if (res) return [null, true]
  return ['删除成员失败，成员可能已被删除', null]
}
