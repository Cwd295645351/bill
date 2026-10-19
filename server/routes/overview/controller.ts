import type { Row, WhereBag } from '../../types/domain'
import { Transaction, BillUser, BillOverviewRule, User } from '../../database/index'
import dayjs from 'dayjs'
import { Op } from 'sequelize'
import { buildSettlement } from '../../database/services/overviewSettlement'
import { toBelongResponse } from '../../database/services/belongUsers'

/** 金额保留两位小数（返回 number） */
const fixMoney = (n: number | string | null | undefined) => Number(Number(n).toFixed(2))

interface RankItem {
  type?: string | number | null
  name?: string | null
  money: number
  belongUserId?: string | null
  belongUserName?: string | null
  userId?: string | null
}

// 查询收支和各归属人概况
export const getBlance = async (data: Row, userId?: string | null | undefined) => {
  const params: WhereBag = {
    billId: data.billId,
    date: { [Op.between]: [data.beginDate, data.endDate] },
    isDel: false
  }
  const res = await Transaction.findAll({
    where: params,
    attributes: ['type', 'money', 'belongUserId', 'costTypeId', 'costTypeName', 'belongUserName', 'userId']
  })
  let totalCost = 0,
    totalIncomes = 0,
    investCost = 0,
    belongUserCosts: RankItem[] = [],
    costTypeRank: Record<string, RankItem[]> = {}
  res.forEach((item: Row) => {
    const money = Number(item.money)
    if (item.type === 1) {
      // 支出
      totalCost += money
      if (item.costTypeId === '1015') {
        // 投资支出
        investCost += money
      }
    } else {
      // 收入
      totalIncomes += money
    }
    // 统计各个归属人收支金额
    const user = belongUserCosts.find((ite) => ite.type === item.type && ite.belongUserId === item.belongUserId && ite.userId === item.userId)
    if (user) {
      user.money = (user.money || 0) + money
    } else {
      belongUserCosts.push({
        type: item.type,
        belongUserId: item.belongUserId,
        belongUserName: item.belongUserName,
        userId: item.userId,
        money
      })
    }

    // 只统计支出
    if (item.type === 1) {
      const belongName = String(item.belongUserName)
      if (costTypeRank[belongName]) {
        // 有对应归属人类型
        const costType = costTypeRank[belongName].find((ite) => ite.type === item.costTypeId)
        if (costType) {
          costType.money += money
        } else {
          costTypeRank[belongName].push({ type: item.costTypeId, name: item.costTypeName, money })
        }
      } else {
        costTypeRank[belongName] = [
          {
            type: item.costTypeId,
            name: item.costTypeName,
            money
          }
        ]
      }
    }
  })

  const belongCosts = belongUserCosts.map((item) =>
    toBelongResponse({ ...item, money: fixMoney(item.money) } as Row)
  )
  Object.keys(costTypeRank).forEach((key) => {
    costTypeRank[key].forEach((item) => {
      item.money = fixMoney(item.money)
    })
  })

  const result = {
    totalCost: fixMoney(totalCost),
    totalIncomes: fixMoney(totalIncomes),
    investCost: fixMoney(investCost),
    belongUserCosts: belongCosts,
    costTypeRank
  }

  if (res) return [null, result]
  else return ['查询失败', null]
}

// 查询过去三年的支出类型
export const getCosts = async (billId: string | null | undefined) => {
  const date = new Date()
  const lastYear = dayjs(date).subtract(1, 'year')
  const twoYearBefore = dayjs(date).subtract(2, 'year')
  const threeYearBefore = dayjs(date).subtract(3, 'year')

  const params: WhereBag = {
    billId: billId,
    type: 1,
    isDel: false
  }
  params.date = { [Op.between]: [lastYear.startOf('year').valueOf(), lastYear.endOf('year').valueOf()] }
  const lastYearRes = await Transaction.findAll({ where: params, attributes: ['money', 'costTypeId', 'costTypeName'] })
  params.date = { [Op.between]: [twoYearBefore.startOf('year').valueOf(), twoYearBefore.endOf('year').valueOf()] }
  const twoYearBeforeRes = await Transaction.findAll({ where: params, attributes: ['money', 'costTypeId', 'costTypeName'] })
  params.date = { [Op.between]: [threeYearBefore.startOf('year').valueOf(), threeYearBefore.endOf('year').valueOf()] }
  const threeYearBeforeRes = await Transaction.findAll({ where: params, attributes: ['money', 'costTypeId', 'costTypeName'] })

  const res: Row[] = [
    { name: lastYear.format('YYYY'), datas: lastYearRes },
    { name: twoYearBefore.format('YYYY'), datas: twoYearBeforeRes },
    { name: threeYearBefore.format('YYYY'), datas: threeYearBeforeRes }
  ]
  const result = batchDeal(res)
  return [null, result]
}

interface CostPoint {
  id?: string | number | null
  name?: string
  value?: number
}

