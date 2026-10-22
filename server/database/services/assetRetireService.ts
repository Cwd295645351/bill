import type { Row, WhereBag } from '../../types/domain'
import { Asset, AssetRetirePlan, BillUser, Member, Transaction } from '../index'
import { Op } from 'sequelize'
import dayjs from 'dayjs'
import { isMultiBelong, isPublicBelong, splitBelongIds } from './belongUsers'
import { allocatePublic } from './overviewSettlement'
import { getLatestSnapshotsBefore } from './assetRecordService'
import { getBillRates, toCny } from './assetFx'

const round2 = (value: number) => Math.round(value * 100) / 100

const monthKey = (stamp: number) => dayjs(stamp).format('YYYY-MM')

/** 近 N 年窗口，截止本月。早于第一笔记账的月份不放进来 */
const windowMonths = (years: number, firstStamp: number | null) => {
  const count = years === 5 ? 60 : 36
  const end = dayjs().startOf('month')
  const start = end.subtract(count - 1, 'month')
  const first = firstStamp == null ? null : dayjs(firstStamp).startOf('month')
  const months: string[] = []
  let cursor = start
  while (cursor.isBefore(end) || cursor.isSame(end, 'month')) {
    if (!first || !cursor.isBefore(first, 'month')) months.push(cursor.format('YYYY-MM'))
    cursor = cursor.add(1, 'month')
  }
  return months
}

interface Flow {
  income: Record<string, number>
  expense: Record<string, number>
}

/** 把记账按月归到每个人。全部视图下，共同和公共支出平均拆开，使各人相加仍等于原金额一次 */
const monthFlows = (rows: Row[], people: { userId: string; name: string }[], household: boolean) => {
  const ids = people.map((item) => item.userId)
  const idSet = new Set(ids)
  const byMonth = new Map<string, Flow>()
  const ensure = (key: string) => {
    const found = byMonth.get(key)
    if (found) return found
    const flow: Flow = { income: {}, expense: {} }
    ids.forEach((id) => {
      flow.income[id] = 0
      flow.expense[id] = 0
    })
    byMonth.set(key, flow)
    return flow
  }
  rows.forEach((row) => {
    const key = monthKey(Number(row.date))
    const flow = ensure(key)
    const cents = Math.round((Number(row.money) || 0) * 100)
    if (Number(row.type) === 2) {
      if (!isPublicBelong(row.belongUserId) && idSet.has(row.belongUserId)) flow.income[row.belongUserId] += cents
      return
    }
    if (Number(row.type) !== 1) return
    if (!household) {
      if (!isPublicBelong(row.belongUserId) && !isMultiBelong(row.belongUserId) && idSet.has(row.belongUserId)) {
        flow.expense[row.belongUserId] += cents
      }
      return
    }
    if (isPublicBelong(row.belongUserId)) {
      const shares = allocatePublic(cents, ids.map(() => 1))
      ids.forEach((id, index) => {
        flow.expense[id] += shares[index] || 0
      })
      return
    }
    if (isMultiBelong(row.belongUserId)) {
      const group = splitBelongIds(row.belongUserId).filter((id) => idSet.has(id))
      const shares = allocatePublic(cents, group.map(() => 1))
      group.forEach((id, index) => {
        flow.expense[id] += shares[index] || 0
      })
      return
    }
    if (idSet.has(row.belongUserId)) flow.expense[row.belongUserId] += cents
  })
  return byMonth
}

const averageOf = (
  people: { userId: string; name: string }[],
  months: string[],
  flows: Map<string, Flow>,
  field: 'income' | 'expense',
  skipIdle: boolean
) => {
  const idle: { name: string; month: string }[] = []
  const value = people.reduce((sum, person) => {
    const used = months.filter((month) => {
      const cents = flows.get(month)?.[field][person.userId] || 0
      if (field === 'income' && cents <= 0) idle.push({ name: person.name, month })
      if (field === 'income' && skipIdle && cents <= 0) return false
      return true
    })
    const total = used.reduce((inner, month) => inner + (flows.get(month)?.[field][person.userId] || 0), 0)
    return sum + (used.length ? total / used.length : 0)
  }, 0)
  return { value: round2(value / 100), idle }
}

/** 从开始月到本月（目标月更早则只到目标月）的月底净资产 */
const netSeries = async (assets: Row[], rates: { hkdRate: number; usdRate: number }, startMonth: string, targetMonth: string | null) => {
  const start = dayjs(`${startMonth}-01`)
  if (!start.isValid()) return []
  const now = dayjs().startOf('month')
  const target = targetMonth ? dayjs(`${targetMonth}-01`) : null
  const end = target && target.isValid() && target.isBefore(now, 'month') ? target : now
  const points: { month: string; value: number | null }[] = []
  let cursor = start.startOf('month')
  const ids = assets.map((asset) => asset.id).filter((id): id is string => Boolean(id))
  while (cursor.isBefore(end) || cursor.isSame(end, 'month')) {
    if (!ids.length) {
      points.push({ month: cursor.format('YYYY-MM'), value: null })
    } else {
      const snaps = await getLatestSnapshotsBefore(ids, cursor.endOf('month').valueOf())
      if (!snaps.length) points.push({ month: cursor.format('YYYY-MM'), value: null })
      else {
        let assetSum = 0
        let debtSum = 0
        snaps.forEach((snap: Row) => {
          const asset = assets.find((item) => item.id === snap.assetId)
          if (!asset) return
          const amount = toCny(snap.amount, asset.currency, rates)
          if (asset.isDebt) debtSum += amount
          else assetSum += amount
        })
        points.push({ month: cursor.format('YYYY-MM'), value: round2(assetSum - debtSum) })
      }
    }
    cursor = cursor.add(1, 'month')
  }
  return points
}

