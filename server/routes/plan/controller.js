const Bill = require('../../database/modules/Bills')

/** 查询账本计划 */
exports.getList = async (data) => {
  data.date = Number(data.date)
  const findBill = await Bill.findById(data.billId, { users: 1, planBuy: 1 })
  if (!findBill) return ['未找到账本', null]
  if (!findBill.users.find((item) => item.id === data.userId)) return ['该用户并未加入此账本', null]
  console.log(findBill);
  const res = findBill.planBuy
  if (res) return [null, res]
  else return ['查询失败', null]
}
