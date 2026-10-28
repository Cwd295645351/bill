import type { Row, WhereBag } from '../../types/domain'
import { Asset, AssetRecord, Member } from '../../database/index'
import { Op } from 'sequelize'
import dayjs from 'dayjs'
import { getLatestSnapshotsBefore } from '../../database/services/assetRecordService'
import { getBillRates, toCny } from '../../database/services/assetFx'
import {
  buildMonthEndTotals,
  loadSnapshotPool,
  monthEndTimestamp,
  listYearMonths,
  isYearMonth,
  TYPE_LABEL,
  type MonthEndTotals
} from '../../database/services/monthEndTotals'

/** 获取资产概览（首页顶部摘要 + 变化柱状图）
 * 返回当前资产汇总及与上月末相比的各类型变化数据
 *
 * @param {string} billId   账本 id（必填）
 * @param {string} memberId 成员 id（可选）
 * @returns {Array} [错误信息, {
 *   netAmount:   number,               // 净资产
 *   assetAmount: number,               // 资产总额
 *   debtAmount:  number,               // 负债总额
 *   referenceDate: string,             // 对比基准日期（上月末，格式 YYYY-MM-DD）
 *   totalChange:   number,             // 总资产变化金额（当前 - 上月末）
 *   categoryChanges: [{                // 各类型变化（用于柱状图）
 *     type:     string,                // 类型标识
 *     typeName: string,                // 中文名
 *     current:  number,                // 当前金额
 *     prev:     number,                // 上月末金额
 *     change:   number                 // 变化金额
 *   }]
 * }]
 */
const typeNameMap: Record<string, string> = {
  living: '流动资金',
  steady: '固定资产',
  longterm: '投资理财',
  receivable: '应收款',
  debt: '负债'
}
const typeOrder = ['living', 'steady', 'longterm', 'receivable', 'debt']

const round2 = (value: number) => Math.round(value * 100) / 100
const CHANNELS = [
  '微信', '支付宝', '平安银行', '中国银行', '招商银行', '建设银行', '中信银行',
  '交通银行', '微众银行', '广发银行', '兴业银行', '且慢', '众安', '股票', '固定资产', '公积金', '未知'
]

const displayChannel = (value: unknown) => {
  const channel = String(value || '').trim()
  return CHANNELS.includes(channel) ? channel : '未知'
}

/** 当前筛选下的盘点日，以及最早有盘点的月份 */
const recordSpan = async (assetIds: string[]) => {
  if (!assetIds.length) return { defaultAsOf: '', earliestRecordMonth: '' }
  const rows = await AssetRecord.findAll({
    where: { assetId: { [Op.in]: assetIds }, isDel: false },
    attributes: ['date'],
    raw: true
  })
  const days = [...new Set((rows as Row[]).map((row) => dayjs(Number(row.date)).format('YYYY-MM-DD')))].sort()
  const stamps = (rows as Row[]).map((row) => Number(row.date)).filter((value) => Number.isFinite(value))
  return {
    defaultAsOf: days.length >= 2 ? days[days.length - 2] : '',
    earliestRecordMonth: stamps.length ? dayjs(Math.min(...stamps)).format('YYYY-MM') : ''
  }
}

