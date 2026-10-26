import type { Row, WhereBag } from '../../types/domain'
import { Asset, AssetRecord, Member } from '../../database/index'
import { Op } from 'sequelize'
import dayjs from 'dayjs'
import { getLatestSnapshotsBefore } from '../../database/services/assetRecordService'
import { getBillRates, toCny } from '../../database/services/assetFx'

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

  const typeName: Record<string, string> = {
    living: '流动资金',
    steady: '固定资产',
    longterm: '投资理财',
    receivable: '应收款'
  }
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

  for (let m = 0; m <= lastMonth; m++) {
    const monthEnd = dayjs(`${yearNum}-${String(m + 1).padStart(2, '0')}-01`).endOf('month').valueOf()
    const latest = assetIds.length ? await getLatestSnapshotsBefore(assetIds, monthEnd) : []
    const sums: Record<string, number> = {}
    const seen: Record<string, boolean> = {}
    const lastByKey: Record<string, string> = {}
    let assetSum = 0
    let debtSum = 0
    let seenAsset = false
    let seenDebt = false

    latest.forEach((snap: Row) => {
      const asset = assets.find((item: Row) => item.id === snap.assetId)
      if (!asset) return
      const amount = toCny(snap.amount, asset.currency, rates)
      const dateStr = dayjs(Number(snap.date)).format('YYYY-MM-DD')
      const touch = (key: string) => {
        if (!lastByKey[key] || dateStr > lastByKey[key]) lastByKey[key] = dateStr
      }
      if (asset.isDebt) {
        debtSum += amount
        seenDebt = true
        touch('总负债')
        touch('总净资产')
        return
      }
      const label = typeName[String(asset.type || '')]
      if (label) {
        sums[label] = (sums[label] || 0) + amount
        seen[label] = true
        touch(label)
      }
      assetSum += amount
      seenAsset = true
      touch('总资产')
      touch('总净资产')
    })

    categoryKeys.slice(0, 4).forEach((label) => {
      result[label].monthlyData[m] = seen[label] ? sums[label] || 0 : null
    })
    result['总资产'].monthlyData[m] = seenAsset ? assetSum : null
    result['总负债'].monthlyData[m] = seenDebt ? debtSum : null
    result['总净资产'].monthlyData[m] = seenAsset || seenDebt ? assetSum - debtSum : null

    Object.keys(lastByKey).forEach((key) => {
      if (result[key].monthlyData[m] == null) return
      if (!result[key].lastUpdate || lastByKey[key] > result[key].lastUpdate) {
        result[key].lastUpdate = lastByKey[key]
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
      const label = typeName[String(asset.type || '')]
      if (label) {
        sums[label] = (sums[label] || 0) + amount
        seen[label] = true
      }
      assetSum += amount
      seenAsset = true
    })
    categoryKeys.slice(0, 4).forEach((label) => {
      yearStart[label] = seen[label] ? sums[label] || 0 : null
    })
    yearStart['总资产'] = seenAsset ? assetSum : null
    yearStart['总负债'] = seenDebt ? debtSum : null
    yearStart['总净资产'] = seenAsset || seenDebt ? assetSum - debtSum : null
  }

  const roundCell = (value: number) => Math.round(value * 100) / 100
  categoryKeys.forEach((key) => {
    const current = result[key].monthlyData[lastMonth]
    const baseline = yearStart[key]
    result[key].current = current == null ? null : roundCell(current)
    // 较年初 = 所看月份 − 该年 1 月 1 日之前状态；年初无盘点按 0
    result[key].yearChange = current == null ? null : roundCell(current - (baseline ?? 0))
    result[key].monthlyData = result[key].monthlyData.map((value) => (value == null ? null : roundCell(value)))
  })

  return [null, result]
}
