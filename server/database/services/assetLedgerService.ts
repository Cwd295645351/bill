import type { Row } from '../../types/domain'
import { Asset, BillOverviewRule, BillOverviewRuleYear, BillUser, Member, Transaction } from '../index'
import { Op, QueryTypes } from 'sequelize'
import dayjs from 'dayjs'
import { sequelize } from '../index'
import { buildSettlement } from './overviewSettlement'
import { getLatestSnapshotsBefore } from './assetRecordService'
import { getBillRates, toCny } from './assetFx'

const round2 = (value: number) => Math.round(value * 100) / 100

/** 某月底的人民币总资产和净资产。没有任何盘点时为空 */
const totalsAt = async (assets: Row[], rates: { hkdRate: number; usdRate: number }, monthEnd: number) => {
  const ids = assets.map((asset) => asset.id).filter((id): id is string => Boolean(id))
  if (!ids.length) return { asset: null as number | null, net: null as number | null }
  const snaps = await getLatestSnapshotsBefore(ids, monthEnd)
  if (!snaps.length) return { asset: null, net: null }
  let assetSum = 0
  let debtSum = 0
  let seenAsset = false
  snaps.forEach((snap: Row) => {
    const asset = assets.find((item) => item.id === snap.assetId)
    if (!asset) return
    const amount = toCny(snap.amount, asset.currency, rates)
    if (asset.isDebt) debtSum += amount
    else {
      assetSum += amount
      seenAsset = true
    }
  })
  return {
    asset: seenAsset ? round2(assetSum) : null,
    net: round2(assetSum - debtSum)
  }
}

/** 有记账的年份 */
const ledgerYears = async (billId: string) => {
  const rows = await sequelize.query(
    'SELECT DISTINCT FROM_UNIXTIME(`date` / 1000, "%Y") AS year FROM transactions WHERE bill_id = :billId AND is_del = 0 ORDER BY year',
    { replacements: { billId }, type: QueryTypes.SELECT }
  )
  return (rows as Row[]).map((row) => Number(row.year)).filter((year) => Number.isFinite(year))
}

/**
 * 年度对账。单人支出调用概览的 buildSettlement，不另写分摊。
 * 不写记账，也不写概览规则。
 */
