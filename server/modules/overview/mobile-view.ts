import type { Row } from '../../types/domain'
import { Transaction, User } from '../../database'
import dayjs from 'dayjs'
import { Op } from 'sequelize'
import { getBlance } from './query-service'
import { getSettlement } from './settlement-route'
import { toCents } from './settlement'
import { isPublicBelong, splitBelongIds } from '../transaction'
import { fixMoney } from '../../utils/money'
import { unreimbursedExpenseWhere } from '../budget/spend'

interface CategorySeed {
  costTypeId: string
  name: string
  money: number
  count: number
}

/**
 * 解析手机概览的闭区间。开始取当天 00:00:00，结束取当天结束。
 * @param beginDate 开始日期
 * @param endDate 结束日期
 * @returns 失败文案或两端时间戳
 */
const parseRange = (beginDate: string, endDate: string): [string, null] | [null, { begin: number; end: number }] => {
  const begin = dayjs(beginDate)
  const end = dayjs(endDate)
  if (!beginDate || !begin.isValid()) return ['开始时间不能为空', null]
  if (!endDate || !end.isValid()) return ['结束时间不能为空', null]
  if (begin.startOf('day').valueOf() > end.startOf('day').valueOf()) return ['开始时间不能晚于结束时间', null]
  return [null, { begin: begin.startOf('day').valueOf(), end: end.endOf('day').valueOf() }]
}

/** 这笔支出是否属于成员筛选：本人、全部，或多人名单里有该成员 */
const touchesMember = (belongUserId: string | null | undefined, memberId: string) => {
  if (isPublicBelong(belongUserId)) return true
  return splitBelongIds(belongUserId).includes(memberId)
}

/**
 * 除最后一项外四舍五入到两位小数，最后一项用差额补齐到 100.00。
 * @param items 已按金额从高到低排好的分类
 * @returns 带 percent 的分类
 */
const attachPercent = (items: CategorySeed[]) => {
  if (!items.length) return []
  if (items.length === 1) return [{ ...items[0], percent: '100.00' }]
  const totalCents = items.reduce((sum, item) => sum + toCents(item.money), 0)
  let used = 0
  return items.map((item, index) => {
    if (index === items.length - 1) return { ...item, percent: ((10000 - used) / 100).toFixed(2) }
    const bps = totalCents === 0 ? 0 : Math.round((toCents(item.money) * 10000) / totalCents)
    used += bps
    return { ...item, percent: (bps / 100).toFixed(2) }
  })
}

/** 记账人姓名。当前成员优先，否则查用户表 */
const payerNameOf = (userId: string | null | undefined, memberNames: Map<string, string>, outsiderNames: Map<string, string>) =>
  memberNames.get(userId || '') || outsiderNames.get(userId || '') || '未知'

/**
 * 手机概览主查询。只读已保存的年度配置，不接收数量输入。
 * @param query 查询参数
 * @param userId 当前用户
 * @returns 失败文案或概览数据
 */
