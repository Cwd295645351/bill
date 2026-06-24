const { Bill, BillUser, BillCostType, BillIncomeType, BillPayMethod } = require('../../database/index')
const { encode, decode } = require('../../utils/cryp')
const InitData = require('../../database/initDatas')
const { findBillById, sequelize } = require('../../database/services/billService')

// 查询账本列表
exports.getBillList = async ({ userId, nickName }) => {
  const rows = await Bill.findAll({
    where: { isDel: false },
    include: [{ model: BillUser, as: 'billUsers', where: { userId, userName: nickName }, required: true }],
    attributes: ['id', 'creator', 'name']
  })
  const res = rows.map((r) => ({ id: r.id, creator: r.creator, name: r.name }))
  return [null, res]
}

// 创建账本
exports.createBill = async ({ userId, name, nickName }) => {
  const findBill = await Bill.findOne({ where: { name: name, creator: userId } })
  if (findBill) {
    return ['该名称的账本已存在', null]
  }
  const tx = await sequelize.transaction()
  try {
    const billRes = await Bill.create(
      { name: name, creator: userId, planBuyCount: 0, isDel: false },
      { transaction: tx }
    )
    await BillUser.create({ billId: billRes.id, userId, userName: nickName }, { transaction: tx })
    await BillCostType.bulkCreate(
      InitData.costTypes.map((c) => ({ id: c.id, billId: billRes.id, name: c.name, isDel: false })),
      { transaction: tx }
    )
    await BillIncomeType.bulkCreate(
      InitData.incomesTypes.map((c) => ({ id: c.id, billId: billRes.id, name: c.name, isDel: false })),
      { transaction: tx }
    )
    await BillPayMethod.bulkCreate(
      InitData.payMethods.map((c) => ({ id: c.id, billId: billRes.id, name: c.name, isDel: false })),
      { transaction: tx }
    )
    await tx.commit()
    return [null, billRes.id]
  } catch (e) {
    await tx.rollback()
    console.error(e)
    return ['创建失败', null]
  }
}

// 编辑账本名称
exports.editBill = async ({ id, name }) => {
  const [affected] = await Bill.update({ name: name }, { where: { id, isDel: false } })
  if (affected) return [null, true]
  else return ['编辑失败', null]
}

// 删除账本
exports.delBill = async ({ userId, id }) => {
  const [affected] = await Bill.update({ isDel: true }, { where: { id, creator: userId, isDel: false } })
  if (!affected) return ['找不到该账本或您非该账本的创建者', null]
  return [null, true]
}

// 查询账本详情
exports.getBillDetail = async ({ userId, id, nickName }) => {
  // 校验用户是否在账本内
  const link = await BillUser.findOne({ where: { billId: id, userId, userName: nickName } })
  if (!link) return ['找不到账本', null]
  const res = await findBillById(id)
  if (res) return [null, res]
  return ['找不到账本', null]
}

// 用公钥生成将id和有效时间生成密文
exports.invite = async ({ userId, id }) => {
  // 查找该用户是否是账本的持有者
  const billRes = await Bill.findOne({ where: { id, creator: userId, isDel: false } })
  if (!billRes) return ['找不到账本', null]

  const date = Number(new Date().getTime()) + 30 * 60 * 1000 // 过期时间
  const key = `${id}&${date}`
  try {
    const sign = encode(key)
    return [null, sign]
  } catch (e) {
    console.log(e)
    return ['生成邀请码失败', null]
  }
}

// 加入某个账本
exports.joinBill = async ({ userId, code, nickName }) => {
  let billId = ''
  try {
    const sign = decode(code)
    const keys = sign.split('&')
    const expiredTime = keys[1]
    billId = keys[0]
    // 邀请码过期
    if (new Date().getTime() > expiredTime) return ['邀请码已失效', null]
  } catch (e) {
    console.log(e)
    return ['密钥不正确', null]
  }
  try {
    // 查找账本是否存在，并判断是否已加入该账本
    const findBill = await Bill.findOne({ where: { id: billId, isDel: false } })
    if (!findBill) return ['该账本不存在', null]
    const exist = await BillUser.findOne({ where: { billId, userId } })
    if (exist) return ['已加入该账本', null]
    const billRes = await BillUser.create({ billId, userId, userName: nickName })
    if (!billRes) return ['加入账本失败', null]
    return [null, true]
  } catch (e) {
    console.log(e)
    return ['加入账本失败', null]
  }
}

// 退出账本
exports.quitBill = async ({ userId, id, nickName }) => {
  // 从该账本中查找是否存在该用户，若存在则退出账本
  const billRes = await Bill.findOne({ where: { id, isDel: false } })
  if (!billRes) return ['找不到账本', null]
  if (billRes.creator === userId) return ['创建者不能退出账本', null]
  const [affected] = await BillUser.destroy({ where: { billId: id, userId, userName: nickName } })
  if (!affected) return ['您并未加入该账本', null]
  return [null, true]
}

// 将某个移出账本
exports.removePerson = async ({ userId, id, nickName }) => {
  // 从该账本中查找是否存在该用户，若存在则移除
  const billRes = await Bill.findOne({ where: { id, isDel: false } })
  if (!billRes) return ['找不到账本', null]
  const exist = await BillUser.findOne({ where: { billId: id, userId, userName: nickName } })
  if (!exist) return ['该用户并未加入此账本', null]
  await BillUser.destroy({ where: { billId: id, userId, userName: nickName } })
  return [null, true]
}
