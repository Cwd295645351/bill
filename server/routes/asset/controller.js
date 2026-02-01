const Member = require('../../database/modules/Member')
const Asset = require('../../database/modules/Asset')
const AssetRecord = require('../../database/modules/AssetRecord')
const mongoose = require('../../database/index')

// --- 成员管理 (Member) ---

exports.getMemberList = async ({ billId }) => {
  if (!billId) return ['账本id不能为空', null]
  const res = await Member.find({ billId: mongoose.Types.ObjectId(billId), isDel: false })
  return [null, res]
}

exports.addMember = async ({ name, billId }) => {
  if (!name) return ['成员名称不能为空', null]
  if (!billId) return ['账本id不能为空', null]
  const res = await Member.create({ name, billId: mongoose.Types.ObjectId(billId) })
  if (res) return [null, res]
  return ['创建成员失败', null]
}

exports.editMember = async ({ id, name }) => {
  if (!name) return ['成员名称不能为空', null]
  if (!id) return ['成员id不能为空', null]
  const res = await Member.findOneAndUpdate(
    { _id: mongoose.Types.ObjectId(id), isDel: false },
    { name },
    { new: true }
  )
  if (res) return [null, res]
  return ['编辑成员失败，成员可能已被删除', null]
}

exports.delMember = async ({ id }) => {
  if (!id) return ['成员id不能为空', null]
  const res = await Member.findOneAndUpdate(
    { _id: mongoose.Types.ObjectId(id), isDel: false },
    { isDel: true },
    { new: true }
  )
  if (res) return [null, true]
  return ['删除成员失败，成员可能已被删除', null]
}

// --- 资产管理 (Asset) ---

/** 获取资产列表
 * @param {string} billId 账本id
 * @param {string} memberId 成员id
 * @param {string} type 资产类型
 * @param {string} fourMoneyType 四笔钱类型
 * @returns {Array} [错误信息, 资产列表]
 */
exports.getAssetList = async ({ billId, memberId, type, fourMoneyType }) => {
  if (!billId) return ['账本id不能为空', null]
  const query = { isDel: false }
  if (memberId) query.memberId = mongoose.Types.ObjectId(memberId)
  if (billId) query.billId = mongoose.Types.ObjectId(billId)
  if (type) query.type = type
  if (fourMoneyType) query.fourMoneyType = fourMoneyType

  const res = await Asset.find(query).sort({ _id: -1 }).populate('memberId')
  return [null, res]
}

/** 创建资产
 * @param {string} name 资产名称
 * @param {string} billId 账本id
 * @param {string} memberId 成员id
 * @param {string} type 资产类型
 * @param {string} fourMoneyType 四笔钱类型
 * @param {number} latestAmount 最新金额
 * @param {string} insuranceCategory 保险分类
 * @param {number} annualPremium 年交保费
 * @returns {Array} [错误信息, 资产对象]
 */
exports.addAsset = async ({ name, billId, memberId, type, fourMoneyType, latestAmount, insuranceCategory, annualPremium }) => {
  if (!name) return ['资产名称不能为空', null]
  if (!billId) return ['账本id不能为空', null]
  if (!memberId) return ['成员id不能为空', null]
  if (!type) return ['资产类型不能为空', null]
  if (!fourMoneyType) return ['四笔钱类型不能为空', null]
  if (!latestAmount) return ['最新金额不能为空', null]
  const res = await Asset.create({
    name,
    billId: mongoose.Types.ObjectId(billId),
    memberId: mongoose.Types.ObjectId(memberId),
    type,
    fourMoneyType,
    latestAmount,
    insuranceCategory,
    annualPremium
  })
  if (res) {
    // 同步创建一条记录
    await AssetRecord.create({
      assetId: res._id,
      amount: latestAmount,
      date: Date.now()
    })
    return [null, res]
  }
  return ['创建资产失败', null]
}

/** 编辑资产
 * @param {string} id 资产id
 * @param {string} name 资产名称
 * @param {string} memberId 成员id
 * @param {string} type 资产类型
 * @param {string} fourMoneyType 四笔钱类型
 * @param {number} latestAmount 最新金额
 * @param {string} insuranceCategory 保险分类
 * @param {number} annualPremium 年交保费
 * @returns {Array} [错误信息, 资产对象]
 */
