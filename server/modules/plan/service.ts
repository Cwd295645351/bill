import type { Row } from '../../types/domain'
import { Bill, BillPlanBuy, sequelize } from '../../database/index'
import { requireMember } from '../access'
import type { Transaction as DbTransaction } from 'sequelize'

/** 将模型实例转成普通对象 */
const toPlain = (row: Row): Row => (row && row.get ? row.get({ plain: true }) || row : row)

/** 只读取本账本的计划。账本不存在时返回 null */
export async function loadPlanBuy(billId: string | null | undefined, transaction?: DbTransaction | null) {
  const bill = await Bill.findByPk(billId, { transaction })
  if (!bill) return null
  const plain = toPlain(bill)
  const rows = await BillPlanBuy.findAll({ where: { billId }, transaction })
  return {
    count: Number(plain.planBuyCount || 0),
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

/** 保存 planBuy 结构。只在本模块使用 */
export async function savePlanBuy(
  billId: string | null | undefined,
  planBuy: { count?: number; details?: Row[] },
  transaction?: DbTransaction | null
) {
  await BillPlanBuy.destroy({ where: { billId }, transaction })
  if (planBuy.details && planBuy.details.length) {
    await BillPlanBuy.bulkCreate(
      planBuy.details.map((d) => ({
        id: d.id,
        billId,
        title: d.title,
        context: d.context,
        priority: d.priority,
        isBuy: d.isBuy || false,
        isDel: d.isDel || false
      })),
      { transaction }
    )
  }
  await Bill.update({ planBuyCount: planBuy.count || 0 }, { where: { id: billId }, transaction })
}

/** 查询账本计划 */
export const getList = async ({ userId, billId }: Row) => {
  const planBuy = await loadPlanBuy(billId)
  if (!planBuy) return ['未找到账本', null]
  if (!(await requireMember(userId, billId)).ok) return ['该用户并未加入此账本', null]
  const plans = JSON.parse(JSON.stringify(planBuy))
  if (!plans) ['查询失败', null]
  plans.details = plans.details.filter((item: Row) => !item.isDel && !item.isBuy)
  plans.count = plans.details.length
  return [null, plans]
}

/** 新增账本计划 */
export const add = async ({ billId, userId, context, priority, title }: Row) => {
  const plans = await loadPlanBuy(billId)
  if (!plans) return ['未找到账本', null]
  if (!(await requireMember(userId, billId)).ok) return ['该用户并未加入此账本', null]
  plans.count++
  const addData: Row = { title, context, priority, isBuy: false, isDel: false }
  plans.details.push(addData)
  const tx = await sequelize.transaction()
  try {
    await savePlanBuy(billId, plans, tx)
    await tx.commit()
    return [null, true]
  } catch (e: unknown) {
    await tx.rollback()
    console.error(e)
    return ['新增失败', null]
  }
}

/** 编辑账本计划 */
export const edit = async ({ billId, id, userId, context, priority, title }: Row) => {
  const planBuy = await loadPlanBuy(billId)
  if (!planBuy) return ['未找到账本', null]
  if (!(await requireMember(userId, billId)).ok) return ['该用户并未加入此账本', null]
  const planDetailItem = planBuy.details.find((item: Row) => item.id === id && !item.isDel)
  if (!planDetailItem) return ['不存在该计划', null]
  planDetailItem.context = context
  planDetailItem.priority = priority
  planDetailItem.title = title
  const tx = await sequelize.transaction()
  try {
    await savePlanBuy(billId, planBuy, tx)
    await tx.commit()
    return [null, true]
  } catch (e: unknown) {
    await tx.rollback()
    console.error(e)
    return ['编辑失败', null]
  }
}

/** 删除账本计划 */
const removePlan = async ({ id, billId, userId }: { id: string; billId: string; userId: string }) => {
  const planBuy = await loadPlanBuy(billId)
  if (!planBuy) return ['未找到账本', null]
  if (!(await requireMember(userId, billId)).ok) return ['该用户并未加入此账本', null]
  const planDetailItem = planBuy.details.find((item: Row) => item.id === id && !item.isDel)
  if (!planDetailItem) return ['不存在该计划', null]
  planDetailItem.isDel = true
  planBuy.count--
  const tx = await sequelize.transaction()
  try {
    await savePlanBuy(billId, planBuy, tx)
    await tx.commit()
    return [null, true]
  } catch (e: unknown) {
    await tx.rollback()
    console.error(e)
    return ['删除失败', null]
  }
}

export { removePlan as delete }
