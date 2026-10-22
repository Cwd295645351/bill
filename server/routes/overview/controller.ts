import type { Row, WhereBag } from '../../types/domain'
import { Transaction, BillUser, BillOverviewRule, BillOverviewRuleYear, User } from '../../database/index'
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

interface YearGroupInput {
  name: string
  datas?: Row[]
  totalIncome: number
  memberIncomes: Record<string, number>
  memberExpenses: Record<string, number>
}

// 查询近五年的收支概况与支出类型
export const getCosts = async (billId: string | null | undefined) => {
  if (!billId) return ['账本id不能为空', null]

  const billUsers = await BillUser.findAll({
    where: { billId },
    order: [['id', 'ASC']]
  })
  const enabledRules = await BillOverviewRule.findAll({
    where: { billId, enabled: true }
  })
  const memberList = (billUsers as Row[]).map((u) => ({
    userId: String(u.userId || ''),
    name: String(u.userName || '')
  }))

  const now = dayjs()
  const years: string[] = []
  for (let i = 0; i < 5; i++) {
    years.push(now.subtract(i, 'year').format('YYYY'))
  }

  const groups: YearGroupInput[] = []

  for (const yearStr of years) {
    const yearNum = Number(yearStr)
    const beginDate = dayjs().year(yearNum).startOf('year').valueOf()
    const endDate = dayjs().year(yearNum).endOf('year').valueOf()

    const txRows = await Transaction.findAll({
      where: {
        billId,
        date: { [Op.between]: [beginDate, endDate] },
        isDel: false
      },
      attributes: ['id', 'type', 'money', 'belongUserId', 'costTypeId', 'costTypeName', 'belongUserName', 'userId']
    })

    const expenseRows = (txRows as Row[]).filter((r) => Number(r.type) === 1)
    const totalIncome = fixMoney(
      (txRows as Row[])
        .filter((r) => Number(r.type) !== 1)
        .reduce((sum, r) => sum + Number(r.money || 0), 0)
    )

    // 查询该年保存的数量型规则
    const savedYears = await BillOverviewRuleYear.findAll({
      where: { billId, year: yearNum }
    })
    const savedMap = new Map<string, { quantity: number; belongUserId: string }>()
    ;(savedYears as Row[]).forEach((item) => {
      savedMap.set(String(item.ruleId), {
        quantity: Number(item.quantity) || 0,
        belongUserId: item.belongUserId ? String(item.belongUserId) : ''
      })
    })

    const quantityInputs = (enabledRules as Row[])
      .filter((r) => r.ruleType === 'quantity')
      .map((r) => {
        const saved = savedMap.get(String(r.id))
        return {
          ruleId: String(r.id),
          quantity: saved ? saved.quantity : 0,
          belongUserId: saved ? saved.belongUserId : ''
        }
      })

    const settlement = buildSettlement({
      members: memberList,
      rules: (enabledRules as Row[]).map((r) => ({
        id: String(r.id),
        name: r.name,
        ruleType: r.ruleType,
        unitPrice: r.unitPrice,
        costTypeId: r.costTypeId
      })),
      quantityInputs,
      transactions: (txRows as Row[]).map((r) => ({
        type: r.type,
        money: r.money,
        userId: r.userId,
        belongUserId: r.belongUserId,
        belongUserName: r.belongUserName,
        costTypeId: r.costTypeId,
        costTypeName: r.costTypeName
      }))
    })

    const memberIncomes: Record<string, number> = {}
    const memberExpenses: Record<string, number> = {}
    settlement.members.forEach((m) => {
      memberIncomes[m.name] = Number(m.income) || 0
      memberExpenses[m.name] = Number(m.borne) || 0
    })

    groups.push({
      name: yearStr,
      datas: expenseRows,
      totalIncome,
      memberIncomes,
      memberExpenses
    })
  }

  const result = batchDeal(groups, memberList)
  return [null, result]
}

const batchDeal = (
  groups: YearGroupInput[],
  members: { userId: string; name: string }[]
) => {
  // 对一年的支出数据进行汇总
  const deal = (rows: Row[] | undefined) => {
    const map = new Map<string, { id: string; name: string; value: number }>()
    ;(rows || []).forEach((item) => {
      const money = Number(item.money) || 0
      const id = String(item.costTypeId || '')
      const name = String(item.costTypeName || '未分类')
      if (map.has(id)) {
        map.get(id)!.value += money
      } else {
        map.set(id, { id, name, value: money })
      }
    })
    return map
  }

  // 汇总所有年份出现过的支出类型
  const allTypes = new Map<string, string>()
  const yearlyMaps = groups.map((g) => {
    const map = deal(g.datas)
    map.forEach((item, id) => {
      if (!allTypes.has(id)) {
        allTypes.set(id, item.name)
      }
    })
    return map
  })

  // 按 costTypeId 升序排序
  const sortedTypeIds = Array.from(allTypes.keys()).sort((a, b) => Number(a) - Number(b))
  const typeNames = sortedTypeIds.map((id) => allTypes.get(id) || '')

  const datas = groups.map((g, idx) => {
    const map = yearlyMaps[idx]
    const values = sortedTypeIds.map((id) => {
      const item = map.get(id)
      return item ? fixMoney(item.value) : 0
    })
    return {
      name: g.name,
      datas: values,
      totalIncome: g.totalIncome,
      memberIncomes: g.memberIncomes,
      memberExpenses: g.memberExpenses
    }
  })

  return {
    type: typeNames,
    members,
    datas
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

  const queryYear = data.beginDate ? dayjs(Number(data.beginDate)).year() : dayjs().year()
  const savedYears = await BillOverviewRuleYear.findAll({
    where: { billId: data.billId, year: queryYear }
  })
  const savedYearMap = new Map<string, { quantity: number; belongUserId: string }>()
  ;(savedYears as Row[]).forEach((item) => {
    savedYearMap.set(String(item.ruleId), {
      quantity: Number(item.quantity) || 0,
      belongUserId: item.belongUserId ? String(item.belongUserId) : ''
    })
  })

  let rawInputs = data.quantityInputs
  if (!Array.isArray(rawInputs) || !rawInputs.length) {
    rawInputs = (enabledRules as Row[])
      .filter((r) => r.ruleType === 'quantity')
      .map((r) => {
        const saved = savedYearMap.get(String(r.id))
        return {
          ruleId: r.id,
          quantity: saved ? saved.quantity : 0,
          belongUserId: saved ? saved.belongUserId : ''
        }
      })
  }

  const [inputErr, quantityInputs] = normalizeQuantityInputs(rawInputs, enabledRules as Row[], memberIds)
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
