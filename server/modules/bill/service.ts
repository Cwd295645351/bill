import type { Row } from '../../types/domain'
import { Bill, BillUser, BillCostType, BillIncomeType, BillPayMethod, User, sequelize } from '../../database/index'
import { encode, decode } from '../../utils/cryp'
import { requireCreator, requireMember } from '../access'
import { listActiveCatalogDefaults } from '../admin'

/** 按登录用户读取未删除账号的显示名 */
const nickNameOfUser = async (userId: string | null | undefined): Promise<[string | null, string | null]> => {
  if (!userId) return ['请先登录', null]
  const user = await User.findOne({
    where: { id: userId, isDel: false },
    attributes: ['nickName']
  })
  const nickName = user ? String((user as Row).nickName || '').trim() : ''
  if (!nickName) return ['用户昵称不能为空', null]
  return [null, nickName]
}

/** 账本是否存在。不附带类型、预算或计划 */
export const billExists = async (billId: string | null | undefined) => {
  if (!billId) return false
  const bill = await Bill.findByPk(billId)
  return !!bill
}

/** 账本成员名单，只含编号和名称，不用于权限判断 */
export const listMembers = async (billId: string | null | undefined) => {
  const rows = await BillUser.findAll({ where: { billId } })
  return rows.map((u: Row) => {
    const plain = u.get ? u.get({ plain: true }) : u
    return { id: plain.userId as string | undefined, name: plain.userName as string | undefined }
  })
}

// 查询账本列表
export const getBillList = async ({ userId }: Row) => {
  const rows = await Bill.findAll({
    where: { isDel: false },
    include: [{ model: BillUser, as: 'billUsers', where: { userId }, required: true }],
    attributes: ['id', 'creator', 'name']
  })
  const res = rows.map((r: Row) => ({ id: r.id, creator: r.creator, name: r.name }))
  return [null, res]
}

// 创建账本
export const createBill = async ({ userId, name }: Row) => {
  const [nickErr, nickName] = await nickNameOfUser(userId)
  if (nickErr || !nickName) return [nickErr || '用户昵称不能为空', null]
  const findBill = await Bill.findOne({ where: { name: name, creator: userId } })
  if (findBill) {
    return ['该名称的账本已存在', null]
  }
  const defaults = await listActiveCatalogDefaults()
  if (!defaults.cost.length || !defaults.income.length || !defaults.pay_method.length) {
    return ['默认类型模板未配置完整，无法创建账本', null]
  }
  const tx = await sequelize.transaction()
  try {
    const billRes = await Bill.create(
      { name: name, creator: userId, planBuyCount: 0, isDel: false, createdAt: new Date() },
      { transaction: tx }
    )
    await BillUser.create({ billId: billRes.id, userId, userName: nickName }, { transaction: tx })
    await BillCostType.bulkCreate(
      defaults.cost.map((c) => ({ id: c.id, billId: billRes.id, name: c.name, isDel: false })),
      { transaction: tx }
    )
    await BillIncomeType.bulkCreate(
      defaults.income.map((c) => ({ id: c.id, billId: billRes.id, name: c.name, isDel: false })),
      { transaction: tx }
    )
    await BillPayMethod.bulkCreate(
      defaults.pay_method.map((c) => ({ id: c.id, billId: billRes.id, name: c.name, isDel: false })),
      { transaction: tx }
    )
    await tx.commit()
    return [null, billRes.id]
  } catch (e: unknown) {
    await tx.rollback()
    console.error(e)
    return ['创建失败', null]
  }
}

// 编辑账本名称
export const editBill = async ({ id, name, userId }: Row) => {
  const member = await requireMember(userId, id)
  if (!member.ok) return ['不是该账本成员', null]
  const creator = await requireCreator(userId, id)
  if (!creator.ok) return ['只有账本创建者才能修改账本名称', null]
  const [affected] = await Bill.update({ name: name }, { where: { id, isDel: false } })
  if (affected) return [null, true]
  else return ['编辑失败', null]
}

// 删除账本
export const delBill = async ({ userId, id }: Row) => {
  const creator = await requireCreator(userId, id)
  if (!creator.ok) return ['找不到该账本或您非该账本的创建者', null]
  const [affected] = await Bill.update({ isDel: true }, { where: { id, isDel: false } })
  if (!affected) return ['找不到该账本或您非该账本的创建者', null]
  return [null, true]
}