exports.editAsset = async ({ id, name, memberId, type, fourMoneyType, latestAmount, insuranceCategory, annualPremium }) => {
  if (!id) return ['资产id不能为空', null]
  if (!name) return ['资产名称不能为空', null]
  if (!memberId) return ['成员id不能为空', null]
  if (!type) return ['资产类型不能为空', null]
  if (!fourMoneyType) return ['四笔钱类型不能为空', null]
  if (!latestAmount) return ['最新金额不能为空', null]
  const res = await Asset.findOneAndUpdate(
    { _id: mongoose.Types.ObjectId(id), isDel: false },
    { name, memberId: mongoose.Types.ObjectId(memberId), type, fourMoneyType, latestAmount, insuranceCategory, annualPremium },
    { new: true }
  )
  if (!res) return ['编辑资产失败，资产可能已被删除', null]
  // 编辑后，需要创建一条记录
  const recordRes = await AssetRecord.create({
    assetId: res._id,
    amount: latestAmount,
    date: Date.now()
  })
  if (!recordRes) return ['创建资产记录失败', null]
  return [null, res]
}

/** 删除资产
 * @param {string} id 资产id
 * @returns {Array} [错误信息, 是否成功]
 */
exports.delAsset = async ({ id }) => {
  if (!id) return ['资产id不能为空', null]
  const res = await Asset.findOneAndUpdate(
    { _id: mongoose.Types.ObjectId(id), isDel: false },
    { isDel: true },
    { new: true }
  )

  if (!res) return ['删除资产失败，资产可能已被删除', null]
  // 删除后，需要删除资产记录
  const recordRes = await AssetRecord.deleteMany({ assetId: mongoose.Types.ObjectId(id) })
  if (!recordRes) return ['删除资产记录失败', null]
  return [null, true]
}

// --- 资产记录/盘点 (AssetRecord) ---

/** 添加资产记录
 * @param {string} assetId 资产id
 * @param {number} amount 金额
 * @param {number} date 日期
 * @returns {Array} [错误信息, 资产记录对象]
 */
exports.addAssetRecord = async ({ assetId, amount, date }) => {
  if (!assetId) return ['资产id不能为空', null]
  if (amount === undefined || amount === null) return ['金额不能为空', null]
  if (!date) return ['日期不能为空', null]

  // 1. 创建记录
  const record = await AssetRecord.create({
    assetId: mongoose.Types.ObjectId(assetId),
    amount,
    date: date
  })

  if (!record) return ['盘点记录创建失败', null]

  // 2. 更新 Asset 表的最新金额和日期（仅当资产未删除时）
  const updateRes = await Asset.findOneAndUpdate(
    { _id: mongoose.Types.ObjectId(assetId), isDel: false },
    {
      latestAmount: amount,
      lastUpdatedDate: date
    },
    { new: true }
  )

  if (!updateRes) return ['资产主表更新失败，资产可能已被删除', null]

  return [null, record]
}

/** 编辑资产记录
 * @param {string} id 资产记录id
 * @param {string} assetId 资产id
 * @param {number} amount 金额
 * @param {number} date 日期
 * @returns {Array} [错误信息, 资产记录对象]
 */
exports.editAssetRecord = async ({ id, assetId, amount, date }) => {
  if (!id) return ['资产记录id不能为空', null]
  if (!assetId) return ['资产id不能为空', null]
  if (amount === undefined || amount === null) return ['金额不能为空', null]
  if (!date) return ['日期不能为空', null]

  // 1. 更新当前记录
  const res = await AssetRecord.findOneAndUpdate(
    { _id: mongoose.Types.ObjectId(id), isDel: false },
    { amount, date },
    { new: true }
  )
  if (!res) return ['编辑资产记录失败，资产记录可能已被删除', null]

  // 2. 获取该资产下最新的记录，同步更新到 Asset 主表
  const latestRecord = await AssetRecord.findOne({ 
    assetId: mongoose.Types.ObjectId(assetId), 
    isDel: false 
  }).sort({ date: -1 })

  if (latestRecord) {
    const updateRes = await Asset.findOneAndUpdate(
      { _id: mongoose.Types.ObjectId(assetId), isDel: false },
      { 
        latestAmount: latestRecord.amount, 
        lastUpdatedDate: latestRecord.date 
      },
      { new: true }
    )
    if (!updateRes) return ['资产主表更新失败，资产可能已被删除', null]
  }

  return [null, res]
}

/** 删除资产记录
 * @param {string} id 资产记录id
 * @returns {Array} [错误信息, 是否成功]
 */
