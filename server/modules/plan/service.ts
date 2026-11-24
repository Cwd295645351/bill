import { toPlain, type Row } from '../../types/domain'
import { Bill, BillPlanBuy } from '../../database/index'
import { readBillRole } from '../access'
import type { Transaction as DbTransaction } from 'sequelize'

/** 只读取本账本的计划。账本不存在时返回 null */
export async function loadPlanBuy(billId: string | null | undefined, transaction?: DbTransaction | null) {
  const bill = await Bill.findByPk(billId, { transaction })
  if (!bill) return null
  const rows = await BillPlanBuy.findAll({ where: { billId }, transaction })
  return {
    details: rows.map((p: Row) => {
      const item = toPlain(p)
      return {
        id: item.id,
        title: item.title,
        context: item.context,
        priority: item.priority,
        isBuy: item.isBuy,
        isDel: item.isDel
      }
    })
  }
}

/** 查询账本计划。先确认成员，再读取未删除且未购买的计划 */
export const getList = async ({ userId, billId }: Row) => {
  const role = await readBillRole(userId, billId)
  if (role.kind === 'invalid' || role.kind === 'not_found') return ['未找到账本', null]
  if (role.kind !== 'member') return ['该用户并未加入此账本', null]
  const rows = await BillPlanBuy.findAll({ where: { billId, isDel: false, isBuy: false } })
  const details = rows.map((row: Row) => {
    const item = toPlain(row)
    return {
      id: item.id,
      title: item.title,
      context: item.context,
      priority: item.priority,
      isBuy: false,
      isDel: false
    }
  })
  return [null, { count: details.length, details }]
}

/** 新增账本计划 */
export const add = async ({ billId, userId, context, priority, title }: Row) => {
  if ((await readBillRole(userId, billId)).kind !== 'member') return ['该用户并未加入此账本', null]
  try {
    await BillPlanBuy.create({ billId, title, context, priority, isBuy: false, isDel: false })
    return [null, true]
  } catch (e: unknown) {
    console.error(e)
    return ['新增失败', null]
  }
}

/** 编辑账本计划。内容未变化时 MySQL 的影响行数是 0，再确认这条计划还在 */
export const edit = async ({ billId, id, userId, context, priority, title }: Row) => {
  if ((await readBillRole(userId, billId)).kind !== 'member') return ['该用户并未加入此账本', null]
  try {
    const [affected] = await BillPlanBuy.update(
      { title, context, priority },
      { where: { id, billId, isDel: false } }
    )
    if (!affected) {
      const exists = await BillPlanBuy.findOne({ where: { id, billId, isDel: false }, attributes: ['id'] })
      if (!exists) return ['不存在该计划', null]
    }
    return [null, true]
  } catch (e: unknown) {
    console.error(e)
    return ['编辑失败', null]
  }
}

/** 删除账本计划。只把这一行标成已删除 */
const removePlan = async ({ id, billId, userId }: { id: string; billId: string; userId: string }) => {
  if ((await readBillRole(userId, billId)).kind !== 'member') return ['该用户并未加入此账本', null]
  try {
    const [affected] = await BillPlanBuy.update({ isDel: true }, { where: { id, billId, isDel: false } })
    if (!affected) return ['不存在该计划', null]
    return [null, true]
  } catch (e: unknown) {
    console.error(e)
    return ['删除失败', null]
  }
}

export { removePlan as delete }
