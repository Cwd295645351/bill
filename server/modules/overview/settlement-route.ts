import type { Row } from '../../types/domain'
import { BillUser, BillOverviewRule, BillOverviewRuleYear, Transaction, User } from '../../database'
import dayjs from 'dayjs'
import { Op } from 'sequelize'
import { buildSettlement, mergeSettlementResults, withoutParties } from './settlement'
import { requireMember } from '../access'
import { fixMoney } from '../../utils/money'

interface YearGroupInput {
  name: string
  datas?: Row[]
  totalIncome: number
  memberIncomes: Record<string, number>
  memberExpenses: Record<string, number>
}

export const batchDeal = (
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
  const member = await requireMember(userId, data.billId)
  if (!member.ok) return ['不是该账本成员', null]

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

  const beginTs = Number(data.beginDate)
  const endTs = Number(data.endDate)
  const cumulativeIncome = data.cumulativeIncome === true
  const expenseBeginDate = beginTs
  const expenseEndDate = endTs
  const sameCalendarYear = dayjs(beginTs).year() === dayjs(endTs).year()
  if (cumulativeIncome && !sameCalendarYear) return ['跨年时不能按累计收入分', null]
  /** 收入开始取支出开始日所在自然年的 1 月 1 日。与 yearSegments 使用同一个 dayjs */
  const incomeBeginDate = cumulativeIncome ? dayjs(beginTs).startOf('year').valueOf() : beginTs
  const incomeEndDate = endTs
  const rangesDiffer = incomeBeginDate !== expenseBeginDate || incomeEndDate !== expenseEndDate
  const segments = rangesDiffer
    ? [{ year: dayjs(beginTs).year(), begin: incomeBeginDate, end: incomeEndDate }]
    : yearSegments(beginTs, endTs)
  const years = [...new Set(segments.map((segment) => segment.year))]
  const savedYears = await BillOverviewRuleYear.findAll({
    where: { billId: data.billId, year: { [Op.in]: years } }
  })
  const savedByYear = new Map<number, Map<string, { quantity: number; belongUserId: string }>>()
  ;(savedYears as Row[]).forEach((item) => {
    const year = Number(item.year)
    const bucket = savedByYear.get(year) || new Map<string, { quantity: number; belongUserId: string }>()
    bucket.set(String(item.ruleId), {
      quantity: Number(item.quantity) || 0,
      belongUserId: item.belongUserId ? String(item.belongUserId) : ''
    })
    savedByYear.set(year, bucket)
  })

  const queryBegin = rangesDiffer ? incomeBeginDate : beginTs
  const queryEnd = rangesDiffer ? incomeEndDate : endTs
  const rows = await Transaction.findAll({
    where: {
      billId: data.billId,
      date: { [Op.between]: [queryBegin, queryEnd] },
      isDel: false
    },
    attributes: ['id', 'type', 'money', 'date', 'belongUserId', 'costTypeId', 'costTypeName', 'belongUserName', 'userId', 'remark', 'reimbursement']
  })

  const outsiderIds = [
    ...new Set(
      (rows as Row[]).map((row) => row.userId).filter((id): id is string => !!id && !memberIds.has(id))
    )
  ]
  const outsiderUsers = outsiderIds.length
    ? await User.findAll({ where: { id: { [Op.in]: outsiderIds } }, attributes: ['id', 'nickName'] })
    : []
  const outsiderNames = new Map<string, string>(outsiderUsers.map((item: Row) => [item.id || '', item.nickName || '']))
  const memberNames = new Map<string, string>(billUsers.map((item: Row) => [item.userId || '', item.userName || '']))
  const members = billUsers.map((item: Row) => ({ userId: String(item.userId || ''), name: String(item.userName || '') }))
  const rules = (enabledRules as Row[]).map((item) => ({
    id: String(item.id || ''),
    name: item.name,
    ruleType: item.ruleType,
    unitPrice: item.unitPrice,
    costTypeId: item.costTypeId
  }))

  const toSettlementRow = (row: Row) => ({
    id: row.id,
    type: row.type,
    money: row.money,
    userId: row.userId,
    payerName: memberNames.get(row.userId || '') || outsiderNames.get(row.userId || '') || '未知',
    belongUserId: row.belongUserId,
    belongUserName: row.belongUserName,
    costTypeId: row.costTypeId,
    costTypeName: row.costTypeName,
    reimbursement: row.reimbursement
  })

  const results = []
  if (rangesDiffer) {
    const year = dayjs(beginTs).year()
    const savedYearMap = savedByYear.get(year) || new Map<string, { quantity: number; belongUserId: string }>()
    const rawInputs = (enabledRules as Row[])
      .filter((rule) => rule.ruleType === 'quantity')
      .map((rule) => {
        const saved = savedYearMap.get(String(rule.id))
        return {
          ruleId: rule.id,
          quantity: saved ? saved.quantity : 0,
          belongUserId: saved ? saved.belongUserId : ''
        }
      })
    const [inputErr, quantityInputs] = normalizeQuantityInputs(rawInputs, enabledRules as Row[], memberIds)
    if (inputErr) return [inputErr, null]
    const weightRows = (rows as Row[]).filter((row) => {
      const time = Number(row.date)
      return time >= incomeBeginDate && time <= incomeEndDate
    })
    const expenseRows = weightRows.filter((row) => {
      const time = Number(row.date)
      return time >= expenseBeginDate && time <= expenseEndDate
    })
    results.push(
      buildSettlement({
        members,
        rules,
        quantityInputs: quantityInputs || [],
        transactions: expenseRows.map(toSettlementRow),
        weightTransactions: weightRows.map(toSettlementRow)
      })
    )
  } else {
    for (const segment of segments) {
      const savedYearMap = savedByYear.get(segment.year) || new Map<string, { quantity: number; belongUserId: string }>()
      const rawInputs = (enabledRules as Row[])
        .filter((rule) => rule.ruleType === 'quantity')
        .map((rule) => {
          const saved = savedYearMap.get(String(rule.id))
          return {
            ruleId: rule.id,
            quantity: saved ? saved.quantity : 0,
            belongUserId: saved ? saved.belongUserId : ''
          }
        })
      const [inputErr, quantityInputs] = normalizeQuantityInputs(rawInputs, enabledRules as Row[], memberIds)
      if (inputErr) return [inputErr, null]
      const segmentRows = (rows as Row[]).filter((row) => {
        const time = Number(row.date)
        return time >= segment.begin && time <= segment.end
      })
      results.push(
        buildSettlement({
          members,
          rules,
          quantityInputs: quantityInputs || [],
          transactions: segmentRows.map(toSettlementRow)
        })
      )
    }
  }

  const settled = results.length === 1 ? withoutParties(results[0]) : mergeSettlementResults(members, results)
  return [
    null,
    {
      ...settled,
      expenseBeginDate,
      expenseEndDate,
      incomeBeginDate,
      incomeEndDate
    }
  ]
}

/** 按自然年切开闭区间。上一年结束于该年最后一毫秒，下一年从下一毫秒开始 */
const yearSegments = (beginTs: number, endTs: number) => {
  const segments: { year: number; begin: number; end: number }[] = []
  let cursor = beginTs
  while (cursor <= endTs) {
    const end = Math.min(dayjs(cursor).endOf('year').valueOf(), endTs)
    segments.push({ year: dayjs(cursor).year(), begin: cursor, end })
    cursor = end + 1
  }
  return segments
}

