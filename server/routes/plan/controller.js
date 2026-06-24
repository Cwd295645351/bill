const { findBillById, savePlanBuy, sequelize } = require('../../database/services/billService')

/** 查询账本计划 */
exports.getList = async ({ userId, billId }) => {
  const findBill = await findBillById(billId)
  if (!findBill) return ['未找到账本', null]
  if (!findBill.users.find((item) => item.id === userId)) return ['该用户并未加入此账本', null]
  const plans = JSON.parse(JSON.stringify(findBill.planBuy))
  if (!plans) ['查询失败', null]
  plans.details = plans.details.filter((item) => !item.isDel && !item.isBuy)
  plans.count = plans.details.length
  return [null, plans]
}

/** 新增账本计划 */
exports.add = async ({ billId, userId, context, priority, title }) => {
  const findBill = await findBillById(billId)
  if (!findBill) return ['未找到账本', null]
  if (!findBill.users.find((item) => item.id === userId)) return ['该用户并未加入此账本', null]
  const plans = findBill.planBuy
  plans.count++
  const addData = { title, context, priority, isBuy: false, idDel: false }
  plans.details.push(addData)
  const tx = await sequelize.transaction()
  try {
    await savePlanBuy(billId, plans, tx)
    await tx.commit()
    return [null, true]
  } catch (e) {
    await tx.rollback()
    console.error(e)
    return ['新增失败', null]
  }
}

/** 编辑账本计划 */
exports.edit = async ({ billId, id, userId, context, priority, title }) => {
  const findBill = await findBillById(billId)
  if (!findBill) return ['未找到账本', null]
  if (!findBill.users.find((item) => item.id === userId)) return ['该用户并未加入此账本', null]
  const planDetailItem = findBill.planBuy.details.find((item) => item.id === id && !item.isDel)
  if (!planDetailItem) return ['不存在该计划', null]
  planDetailItem.context = context
  planDetailItem.priority = priority
  planDetailItem.title = title
  const tx = await sequelize.transaction()
  try {
    await savePlanBuy(billId, findBill.planBuy, tx)
    await tx.commit()
    return [null, true]
  } catch (e) {
    await tx.rollback()
    console.error(e)
    return ['编辑失败', null]
  }
}

/** 删除账本计划 */
exports.delete = async ({ id, billId, userId }) => {
  const findBill = await findBillById(billId)
  if (!findBill) return ['未找到账本', null]
  if (!findBill.users.find((item) => item.id === userId)) return ['该用户并未加入此账本', null]
  const planDetailItem = findBill.planBuy.details.find((item) => item.id === id && !item.isDel)
  if (!planDetailItem) return ['不存在该计划', null]
  planDetailItem.isDel = true
  findBill.planBuy.count--
  const tx = await sequelize.transaction()
  try {
    await savePlanBuy(billId, findBill.planBuy, tx)
    await tx.commit()
    return [null, true]
  } catch (e) {
    await tx.rollback()
    console.error(e)
    return ['删除失败', null]
  }
}