const currentNet = async (billId: string, memberId: string | null) => {
  const where: WhereBag = { billId, isDel: false }
  if (memberId) where.memberId = memberId
  const assets = await Asset.findAll({ where })
  const rates = await getBillRates(billId)
  let assetSum = 0
  let debtSum = 0
  ;(assets as Row[]).forEach((asset) => {
    const amount = toCny(asset.latestAmount, asset.currency, rates)
    if (asset.isDebt) debtSum += amount
    else assetSum += amount
  })
  return { net: round2(assetSum - debtSum), assets: assets as Row[], rates }
}

const readPlan = async (billId: string, memberId: string | null) => {
  const where: WhereBag = { billId }
  where.memberId = memberId || null
  return AssetRetirePlan.findOne({ where })
}

/** 读取计划，并附上月均收支。单人支出不调用分账 */
const getRetirePlan = async ({ billId, memberId, incomeYears, expenseYears, skipIdle }: Row) => {
  if (!billId) return ['账本id不能为空', null]
  const scope = memberId ? String(memberId) : null
  if (scope) {
    const assetMember = await Member.findOne({ where: { id: scope, billId, isDel: false } })
    if (!assetMember) return ['成员不存在', null]
  }
  const plan = await readPlan(String(billId), scope)
  const billUsers = await BillUser.findAll({ where: { billId }, order: [['id', 'ASC']] })
  let people = (billUsers as Row[]).map((item) => ({ userId: String(item.userId), name: String(item.userName || '') }))
  let unmatched = false
  if (scope) {
    const assetMember = await Member.findOne({ where: { id: scope, billId, isDel: false } })
    const matched = people.find((item) => item.name === assetMember?.name)
    if (!matched) {
      unmatched = true
      people = []
    } else {
      people = [matched]
    }
  }
  const first = await Transaction.findOne({ where: { billId, isDel: false }, order: [['date', 'ASC']] })
  const inYears = Number(incomeYears) === 5 ? 5 : 3
  const outYears = Number(expenseYears) === 5 ? 5 : 3
  const skip = skipIdle === undefined || skipIdle === null || skipIdle === '' ? true : !['0', 'false', '否'].includes(String(skipIdle))
  const incomeMonths = windowMonths(inYears, first ? Number(first.date) : null)
  const expenseMonths = windowMonths(outYears, first ? Number(first.date) : null)
  const from = dayjs((incomeMonths[0] && expenseMonths[0] && incomeMonths[0] < expenseMonths[0] ? incomeMonths[0] : expenseMonths[0]) || dayjs().format('YYYY-MM') + '-01')
  const rows = people.length
    ? await Transaction.findAll({
      where: { billId, isDel: false, date: { [Op.gte]: from.startOf('month').valueOf() } },
      attributes: ['type', 'money', 'belongUserId', 'date']
    })
    : []
  const flows = monthFlows(rows as Row[], people, !scope)
  const incomeAvg = people.length ? averageOf(people, incomeMonths, flows, 'income', skip) : { value: 0, idle: [] }
  const expenseAvg = people.length ? averageOf(people, expenseMonths, flows, 'expense', false) : { value: 0, idle: [] }
  const idleMonths = people.length ? averageOf(people, incomeMonths, flows, 'income', false).idle : []
  const { net, assets, rates } = await currentNet(String(billId), scope)
  const startMonth = plan?.startMonth ? String(plan.startMonth) : ''
  const targetMonth = plan?.targetMonth ? String(plan.targetMonth) : ''
  const series = startMonth ? await netSeries(assets, rates, startMonth, targetMonth || null) : []
  return [null, {
    plan: plan
      ? { amount: Number(plan.amount), startMonth, targetMonth: targetMonth || null }
      : null,
    monthlyIncome: unmatched || !rows.length ? 0 : incomeAvg.value,
    monthlyExpense: unmatched || !rows.length ? 0 : expenseAvg.value,
    idleMonths,
    skipIdle: skip,
    unmatched,
    message: unmatched ? '没有找到同名的记账成员' : (!rows.length ? '还没有可统计的记账' : ''),
    netWorth: net,
    series
  }]
}

const saveRetirePlan = async ({ billId, memberId, amount, startMonth, targetMonth }: Row) => {
  if (!billId) return ['账本id不能为空', null]
  const target = Number(amount)
  if (!Number.isFinite(target) || target <= 0) return ['目标金额必须大于0', null]
  if (!startMonth || !dayjs(`${startMonth}-01`).isValid()) return ['开始月份不能为空', null]
  if (dayjs(`${startMonth}-01`).startOf('month').isAfter(dayjs().startOf('month'))) return ['开始月份不能晚于本月', null]
  if (targetMonth) {
    if (!dayjs(`${targetMonth}-01`).isValid()) return ['目标月份不正确', null]
    if (!dayjs(`${targetMonth}-01`).startOf('month').isAfter(dayjs().startOf('month'))) return ['目标月份必须晚于本月', null]
  }
  const scope = memberId ? String(memberId) : null
  if (scope) {
    const assetMember = await Member.findOne({ where: { id: scope, billId, isDel: false } })
    if (!assetMember) return ['成员不存在', null]
  }
  const current = await readPlan(String(billId), scope)
  const payload = { amount: target, startMonth: String(startMonth), targetMonth: targetMonth ? String(targetMonth) : null }
  if (current) await AssetRetirePlan.update(payload, { where: { id: current.id } })
  else await AssetRetirePlan.create({ billId, memberId: scope, ...payload })
  return getRetirePlan({ billId, memberId: scope || '' })
}

export { getRetirePlan, saveRetirePlan }