// 查询账本详情
export const getBillDetail = async ({ userId, id }: Row) => {
  const member = await requireMember(userId, id)
  if (!member.ok) return ['找不到账本', null]
  const bill = await Bill.findByPk(id)
  if (!bill) return ['找不到账本', null]
  const plain = bill.get ? bill.get({ plain: true }) : bill
  const { loadOverviewRules, loadTypeLists } = await import('../catalog')
  const { loadBudgets } = await import('../budget')
  const { loadPlanBuy } = await import('../plan')
  const [users, types, overviewRules, planBuy, budget] = await Promise.all([
    listMembers(id),
    loadTypeLists(id),
    loadOverviewRules(id),
    loadPlanBuy(id),
    loadBudgets(id)
  ])
  return [null, {
    id: plain.id,
    name: plain.name,
    creator: plain.creator,
    isDel: plain.isDel,
    users,
    costTypes: types.costTypes,
    incomesTypes: types.incomesTypes,
    payMethods: types.payMethods,
    overviewRules,
    planBuy: planBuy || { count: Number(plain.planBuyCount || 0), details: [] },
    budget
  }]
}

// 用公钥生成将id和有效时间生成密文
export const invite = async ({ userId, id }: Row) => {
  const creator = await requireCreator(userId, id)
  if (!creator.ok) return ['找不到账本', null]

  const date = Number(new Date().getTime()) + 30 * 60 * 1000 // 过期时间
  const key = `${id}&${date}`
  try {
    const sign = encode(key)
    return [null, sign]
  } catch (e: unknown) {
    console.log(e)
    return ['生成邀请码失败', null]
  }
}

// 加入某个账本
export const joinBill = async ({ userId, code }: Row) => {
  const [nickErr, nickName] = await nickNameOfUser(userId)
  if (nickErr || !nickName) return [nickErr || '用户昵称不能为空', null]
  let billId = ''
  try {
    const sign = decode(code || '')
    const keys = sign.split('&')
    const expiredTime = keys[1]
    billId = keys[0]
    // 邀请码过期
    if (new Date().getTime() > Number(expiredTime)) return ['邀请码已失效', null]
  } catch (e: unknown) {
    console.log(e)
    return ['密钥不正确', null]
  }
  try {
    // 查找账本是否存在，并判断是否已加入该账本
    const findBill = await Bill.findOne({ where: { id: billId, isDel: false } })
    if (!findBill) return ['该账本不存在', null]
    const exist = await requireMember(userId, billId)
    if (exist.ok) return ['已加入该账本', null]
    const billRes = await BillUser.create({ billId, userId, userName: nickName })
    if (!billRes) return ['加入账本失败', null]
    return [null, true]
  } catch (e: unknown) {
    console.log(e)
    return ['加入账本失败', null]
  }
}

// 退出账本
export const quitBill = async ({ userId, id }: Row) => {
  const billRes = await Bill.findOne({ where: { id, isDel: false } })
  if (!billRes) return ['找不到账本', null]
  const creator = await requireCreator(userId, id)
  if (creator.ok) return ['创建者不能退出账本', null]
  const member = await requireMember(userId, id)
  if (!member.ok) return ['您并未加入该账本', null]
  const affected = await BillUser.destroy({ where: { billId: id, userId } })
  if (!affected) return ['您并未加入该账本', null]
  return [null, true]
}

// 将某人移出账本（仅创建者；不可移除创建者本人）
export const removePerson = async ({ operatorId, userId, id }: Row) => {
  const billRes = await Bill.findOne({ where: { id, isDel: false } })
  if (!billRes) return ['找不到账本', null]
  const creator = await requireCreator(operatorId, id)
  if (!creator.ok) return ['仅账本创建者可移除成员', null]
  if (String(userId) === String(operatorId)) return ['不能移除自己，请使用退出账本', null]
  if (String(billRes.creator) === String(userId)) return ['不能移除账本创建者', null]
  const exist = await requireMember(userId, id)
  if (!exist.ok) return ['该用户并未加入此账本', null]
  await BillUser.destroy({ where: { billId: id, userId } })
  return [null, true]
}
