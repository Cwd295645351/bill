import type { Row, WhereBag } from '../../types/domain'
import { Asset, Member } from '../../database/index'
import dayjs from 'dayjs'
import { getLatestSnapshotsBefore } from '../../database/services/assetRecordService'

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
export const getAssetOverview = async ({ billId, memberId }: Row) => {
  if (!billId) return ['账本id不能为空', null]

  const query: WhereBag = { billId, isDel: false }
  if (memberId) query.memberId = memberId

  const assets = await Asset.findAll({ where: query })
  if (!assets.length) {
    const referenceDate = dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD')
    return [null, {
      netAmount: 0, assetAmount: 0, debtAmount: 0,
      referenceDate, totalChange: 0, categoryChanges: []
    }]
  }

  const assetIds = assets.map((a: Row) => a.id)

  // 当前汇总
  let assetAmount = 0
  let debtAmount = 0
  const currentByType: Record<string, number> = {}

  const typeNameMap: Record<string, string> = {
    living: '流动资金',
    steady: '固定资产',
    longterm: '投资理财',
    receivable: '应收款',
    debt: '负债'
  }

  assets.forEach((a: Row) => {
    const type = a.type || ''
    const latest = Math.abs(Number(a.latestAmount) || 0)
    if (!currentByType[type]) currentByType[type] = 0
    currentByType[type] += latest

    if (a.isDebt) {
      debtAmount += latest
    } else {
      assetAmount += Number(a.latestAmount) || 0
    }
  })

  const netAmount = assetAmount - debtAmount

  // 上月末基准日期
  const lastMonthEnd = dayjs().subtract(1, 'month').endOf('month')
  const referenceDate = lastMonthEnd.format('YYYY-MM-DD')
  const refTimestamp = lastMonthEnd.valueOf()

  // 聚合查询：获取每个资产在上月末时的最新快照
  const prevSnapshots = await getLatestSnapshotsBefore(assetIds, refTimestamp)

  const prevByType: Record<string, number> = {}
  let prevAssetAmount = 0
  prevSnapshots.forEach((snap: Row) => {
    const asset = assets.find((a: Row) => a.id === snap.assetId)
    if (!asset) return
    const type = asset.type || ''
    const amount = Math.abs(Number(snap.amount) || 0)
    if (!prevByType[type]) prevByType[type] = 0
    prevByType[type] += amount
    if (!asset.isDebt) prevAssetAmount += amount
  })

  // 构造各类型变化数据
  const allTypes = [...new Set([...Object.keys(currentByType), ...Object.keys(prevByType)])]
  const categoryChanges = allTypes.map((type) => {
    const current = currentByType[type] || 0
    const prev = prevByType[type] || 0
    return {
      type,
      typeName: typeNameMap[type] || type,
      current,
      prev,
      change: current - prev
    }
  })

  // 总资产变化只比较非负债，负债单独出现在分类变化里
  const totalChange = assetAmount - prevAssetAmount

  return [null, {
    netAmount,
    assetAmount,
    debtAmount,
    referenceDate,
    totalChange,
    categoryChanges
  }]
}

/**
 * 获取桑基图数据。负债只从左侧汇入总资产，类型节点使用中文名。
 */
export const getSankeyData = async ({ billId, memberId }: Row) => {
  if (!billId) return ['账本id不能为空', null]
  const query: WhereBag = { billId, isDel: false }
  if (memberId) query.memberId = memberId

  const assets = await Asset.findAll({
    where: query,
    include: [{ model: Member, as: 'member' }]
  })

  const typeName: Record<string, string> = {
    living: '流动资金',
    steady: '固定资产',
    longterm: '投资理财',
    receivable: '应收款'
  }
  let totalAsset = 0
  let totalDebt = 0
  const typeAmount: Record<string, number> = {}
  const nodes: { id: string; name: string; memberName?: string; detail?: string; kind: string }[] = []
  const links: { source: string; target: string; value: number }[] = []
  const debtNames: string[] = []
  const debtMembers = new Set<string>()

  assets.forEach((asset: Row) => {
    const amount = Math.abs(Number(asset.latestAmount) || 0)
    if (amount <= 0) return
    const memberName = asset.member?.name ? String(asset.member.name) : ''
    if (asset.isDebt) {
      totalDebt += amount
      if (asset.name) debtNames.push(String(asset.name))
      if (memberName) debtMembers.add(memberName)
      return
    }
    const label = typeName[String(asset.type || '')] || String(asset.type || '')
    totalAsset += amount
    typeAmount[label] = (typeAmount[label] || 0) + amount
    const id = `a-${asset.id}`
    nodes.push({ id, name: asset.name || '', memberName, kind: 'asset' })
    links.push({ source: `t-${label}`, target: id, value: amount })
  })

  const netWorth = totalAsset - totalDebt
  nodes.unshift(
    { id: 'net', name: '净资产', kind: 'summary' },
    {
      id: 'debt',
      name: '负债',
      kind: 'summary',
      detail: debtNames.join('、'),
      memberName: debtMembers.size === 1 ? [...debtMembers][0] : ''
    },
    { id: 'total', name: '总资产', kind: 'summary' }
  )
  Object.keys(typeAmount).forEach((label) => {
    if (typeAmount[label] <= 0) return
    nodes.push({ id: `t-${label}`, name: label, kind: 'type' })
    links.push({ source: 'total', target: `t-${label}`, value: typeAmount[label] })
  })
  if (netWorth > 0) links.push({ source: 'net', target: 'total', value: netWorth })
  if (totalDebt > 0) links.push({ source: 'debt', target: 'total', value: totalDebt })

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
    if (bucket) {
      bucket.amount += Number(asset.latestAmount) || 0
      bucket.count += 1
      bucket.assets.push(asset)

      if (type === 'insurance') {
        const insurance = summary.insurance
        insurance.totalPremium = (insurance.totalPremium || 0) + (Number(asset.annualPremium) || 0)
        const cat = asset.insuranceCategory || '其他'
        const categories = insurance.categories || {}
        insurance.categories = categories
        if (!categories[cat]) categories[cat] = 0
        categories[cat] += 1
      }
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
      const amount = Math.abs(Number(snap.amount) || 0)
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

  const roundCell = (value: number) => Math.round(value * 100) / 100
  categoryKeys.forEach((key) => {
    const current = result[key].monthlyData[lastMonth]
    const january = result[key].monthlyData[0]
    result[key].current = current == null ? null : roundCell(current)
    // 较年初只和 1 月比。1 月没有盘点时按 0，不能拿本月自己当基准，否则差额会变成 0
    result[key].yearChange = current == null ? null : roundCell(current - (january ?? 0))
    result[key].monthlyData = result[key].monthlyData.map((value) => (value == null ? null : roundCell(value)))
  })

  return [null, result]
}
