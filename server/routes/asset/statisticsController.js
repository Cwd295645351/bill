const Asset = require('../../database/modules/Asset')
const AssetRecord = require('../../database/modules/AssetRecord')
const mongoose = require('../../database/index')
const dayjs = require('dayjs')

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
exports.getAssetOverview = async ({ billId, memberId }) => {
  if (!billId) return ['账本id不能为空', null]

  const query = { billId: mongoose.Types.ObjectId(billId), isDel: false }
  if (memberId) query.memberId = mongoose.Types.ObjectId(memberId)

  const assets = await Asset.find(query)
  if (!assets.length) {
    return [null, {
      netAmount: 0, assetAmount: 0, debtAmount: 0,
      referenceDate: '', totalChange: 0, categoryChanges: []
    }]
  }

  const assetIds = assets.map(a => a._id)

  // 当前汇总
  let assetAmount = 0
  let debtAmount = 0
  const currentByType = {}

  const typeNameMap = {
    living: '流动资金',
    steady: '固定资产',
    longterm: '投资理财',
    receivable: '应收款',
    debt: '负债'
  }

  assets.forEach(a => {
    if (!currentByType[a.type]) currentByType[a.type] = 0
    currentByType[a.type] += Math.abs(a.latestAmount)

    if (a.isDebt) {
      debtAmount += Math.abs(a.latestAmount)
    } else {
      assetAmount += a.latestAmount
    }
  })

  const netAmount = assetAmount - debtAmount

  // 上月末基准日期
  const lastMonthEnd = dayjs().subtract(1, 'month').endOf('month')
  const referenceDate = lastMonthEnd.format('YYYY-MM-DD')
  const refTimestamp = lastMonthEnd.valueOf()

  // 聚合查询：获取每个资产在上月末时的最新快照
  const prevSnapshots = await AssetRecord.aggregate([
    { $match: { assetId: { $in: assetIds }, date: { $lte: refTimestamp }, isDel: false } },
    { $sort: { date: -1 } },
    { $group: { _id: '$assetId', amount: { $first: '$amount' } } }
  ])

  const prevByType = {}
  prevSnapshots.forEach(snap => {
    const asset = assets.find(a => a._id.toString() === snap._id.toString())
    if (!asset) return
    if (!prevByType[asset.type]) prevByType[asset.type] = 0
    prevByType[asset.type] += Math.abs(snap.amount)
  })

  // 构造各类型变化数据
  const allTypes = [...new Set([...Object.keys(currentByType), ...Object.keys(prevByType)])]
  const categoryChanges = allTypes.map(type => {
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

  const prevTotal = Object.values(prevByType).reduce((s, v) => s + v, 0)
  const currentTotal = assetAmount + debtAmount
  const totalChange = currentTotal - prevTotal

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
 * 获取桑基图数据
 */
exports.getSankeyData = async ({ billId, memberId }) => {
  const query = { isDel: false }
  if (billId) query.billId = mongoose.Types.ObjectId(billId)
  if (memberId) query.memberId = mongoose.Types.ObjectId(memberId)

  const assets = await Asset.find(query)

  let totalAsset = 0
  let totalDebt = 0
  const typeMap = {}
  const nodes = []
  const links = []

  assets.forEach((asset) => {
    const amount = asset.latestAmount
    if (asset.isDebt) {
      totalDebt += Math.abs(amount)
    } else {
      totalAsset += amount
    }

    if (!typeMap[asset.type]) typeMap[asset.type] = 0
    typeMap[asset.type] += amount

    nodes.push({ name: asset.name })
    links.push({ source: asset.type, target: asset.name, value: Math.abs(amount) })
  })

  const netAsset = totalAsset - totalDebt

  const summaryNodes = [
    { name: '净资产' },
    { name: '负债' },
    { name: '总资产' },
    { name: '流动资金' },
    { name: '固定资金' },
    { name: '投资理财' },
    { name: '应收款' }
  ]

  const summaryLinks = [
    { source: '净资产', target: '总资产', value: netAsset },
    { source: '负债', target: '总资产', value: totalDebt }
  ]

  Object.keys(typeMap).forEach((type) => {
    summaryLinks.push({ source: '总资产', target: type, value: Math.abs(typeMap[type]) })
  })

  return [
    null,
    {
      nodes: [...new Set([...summaryNodes, ...nodes].map((n) => n.name))].map((name) => ({ name })),
      links: [...summaryLinks, ...links].filter((l) => l.value > 0)
    }
  ]
}

/**
 * 获取四笔钱配置概览
 */
exports.getFourMoneySummary = async ({ billId, memberId }) => {
  const query = { isDel: false }
  if (billId) query.billId = mongoose.Types.ObjectId(billId)
  if (memberId) query.memberId = mongoose.Types.ObjectId(memberId)

  const assets = await Asset.find(query)

  const summary = {
    living: { name: '活钱', amount: 0, count: 0, assets: [] },
    steady: { name: '稳健', amount: 0, count: 0, assets: [] },
    longterm: { name: '长期', amount: 0, count: 0, assets: [] },
    insurance: { name: '保险', amount: 0, count: 0, assets: [], totalPremium: 0, categories: {} }
  }

  assets.forEach((asset) => {
    const type = asset.fourMoneyType
    if (summary[type]) {
      summary[type].amount += asset.latestAmount
      summary[type].count += 1
      summary[type].assets.push(asset)

      if (type === 'insurance') {
        summary.insurance.totalPremium += asset.annualPremium || 0
        const cat = asset.insuranceCategory || '其他'
        if (!summary.insurance.categories[cat]) summary.insurance.categories[cat] = 0
        summary.insurance.categories[cat] += 1
      }
    }
  })

  return [null, summary]
}

/**
 * 获取资产月历数据
 */
exports.getMonthlyReport = async ({ billId, year, memberId }) => {
  const query = { isDel: false }
  if (billId) query.billId = mongoose.Types.ObjectId(billId)
  if (memberId) query.memberId = mongoose.Types.ObjectId(memberId)

  const assets = await Asset.find(query)
  const assetIds = assets.map(a => a._id)

  const result = {
    '流动资金': { current: 0, yearChange: 0, lastUpdate: '', monthlyData: new Array(12).fill(0) },
    '投资理财': { current: 0, yearChange: 0, lastUpdate: '', monthlyData: new Array(12).fill(0) },
    '固定资产': { current: 0, yearChange: 0, lastUpdate: '', monthlyData: new Array(12).fill(0) },
    '应收款': { current: 0, yearChange: 0, lastUpdate: '', monthlyData: new Array(12).fill(0) },
    '总资产': { current: 0, yearChange: 0, lastUpdate: '', monthlyData: new Array(12).fill(0) },
    '总负债': { current: 0, yearChange: 0, lastUpdate: '', monthlyData: new Array(12).fill(0) },
    '总净资产': { current: 0, yearChange: 0, lastUpdate: '', monthlyData: new Array(12).fill(0) }
  }

  for (let m = 0; m < 12; m++) {
    const monthEnd = dayjs(`${year}-${m + 1}-01`).endOf('month').valueOf()

    const snapshots = await AssetRecord.aggregate([
      { $match: { assetId: { $in: assetIds }, date: { $lte: monthEnd }, isDel: false } },
      { $sort: { date: -1 } },
      { $group: { _id: '$assetId', amount: { $first: '$amount' }, lastDate: { $first: '$date' } } }
    ])

    snapshots.forEach(snap => {
      const asset = assets.find(a => a._id.toString() === snap._id.toString())
      if (!asset) return

      const amt = snap.amount
      const type = asset.type

      if (result[type]) result[type].monthlyData[m] += amt

      if (asset.isDebt) {
        result['总负债'].monthlyData[m] += Math.abs(amt)
      } else {
        result['总资产'].monthlyData[m] += amt
      }

      const dateStr = dayjs(snap.lastDate).format('YYYY-MM-DD')
      if (result[type] && (!result[type].lastUpdate || dateStr > result[type].lastUpdate)) {
        result[type].lastUpdate = dateStr
      }
      // 同步更新汇总类别的 lastUpdate
      if (asset.isDebt) {
        if (!result['总负债'].lastUpdate || dateStr > result['总负债'].lastUpdate) {
          result['总负债'].lastUpdate = dateStr
        }
      } else {
        if (!result['总资产'].lastUpdate || dateStr > result['总资产'].lastUpdate) {
          result['总资产'].lastUpdate = dateStr
        }
      }
      if (!result['总净资产'].lastUpdate || dateStr > result['总净资产'].lastUpdate) {
        result['总净资产'].lastUpdate = dateStr
      }
    })

    result['总净资产'].monthlyData[m] = result['总资产'].monthlyData[m] - result['总负债'].monthlyData[m]
  }

  Object.keys(result).forEach(key => {
    const data = result[key].monthlyData
    const currentMonth = new Date().getFullYear() == year ? new Date().getMonth() : 11
    result[key].current = data[currentMonth]
    result[key].yearChange = result[key].current - data[0]
  })

  return [null, result]
}