const batchDeal = (groups: { name?: string; datas?: Row[] }[]) => {
  // 对一年的数据进行处理
  const deal = (rows: Row[] | undefined) => {
    const result: CostPoint[] = []
    ;(rows || []).forEach((item) => {
      const money = Number(item.money)
      const typeObj = result.find((ite) => ite.id === item.costTypeId)
      if (typeObj) {
        typeObj.value = (typeObj.value || 0) + money
      } else {
        result.push({ id: item.costTypeId, name: item.costTypeName, value: money })
      }
    })
    result.forEach((item) => {
      item.value = fixMoney(item.value)
    })
    return result
  }

  // 补充剩余的支出类型
  const completeType = (array: { datas: CostPoint[]; length: number }[], maxLength: number, maxData: CostPoint[]) => {
    array.forEach((item) => {
      if (item.length !== maxLength) {
        const noData = maxData.filter((ite) => !item.datas.find((it) => it.id === ite.id))
        noData.forEach((ite) => {
          const obj = Object.assign({}, ite)
          obj.value = fixMoney(0)
          item.datas.push(obj)
        })
      }
    })
  }
  const result = groups.map((item) => {
    const datas = deal(item.datas)
    return {
      name: item.name,
      datas: datas,
      length: datas.length
    }
  })
  const length1 = result[0].length
  const length2 = result[1].length
  const length3 = result[2].length

  const maxLength = Math.max(length1, length2, length3)

  const maxData = result.find((item) => item.length === maxLength)!.datas
  completeType(result, maxLength, maxData)

  result.forEach((item) => {
    item.datas = item.datas.sort((a, b) => Number(a.id) - Number(b.id))
  })

  return {
    type: result[0].datas.map((item) => item.name),
    datas: result.map((item) => {
      return { name: item.name, datas: item.datas.map((ite) => ite.value) }
    })
  }
}

/**
 * 校验数量规则输入。通过时返回归一化后的数组。
 * 未出现在请求里的已启用数量规则按数量 0。
 */
const normalizeQuantityInputs = (
  rawInputs: Row[] | null | undefined,
  enabledRules: Row[],
  memberIds: Set<string>
): [string | null, { ruleId: string; quantity: number; belongUserId: string }[] | null] => {
  const inputs = Array.isArray(rawInputs) ? rawInputs : []
  const quantityRules = enabledRules.filter((rule) => rule.ruleType === 'quantity')
  const ruleById = new Map<string, Row>(quantityRules.map((rule) => [rule.id || '', rule]))
  const seen = new Set()
  const normalized: { ruleId: string; quantity: number; belongUserId: string }[] = []
  for (const input of inputs) {
    const ruleId = input && input.ruleId
    const rule = ruleId ? ruleById.get(ruleId) : undefined
    if (!ruleId || !rule) return ['数量规则不存在或未启用', null]
    if (seen.has(ruleId)) continue
    seen.add(ruleId)
    const rawQty = input.quantity
    const quantity = rawQty === undefined || rawQty === null || rawQty === '' ? 0 : Number(rawQty)
    if (!Number.isFinite(quantity) || quantity < 0) return [`${rule.name}数量不能为负`, null]
    const belongUserId = input.belongUserId || ''
    if (quantity > 0 && !memberIds.has(belongUserId)) return ['归属人不是该账本成员', null]
    normalized.push({ ruleId, quantity, belongUserId })
  }
  quantityRules.forEach((rule) => {
    if (rule.id && !seen.has(rule.id)) normalized.push({ ruleId: rule.id, quantity: 0, belongUserId: '' })
  })
  return [null, normalized]
}

/** 多人分账。不改总支出等汇总口径 */
export const getSettlement = async (data: Row, userId: string | null | undefined) => {
  const member = await BillUser.findOne({ where: { billId: data.billId, userId } })
  if (!member) return ['不是该账本成员', null]

  const billUsers = await BillUser.findAll({
    where: { billId: data.billId },
    order: [['id', 'ASC']]
  })
  const enabledRules = await BillOverviewRule.findAll({
    where: { billId: data.billId, enabled: true }
  })
  const memberIds = new Set<string>()
  for (const item of billUsers as Row[]) {
    if (typeof item.userId === 'string' && item.userId) memberIds.add(item.userId)
  }
  const [inputErr, quantityInputs] = normalizeQuantityInputs(data.quantityInputs, enabledRules as Row[], memberIds)
  if (inputErr) return [inputErr, null]

  const rows = await Transaction.findAll({
    where: {
      billId: data.billId,
      date: { [Op.between]: [data.beginDate, data.endDate] },
      isDel: false
    },
    attributes: ['id', 'type', 'money', 'belongUserId', 'costTypeId', 'costTypeName', 'belongUserName', 'userId']
  })

  const outsiderIds = [
    ...new Set(
      (rows as Row[]).map((row) => row.userId).filter((userId): userId is string => !!userId && !memberIds.has(userId))
    )
  ]
  const outsiderUsers = outsiderIds.length
    ? await User.findAll({ where: { id: { [Op.in]: outsiderIds } }, attributes: ['id', 'nickName'] })
    : []
  const outsiderNames = new Map<string, string>(outsiderUsers.map((item: Row) => [item.id || '', item.nickName || '']))
  const memberNames = new Map<string, string>(billUsers.map((item: Row) => [item.userId || '', item.userName || '']))

  const result = buildSettlement({
    members: billUsers.map((item: Row) => ({ userId: item.userId, name: item.userName })),
    rules: enabledRules.map((item: Row) => ({
      id: item.id,
      name: item.name,
      ruleType: item.ruleType,
      unitPrice: item.unitPrice,
      costTypeId: item.costTypeId
    })),
    quantityInputs: quantityInputs || [],
    transactions: rows.map((row: Row) => ({
      id: row.id,
      type: row.type,
      money: row.money,
      userId: row.userId,
      payerName: memberNames.get(row.userId || '') || outsiderNames.get(row.userId || '') || '未知',
      belongUserId: row.belongUserId,
      belongUserName: row.belongUserName,
      costTypeId: row.costTypeId,
      costTypeName: row.costTypeName
    }))
  })
  return [null, result]
}