export const getAssetOverview = async ({ billId, memberId, asOf }: Row) => {
  if (!billId) return ['账本id不能为空', null]

  const query: WhereBag = { billId, isDel: false }
  if (memberId) query.memberId = memberId

  const assets = await Asset.findAll({ where: query })
  const rates = await getBillRates(String(billId))
  const assetIds = assets.map((item: Row) => item.id).filter((id: string | undefined): id is string => Boolean(id))
  const span = await recordSpan(assetIds)
  const asOfText = asOf ? String(asOf) : ''
  const compare = Boolean(asOfText && dayjs(asOfText).isValid())

  let assetAmount = 0
  let debtAmount = 0
  const currentByType: Record<string, number> = {}
  assets.forEach((asset: Row) => {
    const type = String(asset.type || '')
    const latest = toCny(asset.latestAmount, asset.currency, rates)
    currentByType[type] = (currentByType[type] || 0) + latest
    if (asset.isDebt) debtAmount += latest
    else assetAmount += latest
  })

  const prevByType: Record<string, number> = {}
  let prevAssetAmount = 0
  let prevDebtAmount = 0
  if (compare && assetIds.length) {
    const snaps = await getLatestSnapshotsBefore(assetIds, dayjs(asOfText).endOf('day').valueOf())
    snaps.forEach((snap: Row) => {
      const asset = assets.find((item: Row) => item.id === snap.assetId)
      if (!asset) return
      const type = String(asset.type || '')
      const amount = toCny(snap.amount, asset.currency, rates)
      prevByType[type] = (prevByType[type] || 0) + amount
      if (asset.isDebt) prevDebtAmount += amount
      else prevAssetAmount += amount
    })
  } else if (!compare && assetIds.length) {
    // 不传截至日时，变化仍相对上月末，避免旧调用方突然改口径
    const lastMonthEnd = dayjs().subtract(1, 'month').endOf('month')
    const snaps = await getLatestSnapshotsBefore(assetIds, lastMonthEnd.valueOf())
    snaps.forEach((snap: Row) => {
      const asset = assets.find((item: Row) => item.id === snap.assetId)
      if (!asset || asset.isDebt) return
      prevAssetAmount += toCny(snap.amount, asset.currency, rates)
      const type = String(asset.type || '')
      prevByType[type] = (prevByType[type] || 0) + toCny(snap.amount, asset.currency, rates)
    })
  }

  const categoryChanges = typeOrder.map((type) => {
    const current = round2(currentByType[type] || 0)
    const prev = round2(prevByType[type] || 0)
    return { type, typeName: typeNameMap[type], current, prev, change: round2(current - prev) }
  })

  assetAmount = round2(assetAmount)
  debtAmount = round2(debtAmount)
  const totalChange = compare || !asOfText ? round2(assetAmount - round2(prevAssetAmount)) : 0
  const debtChange = compare ? round2(debtAmount - round2(prevDebtAmount)) : 0

  return [null, {
    netAmount: round2(assetAmount - debtAmount),
    assetAmount,
    debtAmount,
    referenceDate: compare ? asOfText : (span.defaultAsOf || dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD')),
    totalChange,
    debtChange,
    categoryChanges,
    defaultAsOf: span.defaultAsOf,
    earliestRecordMonth: span.earliestRecordMonth,
    hkdRate: rates.hkdRate,
    usdRate: rates.usdRate,
    ratesSaved: rates.saved
  }]
}

/**
 * 获取桑基图数据。负债逐笔从左侧汇入总资产，类型节点使用中文名。
 */
export const getSankeyData = async ({ billId, memberId }: Row) => {
  if (!billId) return ['账本id不能为空', null]
  const query: WhereBag = { billId, isDel: false }
  if (memberId) query.memberId = memberId

  const assets = await Asset.findAll({
    where: query,
    include: [{ model: Member, as: 'member' }]
  })
  const rates = await getBillRates(String(billId))

  const typeName: Record<string, string> = {
    living: '流动资金',
    steady: '固定资产',
    longterm: '投资理财',
    receivable: '应收款'
  }
  let totalAsset = 0
  let totalDebt = 0
  const typeAmount: Record<string, number> = {}
  const typeChannelAmount: Record<string, Record<string, number>> = {}
  const channelCycleAmount: Record<string, Record<string, number>> = {}
  const nodes: { id: string; name: string; memberName?: string; detail?: string; kind: string; currency?: string; rawAmount?: number }[] = []
  const links: { source: string; target: string; value: number }[] = []

  assets.forEach((asset: Row) => {
    const rawAmount = Math.abs(Number(asset.latestAmount) || 0)
    const amount = toCny(asset.latestAmount, asset.currency, rates)
    if (amount <= 0) return
    const memberName = asset.member?.name ? String(asset.member.name) : ''
    if (asset.isDebt) {
      totalDebt += amount
      const id = `d-${asset.id}`
      nodes.push({ id, name: asset.name || '', memberName, kind: 'debt', currency: asset.currency || 'CNY', rawAmount })
      links.push({ source: id, target: 'total', value: amount })
      return
    }
    const label = typeName[String(asset.type || '')] || String(asset.type || '')
    totalAsset += amount
    typeAmount[label] = (typeAmount[label] || 0) + amount
    typeChannelAmount[label] = typeChannelAmount[label] || {}
    const channel = displayChannel(asset.channel)
    const storedCycle = String(asset.turnaroundCycle || '')
    const cycle = ['T+0', 'T+1', '长期', '不可提现'].includes(storedCycle) ? storedCycle : 'T+0'
    const channelId = `c-${channel}`
    const cycleId = `cycle-${cycle}`
    typeChannelAmount[label][channel] = (typeChannelAmount[label][channel] || 0) + amount
    channelCycleAmount[channel] = channelCycleAmount[channel] || {}
    channelCycleAmount[channel][cycle] = (channelCycleAmount[channel][cycle] || 0) + amount
    if (!nodes.some((node) => node.id === channelId)) {
      nodes.push({ id: channelId, name: channel, kind: 'channel' })
    }
    if (!nodes.some((node) => node.id === cycleId)) {
      nodes.push({ id: cycleId, name: cycle, kind: 'cycle' })
    }
  })

  const netWorth = totalAsset - totalDebt
  nodes.unshift(
    { id: 'net', name: '净资产', kind: 'summary' },
    { id: 'total', name: '总资产', kind: 'summary' }
  )
  Object.keys(typeAmount).forEach((label) => {
    if (typeAmount[label] <= 0) return
    nodes.push({ id: `t-${label}`, name: label, kind: 'type' })
    links.push({ source: 'total', target: `t-${label}`, value: typeAmount[label] })
    Object.keys(typeChannelAmount[label]).forEach((channel) => {
      const value = typeChannelAmount[label][channel]
      if (value > 0) links.push({ source: `t-${label}`, target: `c-${channel}`, value })
    })
  })
  Object.keys(channelCycleAmount).forEach((channel) => {
    Object.keys(channelCycleAmount[channel]).forEach((cycle) => {
      const value = channelCycleAmount[channel][cycle]
      if (value > 0) links.push({ source: `c-${channel}`, target: `cycle-${cycle}`, value })
    })
  })
  if (netWorth > 0) links.push({ source: 'net', target: 'total', value: netWorth })

  return [null, { nodes, links: links.filter((link) => link.value > 0) }]
}

/**
 * 获取四笔钱配置概览
 */
export const getFourMoneySummary = async ({ billId, memberId }: Row) => {
  if (!billId) return ['账本id不能为空', null]
  const query: WhereBag = { billId, isDel: false }
  if (memberId) query.memberId = memberId

  const assets = await Asset.findAll({
    where: query,
    include: [{ model: Member, as: 'member' }]
  })
  const rates = await getBillRates(String(billId))

  const summary: Record<string, {
    name: string
    amount: number
    count: number
    assets: Row[]
    totalPremium?: number
    categories?: Record<string, number>
  }> = {
    living: { name: '活钱', amount: 0, count: 0, assets: [] },
    steady: { name: '稳健', amount: 0, count: 0, assets: [] },
    longterm: { name: '长期', amount: 0, count: 0, assets: [] },
    insurance: { name: '保险', amount: 0, count: 0, assets: [], totalPremium: 0, categories: {} }
  }

  assets.forEach((asset: Row) => {
    const type = asset.fourMoneyType
    const bucket = type ? summary[type] : undefined
    if (!bucket) return
    const amount = toCny(asset.latestAmount, asset.currency, rates)
    bucket.amount = round2(bucket.amount + amount)
    bucket.count += 1
    const row: Row = {
      id: asset.id,
      name: asset.name,
      type: asset.type,
      fourMoneyType: type,
      channel: asset.isDebt ? '' : displayChannel(asset.channel),
      turnaroundCycle: asset.isDebt ? 'T+0' : asset.turnaroundCycle || 'T+0',
      latestAmount: amount,
      rawAmount: Math.abs(Number(asset.latestAmount) || 0),
      currency: asset.currency || 'CNY',
      isDebt: Boolean(asset.isDebt),
      memberId: asset.memberId,
      member: { name: asset.member?.name || '' },
      insuranceCategory: asset.insuranceCategory || '',
      annualPremium: asset.annualPremium == null ? null : toCny(asset.annualPremium, asset.currency, rates)
    }
    bucket.assets.push(row)

    if (type === 'insurance') {
      const insurance = summary.insurance
      const premium = asset.annualPremium == null ? 0 : toCny(asset.annualPremium, asset.currency, rates)
      insurance.totalPremium = round2((insurance.totalPremium || 0) + premium)
      const cat = asset.insuranceCategory || '其他'
      const categories = insurance.categories || {}
      insurance.categories = categories
      if (!categories[cat]) categories[cat] = 0
      categories[cat] += 1
    }
  })

  return [null, summary]
}

/**
 * 获取资产月历数据
 */
export const getMonthlyReport = async ({ billId, year, memberId }: Row) => {
  if (!billId) return ['账本id不能为空', null]
  const yearNum = Number(year) || dayjs().year()
  const query: WhereBag = { billId, isDel: false }
  if (memberId) query.memberId = memberId

  const assets = await Asset.findAll({ where: query })
  const rates = await getBillRates(String(billId))
  const assetIds = assets
    .map((asset: Row) => asset.id)
    .filter((id: string | undefined): id is string => Boolean(id))

  const categoryKeys = ['流动资金', '投资理财', '固定资产', '应收款', '总资产', '总负债', '总净资产']
  const blank = () => ({
    current: null as number | null,
    yearChange: null as number | null,
    lastUpdate: '',
    monthlyData: Array.from({ length: 12 }, () => null as number | null)
  })
  const result: Record<string, ReturnType<typeof blank>> = {}
  categoryKeys.forEach((key) => {
    result[key] = blank()
  })

  const now = dayjs()
  const lastMonth = yearNum === now.year() ? now.month() : 11
  const endYm = `${yearNum}-${String(lastMonth + 1).padStart(2, '0')}`
  const pool = await loadSnapshotPool(assetIds, monthEndTimestamp(endYm))

  for (let m = 0; m <= lastMonth; m++) {
    const yearMonth = `${yearNum}-${String(m + 1).padStart(2, '0')}`
    const totals = await buildMonthEndTotals({ yearMonth, assets, rates, pool, assetIds })
    result['流动资金'].monthlyData[m] = totals.liquid
    result['投资理财'].monthlyData[m] = totals.invest
    result['固定资产'].monthlyData[m] = totals.fixed
    result['应收款'].monthlyData[m] = totals.receivable
    result['总资产'].monthlyData[m] = totals.assetsSum
    result['总负债'].monthlyData[m] = totals.liability
    result['总净资产'].monthlyData[m] = totals.net

    Object.keys(totals.lastUpdate).forEach((key) => {
      if (result[key]?.monthlyData[m] == null) return
      if (!result[key].lastUpdate || totals.lastUpdate[key] > result[key].lastUpdate) {
        result[key].lastUpdate = totals.lastUpdate[key]
      }
    })
  }

  // 较年初基准：该年 1 月 1 日 0 点之前最近一次盘点（不含 1 月 1 日当天及之后）
  const yearStartCutoff = dayjs(`${yearNum}-01-01`).startOf('day').valueOf() - 1
  const yearStartSnaps = assetIds.length ? await getLatestSnapshotsBefore(assetIds, yearStartCutoff) : []
  const yearStart: Record<string, number | null> = {}
  categoryKeys.forEach((key) => {
    yearStart[key] = null
  })
  {
    const sums: Record<string, number> = {}
    const seen: Record<string, boolean> = {}
    let assetSum = 0
    let debtSum = 0
    let seenAsset = false
    let seenDebt = false
    yearStartSnaps.forEach((snap: Row) => {
      const asset = assets.find((item: Row) => item.id === snap.assetId)
      if (!asset) return
      const amount = toCny(snap.amount, asset.currency, rates)
      if (asset.isDebt) {
        debtSum += amount
        seenDebt = true
        return
      }
      const label = TYPE_LABEL[String(asset.type || '')]
      if (label) {
        sums[label] = (sums[label] || 0) + amount
        seen[label] = true
      }
      assetSum += amount
      seenAsset = true
    })
    ;(['流动资金', '投资理财', '固定资产', '应收款'] as const).forEach((label) => {
      yearStart[label] = seen[label] ? round2(sums[label] || 0) : null
    })
    yearStart['总资产'] = seenAsset ? round2(assetSum) : null
    yearStart['总负债'] = seenDebt ? round2(debtSum) : null
    yearStart['总净资产'] = seenAsset || seenDebt ? round2(assetSum - debtSum) : null
  }

  categoryKeys.forEach((key) => {
    const current = result[key].monthlyData[lastMonth]
    const baseline = yearStart[key]
    result[key].current = current == null ? null : round2(current)
    result[key].yearChange = current == null ? null : round2(current - (baseline ?? 0))
    result[key].monthlyData = result[key].monthlyData.map((value) => (value == null ? null : round2(value)))
  })

  return [null, result]
}

const ALL_SERIES = [
  { key: 'liquid', name: '流动资金', field: 'liquid' as const, sign: 1 },
  { key: 'invest', name: '投资理财', field: 'invest' as const, sign: 1 },
  { key: 'fixed', name: '固定资产', field: 'fixed' as const, sign: 1 },
  { key: 'receivable', name: '应收款', field: 'receivable' as const, sign: 1 },
  { key: 'liability', name: '负债', field: 'liability' as const, sign: -1 }
]

const legendOf = (key: string, values: (number | null)[]) => {
  let first: number | null = null
  let last: number | null = null
  for (const value of values) {
    if (value == null) continue
    if (first == null) first = value
    last = value
  }
  if (first == null || last == null) return { key, first: null, last: null, delta: null }
  return { key, first, last, delta: round2(last - first) }
}

/**
 * 资产趋势：任意月窗一次返回 chart-ready 序列（与月历共用月末汇总内核）
 */
export const getAssetTrend = async ({
  billId,
  startMonth,
  endMonth,
  grain,
  metric,
  memberId
}: {
  billId?: string
  startMonth?: string | null
  endMonth?: string | null
  grain?: string | null
  metric?: string | null
  memberId?: string | null
}) => {
  if (!billId) return ['账本id不能为空', null]
  if (!isYearMonth(startMonth) || !isYearMonth(endMonth)) return ['起止月份格式须为 YYYY-MM', null]

  const grainValue = grain === 'year' ? 'year' : 'month'
  const metricValue = metric === 'net' ? 'net' : 'all'

  const nowMonth = dayjs().format('YYYY-MM')
  let end = String(endMonth)
  const capped = end > nowMonth
  if (capped) end = nowMonth
  const start = String(startMonth)
  if (start > end) return ['起止月份颠倒', null]

  const months = listYearMonths(start, end)
  if (months.length > 240) return ['时间范围过大，请缩小到 20 年以内', null]

  const query: WhereBag = { billId, isDel: false }
  if (memberId) query.memberId = memberId
  const assets = await Asset.findAll({ where: query })
  const rates = await getBillRates(String(billId))
  const assetIds = assets
    .map((asset: Row) => asset.id)
    .filter((id: string | undefined): id is string => Boolean(id))

  const pool = await loadSnapshotPool(assetIds, monthEndTimestamp(end))
  const monthly: MonthEndTotals[] = []
  for (const yearMonth of months) {
    monthly.push(await buildMonthEndTotals({ yearMonth, assets, rates, pool, assetIds }))
  }

  const projectMonth = (row: MonthEndTotals) => {
    if (metricValue === 'net') {
      return [{ key: 'net', name: '净资产', value: row.net }]
    }
    return ALL_SERIES.map((item) => ({
      key: item.key,
      name: item.name,
      value: row[item.field] == null ? null : round2((row[item.field] as number) * item.sign)
    }))
  }

  let labels: string[] = months
  let projected = monthly.map((row) => projectMonth(row))

  if (grainValue === 'year') {
    const groups = new Map<string, number[]>()
    months.forEach((ym, index) => {
      const year = ym.slice(0, 4)
      const list = groups.get(year) || []
      list.push(index)
      groups.set(year, list)
    })
    labels = []
    const picked: typeof projected = []
    groups.forEach((indexes, year) => {
      let chosen = indexes[indexes.length - 1]
      for (let i = indexes.length - 1; i >= 0; i -= 1) {
        if (projected[indexes[i]].some((cell) => cell.value != null)) {
          chosen = indexes[i]
          break
        }
      }
      labels.push(year)
      picked.push(projected[chosen])
    })
    projected = picked
  }

  const seriesKeys =
    metricValue === 'net'
      ? [{ key: 'net', name: '净资产' }]
      : ALL_SERIES.map((item) => ({ key: item.key, name: item.name }))

  const series = seriesKeys.map((meta, seriesIndex) => ({
    key: meta.key,
    name: meta.name,
    values: projected.map((row) => row[seriesIndex]?.value ?? null) as (number | null)[]
  }))

  const legend = series.map((item) => legendOf(item.key, item.values))

  return [null, {
    billId: String(billId),
    startMonth: start,
    endMonth: end,
    grain: grainValue,
    metric: metricValue,
    memberId: memberId ? String(memberId) : null,
    capped,
    labels,
    series,
    legend
  }]
}
