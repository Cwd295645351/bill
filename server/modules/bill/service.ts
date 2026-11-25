import type { Row } from '../../types/domain'
import { Bill, BillUser, BillCostType, BillIncomeType, BillPayMethod, User, sequelize } from '../../database/index'
import { encode, decode } from '../../utils/cryp'
import { readBillRole, type BillRole } from '../access'
import { listActiveCatalogDefaults } from '../admin'

/** 仅创建者可做的账本操作。账本不存在、不是成员、不是创建者各用一句说明 */
const creatorOnlyDenial = (role: BillRole, creatorMessage: string) => {
  if (role.kind === 'invalid' || role.kind === 'not_found') return '找不到账本'
  if (role.kind !== 'member') return '不是该账本成员'
  if (!role.isCreator) return creatorMessage
  return null
}

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
  const findBill = await Bill.findOne({ where: { name: name, creator: userId, isDel: false } })
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
      { name: name, creator: userId, isDel: false, createdAt: new Date() },
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

// 编辑账本名称。名称有变化时三次访问：读身份、查重名、再更新
export const editBill = async ({ id, name, userId }: Row) => {
  const role = await readBillRole(userId, id)
  if (role.kind !== 'member') return ['不是该账本成员', null]
  if (!role.isCreator) return ['只有账本创建者才能修改账本名称', null]
  if (String(role.bill.name) === String(name)) return [null, true]
  const named = await Bill.findOne({
    where: { name, creator: role.bill.creator, isDel: false },
    attributes: ['id']
  })
  if (named && String(named.id) !== String(role.bill.id)) return ['该名称的账本已存在', null]
  const [affected] = await Bill.update({ name }, { where: { id: role.bill.id, isDel: false } })
  if (!affected) return ['编辑失败', null]
  return [null, true]
}

// 删除账本
export const delBill = async ({ userId, id }: Row) => {
  const role = await readBillRole(userId, id)
  const denied = creatorOnlyDenial(role, '只有账本创建者才能删除账本')
  if (denied) return [denied, null]
  const [affected] = await Bill.update({ isDel: true }, { where: { id, isDel: false } })
  if (!affected) return ['找不到账本', null]
  return [null, true]
}

// 查询账本详情
export const getBillDetail = async ({ userId, id }: Row) => {
  const role = await readBillRole(userId, id)
  if (role.kind !== 'member') return ['找不到账本', null]
  const plain = role.bill
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
    isDel: false,
    users,
    costTypes: types.costTypes,
    incomesTypes: types.incomesTypes,
    payMethods: types.payMethods,
    overviewRules,
    planBuy: planBuy || { details: [] },
    budget
  }]
}

// 用公钥生成将id和有效时间生成密文
export const invite = async ({ userId, id }: Row) => {
  const role = await readBillRole(userId, id)
  const denied = creatorOnlyDenial(role, '只有账本创建者才能生成邀请码')
  if (denied) return [denied, null]

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
    const role = await readBillRole(userId, billId)
    if (role.kind === 'invalid' || role.kind === 'not_found') return ['该账本不存在', null]
    if (role.kind === 'member') return ['已加入该账本', null]
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
  const role = await readBillRole(userId, id)
  if (role.kind === 'invalid' || role.kind === 'not_found') return ['找不到账本', null]
  if (role.kind === 'member' && role.isCreator) return ['创建者不能退出账本', null]
  if (role.kind !== 'member') return ['您并未加入该账本', null]
  const affected = await BillUser.destroy({ where: { billId: id, userId } })
  if (!affected) return ['您并未加入该账本', null]
  return [null, true]
}

// 将某人移出账本（仅创建者；不可移除创建者本人）
export const removePerson = async ({ operatorId, userId, id }: Row) => {
  const role = await readBillRole(operatorId, id)
  const denied = creatorOnlyDenial(role, '仅账本创建者可移除成员')
  if (denied || role.kind !== 'member') return [denied || '不是该账本成员', null]
  if (String(userId) === String(operatorId)) return ['不能移除自己，请使用退出账本', null]
  if (String(role.bill.creator) === String(userId)) return ['不能移除账本创建者', null]
  const target = await readBillRole(userId, id)
  if (target.kind !== 'member') return ['该用户并未加入此账本', null]
  await BillUser.destroy({ where: { billId: id, userId } })
  return [null, true]
}