const buildLedger = async ({ billId, year, memberId, quantityInputs }: Row) => {
  if (!billId) return ['账本id不能为空', null]
  const yearNum = Number(year) || dayjs().year()
  const now = dayjs()
  const endMonth = yearNum === now.year() ? now.month() + 1 : 12
  const begin = dayjs(`${yearNum}-01-01`).startOf('year').valueOf()
  const end = dayjs(`${yearNum}-${String(endMonth).padStart(2, '0')}-01`).endOf('month').valueOf()

  const years = await ledgerYears(String(billId))
  const rules = await BillOverviewRule.findAll({ where: { billId, enabled: true } })
  const savedYears = await BillOverviewRuleYear.findAll({ where: { billId, year: yearNum } })
  const savedYearMap = new Map<string, { quantity: number; belongUserId: string }>()
  ;(savedYears as Row[]).forEach((item) => {
    savedYearMap.set(String(item.ruleId), {
      quantity: Number(item.quantity) || 0,
      belongUserId: item.belongUserId ? String(item.belongUserId) : ''
    })
  })

  const billUsers = await BillUser.findAll({ where: { billId }, order: [['id', 'ASC']] })
  const userMap = new Map<string, string>()
  ;(billUsers as Row[]).forEach((u) => {
    if (u.userId) userMap.set(String(u.userId), u.userName || '')
  })

  const quantityRules = (rules as Row[]).filter((rule) => rule.ruleType === 'quantity').map((rule) => {
    const saved = savedYearMap.get(String(rule.id))
    const belongUserId = saved ? saved.belongUserId : ''
    return {
      id: rule.id,
      name: rule.name,
      unitName: rule.unitName || '',
      unitPrice: Number(rule.unitPrice) || 0,
      quantity: saved ? saved.quantity : 0,
      belongUserId,
      belongUserName: belongUserId ? (userMap.get(belongUserId) || '') : ''
    }
  })
  const memberIds = new Set<string>((billUsers as Row[]).map((item) => item.userId).filter((id): id is string => Boolean(id)))
  const inputs = Array.isArray(quantityInputs) ? quantityInputs : []
  for (const input of inputs) {
    const quantity = input?.quantity === undefined || input?.quantity === null || input?.quantity === '' ? 0 : Number(input.quantity)
    if (!Number.isFinite(quantity) || quantity < 0) return ['数量不能为负', null]
  }

  // 构造最终参与计算的 inputs：如果调用方传了有效输入优先使用；若传空或未传则回退使用该年已保存的配置
  const inputRuleMap = new Map<string, Row>()
  inputs.forEach((input: Row) => {
    if (input && input.ruleId) inputRuleMap.set(String(input.ruleId), input)
  })
  const effectiveInputs = quantityRules.map((rule) => {
    const fromInput = inputRuleMap.get(String(rule.id))
    if (fromInput && (fromInput.quantity !== '' && fromInput.quantity != null)) {
      return {
        ruleId: String(rule.id),
        quantity: Number(fromInput.quantity) || 0,
        belongUserId: String(fromInput.belongUserId || '')
      }
    }
    const saved = savedYearMap.get(String(rule.id))
    return {
      ruleId: String(rule.id),
      quantity: saved ? saved.quantity : 0,
      belongUserId: saved ? saved.belongUserId : ''
    }
  })

  const txRows = await Transaction.findAll({
    where: { billId, date: { [Op.between]: [begin, end] }, isDel: false },
    attributes: ['id', 'type', 'money', 'belongUserId', 'costTypeId', 'costTypeName', 'belongUserName', 'userId']
  })
  let income = 0
  let expense = 0
  ;(txRows as Row[]).forEach((row) => {
    const money = Number(row.money) || 0
    if (Number(row.type) === 2) income += money
    if (Number(row.type) === 1) expense += money
  })
  income = round2(income)
  expense = round2(expense)

  const assetQuery: Row = { billId, isDel: false }
  let unmatched = false
  let person: Row | null = null
  if (memberId) {
    const assetMember = await Member.findOne({ where: { id: memberId, billId, isDel: false } })
    if (!assetMember) return ['成员不存在', null]
    assetQuery.memberId = memberId
    person = (billUsers as Row[]).find((item) => item.userName === assetMember.name) || null
    unmatched = !person
  }

  let exclusive = 0
  let sharedShare = 0
  let publicShare = 0
  let effectiveIncome: { userId: string; name: string; effectiveIncome: number }[] = []
  if (person) {
    const settlement = buildSettlement({
      members: (billUsers as Row[]).map((item) => ({ userId: String(item.userId || ''), name: String(item.userName || '') })),
      rules: (rules as Row[]).map((item) => ({
        id: String(item.id || ''),
        ruleType: item.ruleType,
        unitPrice: item.unitPrice,
        costTypeId: item.costTypeId
      })),
      quantityInputs: effectiveInputs,
      transactions: (txRows as Row[]).map((row) => ({
        type: row.type,
        money: row.money,
        userId: row.userId,
        belongUserId: row.belongUserId,
        belongUserName: row.belongUserName,
        costTypeId: row.costTypeId,
        costTypeName: row.costTypeName
      }))
    })
    const mine = settlement.members.find((item) => item.userId === person?.userId)
    income = Number(mine?.income) || 0
    expense = Number(mine?.borne) || 0
    exclusive = Number(mine?.exclusive) || 0
    sharedShare = Number(mine?.sharedShare) || 0
    publicShare = Number(mine?.publicShare) || 0
    effectiveIncome = settlement.members.map((item) => ({
      userId: item.userId,
      name: item.name,
      effectiveIncome: Math.max(Number(item.effectiveIncome) || 0, 0)
    }))
  } else if (!unmatched && memberIds.size) {
    const settlement = buildSettlement({
      members: (billUsers as Row[]).map((item) => ({ userId: String(item.userId || ''), name: String(item.userName || '') })),
      rules: (rules as Row[]).map((item) => ({
        id: String(item.id || ''),
        ruleType: item.ruleType,
        unitPrice: item.unitPrice,
        costTypeId: item.costTypeId
      })),
      quantityInputs: effectiveInputs,
      transactions: (txRows as Row[]).map((row) => ({
        type: row.type,
        money: row.money,
        belongUserId: row.belongUserId,
        costTypeId: row.costTypeId
      }))
    })
    effectiveIncome = settlement.members.map((item) => ({
      userId: item.userId,
      name: item.name,
      effectiveIncome: Math.max(Number(item.effectiveIncome) || 0, 0)
    }))
  }

  if (unmatched) {
    income = 0
    expense = 0
  }

  const assets = await Asset.findAll({ where: assetQuery })
  const rates = await getBillRates(String(billId))
  const prevDec = dayjs(`${yearNum}-01-01`).subtract(1, 'month').endOf('month')
  let opening = await totalsAt(assets as Row[], rates, prevDec.valueOf())
  let openingMonth = `${yearNum - 1}-12`
  if (opening.asset == null) {
    for (let month = 1; month <= endMonth; month += 1) {
      const monthEnd = dayjs(`${yearNum}-${String(month).padStart(2, '0')}-01`).endOf('month')
      const cell = await totalsAt(assets as Row[], rates, monthEnd.valueOf())
      if (cell.asset != null) {
        opening = cell
        openingMonth = monthEnd.format('YYYY-MM')
        break
      }
    }
  }
  const closingEnd = dayjs(`${yearNum}-${String(endMonth).padStart(2, '0')}-01`).endOf('month')
  const closing = await totalsAt(assets as Row[], rates, closingEnd.valueOf())
  const assetChange = opening.asset == null || closing.asset == null ? null : round2(closing.asset - opening.asset)
  const netChange = opening.net == null || closing.net == null ? null : round2(closing.net - opening.net)
  const surplus = round2(income - expense)
  const diff = assetChange == null ? null : round2(assetChange - surplus)

  return [null, {
    year: yearNum,
    years,
    endMonth: closingEnd.format('YYYY-MM'),
    openingMonth,
    openingAsset: opening.asset,
    closingAsset: closing.asset,
    income,
    expense,
    surplus,
    exclusive,
    sharedShare,
    publicShare,
    effectiveIncome,
    unmatched,
    message: unmatched ? '没有找到同名的记账成员' : (txRows.length ? '' : '这一年还没有记账'),
    assetChange,
    netChange,
    diff,
    equal: diff == null ? null : Math.abs(diff) < 0.01,
    quantityRules
  }]
}

export { buildLedger }
