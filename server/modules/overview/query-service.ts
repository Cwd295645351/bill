import type { Row, WhereBag } from '../../types/domain'
import { Transaction, BillUser, BillOverviewRule, BillOverviewRuleYear, User } from '../../database/index'
import dayjs from 'dayjs'
import { Op } from 'sequelize'
import { buildSettlement } from './settlement'
import { requireMember } from '../access'
import { toBelongResponse } from '../transaction'


import { batchDeal } from './settlement-route'
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
  const member = await requireMember(userId, data.billId)
  if (!member.ok) return ['不是该账本成员', null]
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
export const getCosts = async (billId: string | null | undefined, userId?: string | null) => {
  if (!billId) return ['账本id不能为空', null]
  const member = await requireMember(userId, billId)
  if (!member.ok) return ['不是该账本成员', null]

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