export const getMobileOverview = async (query: Row, userId: string | null | undefined) => {
  const billId = String(query.billId || '')
  const [rangeErr, range] = parseRange(String(query.beginDate || ''), String(query.endDate || ''))
  if (rangeErr || !range) return [rangeErr, null]

  const cumulativeIncome = query.cumulativeIncome === true
  const [balanceErr, balance] = await getBlance({ billId, beginDate: range.begin, endDate: range.end }, userId)
  if (!balance || typeof balance === 'string') return [balanceErr, null]
  const [settleErr, settlement] = await getSettlement(
    { billId, beginDate: range.begin, endDate: range.end, cumulativeIncome },
    userId
  )
  if (!settlement || typeof settlement === 'string') return [settleErr, null]
  const rangesDiffer =
    Number(settlement.incomeBeginDate) !== Number(settlement.expenseBeginDate) ||
    Number(settlement.incomeEndDate) !== Number(settlement.expenseEndDate)
  let totalIncome = Number(balance.totalIncomes) || 0
  if (rangesDiffer) {
    const [incomeErr, incomeBalance] = await getBlance(
      { billId, beginDate: settlement.incomeBeginDate, endDate: settlement.incomeEndDate },
      userId
    )
    if (!incomeBalance || typeof incomeBalance === 'string') return [incomeErr, null]
    totalIncome = Number(incomeBalance.totalIncomes) || 0
  }

  const expenses = (await Transaction.findAll({
    where: { billId, date: { [Op.between]: [range.begin, range.end] }, isDel: false, ...unreimbursedExpenseWhere },
    attributes: ['costTypeId', 'belongUserId']
  })) as Row[]

  const allCounts = new Map<string, number>()
  expenses.forEach((row) => {
    const key = String(row.costTypeId || '')
    allCounts.set(key, (allCounts.get(key) || 0) + 1)
  })

  const members = (settlement.members || []).map((member: Row) => ({
    userId: String(member.userId || ''),
    name: String(member.name || '')
  }))
  const memberCounts = new Map<string, Map<string, number>>()
  members.forEach((member: { userId: string }) => memberCounts.set(member.userId, new Map()))
  if (members.length > 1) {
    expenses.forEach((row) => {
      const key = String(row.costTypeId || '')
      members.forEach((member: { userId: string }) => {
        if (!touchesMember(row.belongUserId, member.userId)) return
        const bucket = memberCounts.get(member.userId)
        if (!bucket) return
        bucket.set(key, (bucket.get(key) || 0) + 1)
      })
    })
  }

  const toCategory = (
    slices: { costTypeId: string; name: string; money: number }[],
    counts: Map<string, number>
  ) =>
    attachPercent(
      (slices || []).map((slice) => ({
        costTypeId: String(slice.costTypeId || ''),
        name: String(slice.name || '未分类'),
        money: Number(slice.money) || 0,
        count: counts.get(String(slice.costTypeId || '')) || 0
      }))
    )

  const pies = settlement.pies || { all: [], members: [] }
  const categories = {
    all: toCategory(pies.all || [], allCounts),
    members:
      members.length <= 1
        ? []
        : (pies.members || []).map((member) => ({
            userId: String(member.userId || ''),
            name: String(member.name || ''),
            slices: toCategory(member.slices || [], memberCounts.get(String(member.userId || '')) || new Map())
          }))
  }

  const first = await Transaction.findOne({
    where: { billId, isDel: false },
    order: [['date', 'ASC']],
    attributes: ['date']
  })
  const last = await Transaction.findOne({
    where: { billId, isDel: false },
    order: [['date', 'DESC']],
    attributes: ['date']
  })
  const currentYear = dayjs().year()
  const recordMin = first ? dayjs(Number((first as Row).date)).year() : currentYear
  const recordMax = last ? dayjs(Number((last as Row).date)).year() : currentYear
  const minYear = Math.min(recordMin, currentYear)
  const maxYear = Math.max(recordMax, currentYear + 10)

  const incomes = (settlement.members || [])
    .filter((member) => Number(member.income) > 0)
    .map((member) => ({
      userId: String(member.userId || ''),
      name: String(member.name || ''),
      money: fixMoney(Number(member.income) || 0)
    }))
  const effectiveIncomes = (settlement.members || []).map((member) => ({
    userId: String(member.userId || ''),
    name: String(member.name || ''),
    money: fixMoney(Number(member.effectiveIncome) || 0)
  }))

  return [
    null,
    {
      totalCost: Number(balance.totalCost) || 0,
      investCost: Number(balance.investCost) || 0,
      consumptionCost: fixMoney(Number(balance.totalCost) - Number(balance.investCost)),
      totalIncome,
      incomes,
      effectiveIncomes,
      lines: settlement.lines || [],
      members,
      categories,
      minYear,
      maxYear,
      expenseBeginDate: Number(settlement.expenseBeginDate),
      expenseEndDate: Number(settlement.expenseEndDate),
      incomeBeginDate: Number(settlement.incomeBeginDate),
      incomeEndDate: Number(settlement.incomeEndDate)
    }
  ]
}

/**
 * 某一分类的原始支出。金额是记账原金额。
 * @param query 查询参数，memberId 为空表示全部
 * @param userId 当前用户
 * @returns 失败文案或明细
 */
export const getMobileRecords = async (query: Row, userId: string | null | undefined) => {
  const billId = String(query.billId || '')
  const costTypeId = String(query.costTypeId || '')
  if (!costTypeId) return ['分类不能为空', null]
  const [rangeErr, range] = parseRange(String(query.beginDate || ''), String(query.endDate || ''))
  if (rangeErr || !range) return [rangeErr, null]

  const memberId = query.memberId ? String(query.memberId) : ''
  const [settleErr, settlement] = await getSettlement({ billId, beginDate: range.begin, endDate: range.end }, userId)
  if (!settlement || typeof settlement === 'string') return [settleErr, null]
  const memberNames = new Map<string, string>(
    (settlement.members || []).map((member: Row) => [String(member.userId || ''), String(member.name || '')])
  )
  if (memberId && !memberNames.has(memberId)) return ['归属人不是该账本成员', null]

  const rows = (await Transaction.findAll({
    where: {
      billId,
      date: { [Op.between]: [range.begin, range.end] },
      isDel: false,
      costTypeId,
      ...unreimbursedExpenseWhere
    },
    attributes: ['id', 'date', 'money', 'remark', 'userId', 'belongUserId', 'belongUserName']
  })) as Row[]

  const matched = rows.filter((row) => !memberId || touchesMember(row.belongUserId, memberId))
  matched.sort((left, right) => {
    const byDate = Number(right.date) - Number(left.date)
    if (byDate !== 0) return byDate
    return String(right.id).localeCompare(String(left.id))
  })

  const outsiderIds = [
    ...new Set(matched.map((row) => String(row.userId || '')).filter((id) => id && !memberNames.has(id)))
  ]
  const outsiderUsers = outsiderIds.length
    ? await User.findAll({ where: { id: { [Op.in]: outsiderIds } }, attributes: ['id', 'nickName'] })
    : []
  const outsiderNames = new Map<string, string>(outsiderUsers.map((item: Row) => [item.id || '', item.nickName || '']))

  return [
    null,
    {
      total: matched.length,
      records: matched.map((row) => ({
        id: String(row.id || ''),
        date: dayjs(Number(row.date)).format('YYYY-MM-DD'),
        payerName: payerNameOf(row.userId, memberNames, outsiderNames),
        belongName: row.belongUserName ? String(row.belongUserName) : '全部',
        money: Number(row.money) || 0,
        remark: row.remark ? String(row.remark) : ''
      }))
    }
  ]
}