exports.delAssetRecord = async ({ id }) => {
  if (!id) return ['资产记录id不能为空', null]

  // 1. 获取该记录信息
  const record = await AssetRecord.findOne({ _id: mongoose.Types.ObjectId(id), isDel: false })
  if (!record) return ['资产记录不存在', null]

  const assetId = record.assetId

  // 2. 检查记录数，最后一条记录不允许删除（因为资产主表依赖记录来维持金额）
  const recordCount = await AssetRecord.countDocuments({ assetId: mongoose.Types.ObjectId(assetId), isDel: false })
  if (recordCount <= 1) return ['只剩一条记录时不能删除', null]

  // 3. 执行逻辑删除
  const res = await AssetRecord.findOneAndUpdate(
    { _id: mongoose.Types.ObjectId(id), isDel: false },
    { isDel: true },
    { new: true }
  )
  if (!res) return ['删除资产记录失败，资产记录可能已被删除', null]

  // 4. 获取删除后该资产最新的记录，同步更新到 Asset 主表
  const latestRecord = await AssetRecord.findOne({ assetId: mongoose.Types.ObjectId(assetId), isDel: false }).sort({ date: -1 })
  
  if (latestRecord) {
    const updateRes = await Asset.findOneAndUpdate(
      { _id: mongoose.Types.ObjectId(assetId), isDel: false },
      { 
        latestAmount: latestRecord.amount, 
        lastUpdatedDate: latestRecord.date 
      },
      { new: true }
    )
    if (!updateRes) return ['资产主表更新失败，资产可能已被删除', null]
  }

  return [null, true]
}

/** 获取资产记录
 * @param {string} assetId 资产id
 * @param {number} startDate 开始日期
 * @param {number} endDate 结束日期
 * @returns {Array} [错误信息, 资产记录列表]
 */
exports.getAssetRecords = async ({ assetId, startDate, endDate }) => {
  if (!assetId) return ['资产id不能为空', null]
  const query = { assetId: mongoose.Types.ObjectId(assetId), isDel: false }
  if (startDate || endDate) {
    query.date = {}
    if (startDate) query.date.$gte = startDate
    if (endDate) query.date.$lte = endDate
  }
  const res = await AssetRecord.find(query).sort({ date: -1 })
  return [null, res]
}

// --- 统计分析 (Statistics) ---

/**
 * 获取桑基图数据
 */
exports.getSankeyData = async ({ memberId }) => {
  const query = { isDel: false }
  if (memberId) query.memberId = mongoose.Types.ObjectId(memberId)

  const assets = await Asset.find(query)

  let totalAsset = 0
  let totalDebt = 0
  const typeMap = {} // 存储各资产类型的总额
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

    // 资产项节点
    nodes.push({ name: asset.name })
    // 类型 -> 具体资产 的连线
    links.push({ source: asset.type, target: asset.name, value: Math.abs(amount) })
  })

  const netAsset = totalAsset - totalDebt

  // 核心汇总节点
  const summaryNodes = [
    { name: '净资产' },
    { name: '负债' },
    { name: '总资产' },
    { name: '流动资金' },
    { name: '固定资金' },
    { name: '投资理财' },
    { name: '应收款' }
  ]

  // 核心连线
  const summaryLinks = [
    { source: '净资产', target: '总资产', value: netAsset },
    { source: '负债', target: '总资产', value: totalDebt }
  ]

  // 总资产 -> 各类型的连线
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
exports.getFourMoneySummary = async ({ memberId }) => {
  const query = { isDel: false }
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
exports.getMonthlyReport = async ({ year, memberId }) => {
  const query = { isDel: false }
  if (memberId) query.memberId = mongoose.Types.ObjectId(memberId)

  // 1. 获取所有相关资产
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

  // 2. 循环 1-12 月，计算每个月最后一天的快照
  for (let m = 0; m < 12; m++) {
    const monthEnd = dayjs(`${year}-${m + 1}-01`).endOf('month').valueOf()

    // 聚合查询：获取每个资产在 monthEnd 之前最近的一条记录
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

      // 更新最后更新时间
      const dateStr = dayjs(snap.lastDate).format('YYYY-MM-DD')
      if (result[type] && (!result[type].lastUpdate || dateStr > result[type].lastUpdate)) {
        result[type].lastUpdate = dateStr
      }
    })

    result['总净资产'].monthlyData[m] = result['总资产'].monthlyData[m] - result['总负债'].monthlyData[m]
  }

  // 3. 填充当前值和年度变化
  Object.keys(result).forEach(key => {
    const data = result[key].monthlyData
    const currentMonth = new Date().getFullYear() == year ? new Date().getMonth() : 11
    result[key].current = data[currentMonth]

    // 年度变化 = 当前月 - 去年12月(假设为0，实际应查询去年末数据，此处简化)
    result[key].yearChange = result[key].current - data[0]
  })

  return [null, result]
}
