const Asset = require('../../database/modules/Asset')
const AssetRecord = require('../../database/modules/AssetRecord')
const mongoose = require('../../database/index')

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
  const recordRes = await AssetRecord.create({
    assetId: res._id,
    amount: latestAmount,
    date: Date.now()
  })
  if (!recordRes) return ['创建资产记录失败', null]
  return [null, res]
}

/** 获取资产列表（含变化统计与分类汇总）
 * 用于资产总览页面，对每项资产补充"上次盘点金额"以计算变化，
 * 并按资产类型分组，同时返回资产和负债两部分数据。
 *
 * @param {string} billId   账本 id（必填）
 * @param {string} memberId 成员 id（可选，不传则返回全部成员）
 * @returns {Array} [错误信息, {
 *   assetAmount: number,               // 资产总额
 *   debtAmount:  number,               // 负债总额
 *   netAmount:   number,               // 净资产
 *   assetGroups: [{                    // 资产分组（流动资金/固定资产/投资理财/应收款）
 *     type:       string,              // 类型标识（如 living）
 *     typeName:   string,              // 中文名（如 流动资金）
 *     amount:     number,              // 该类型合计金额
 *     change:     number,              // 合计变化金额
 *     changeRate: number|null,         // 合计变化百分比
 *     percent:    number,              // 占资产总额百分比
 *     assets: [{                       // 具体资产
 *       _id, name, memberId, memberName,
 *       fourMoneyType, latestAmount,
 *       prevAmount,                    // 上一次盘点金额
 *       change,                        // 变化金额
 *       changeRate,                    // 变化百分比（null 表示无前值）
 *       percent                        // 占资产总额百分比
 *     }]
 *   }],
 *   debtGroups: [{                     // 负债分组（结构同上）
 *     ...
 *   }]
 * }]
 */
exports.getAssetListWithStats = async ({ billId, memberId }) => {
  if (!billId) return ['账本id不能为空', null]

  const query = { billId: mongoose.Types.ObjectId(billId), isDel: false }
  if (memberId) query.memberId = mongoose.Types.ObjectId(memberId)

  const allAssets = await Asset.find(query).sort({ type: 1, _id: -1 }).populate('memberId')
  if (!allAssets.length) return [null, { assetAmount: 0, debtAmount: 0, netAmount: 0, assetGroups: [], debtGroups: [] }]

  const assetIds = allAssets.map(a => a._id)

  // 批量查询每项资产最近两条记录（用于计算变化）
  const recentRecords = await AssetRecord.aggregate([
    { $match: { assetId: { $in: assetIds }, isDel: false } },
    { $sort: { date: -1 } },
    { $group: {
      _id: '$assetId',
      records: { $push: { amount: '$amount', date: '$date' } }
    }}
  ])

  const prevMap = {}
  for (const r of recentRecords) {
    const sorted = r.records.sort((a, b) => b.date - a.date)
    prevMap[r._id.toString()] = sorted.length >= 2 ? sorted[1].amount : null
  }

  // 拆分资产与负债
  const assetItems = allAssets.filter(a => !a.isDebt)
  const debtItems = allAssets.filter(a => a.isDebt)

  const assetAmount = assetItems.reduce((sum, a) => sum + Math.abs(a.latestAmount), 0)
  const debtAmount = debtItems.reduce((sum, a) => sum + Math.abs(a.latestAmount), 0)
  const netAmount = assetAmount - debtAmount

  const typeNameMap = {
    living: '流动资金',
    steady: '固定资产',
    longterm: '投资理财',
    receivable: '应收款',
    debt: '负债'
  }

  // 通用分组方法
  const buildGroups = (items, totalForPercent) => {
    const groupMap = {}
    items.forEach(asset => {
      const key = asset.type
      if (!groupMap[key]) {
        groupMap[key] = { type: key, typeName: typeNameMap[key] || key, amount: 0, prevAmount: 0, hasPrev: true, assets: [] }
      }
      const prev = prevMap[asset._id.toString()]
      const current = Math.abs(asset.latestAmount)
      const change = prev !== null ? current - Math.abs(prev) : 0
      const changeRate = prev !== null && prev !== 0 ? change / Math.abs(prev) : null

      groupMap[key].amount += current
      if (prev !== null) {
        groupMap[key].prevAmount += Math.abs(prev)
      } else {
        groupMap[key].hasPrev = false
      }

      groupMap[key].assets.push({
        _id: asset._id,
        name: asset.name,
        memberId: asset.memberId,
        memberName: asset.memberId?.name || '',
        type: asset.type,
        fourMoneyType: asset.fourMoneyType,
        latestAmount: asset.latestAmount,
        prevAmount: prev,
        change,
        changeRate,
        percent: totalForPercent > 0 ? current / totalForPercent : 0
      })
    })

    return Object.values(groupMap).map(g => {
      const groupChange = g.hasPrev ? g.amount - g.prevAmount : 0
      const groupChangeRate = g.hasPrev && g.prevAmount !== 0 ? groupChange / g.prevAmount : null
      return {
        type: g.type,
        typeName: g.typeName,
        amount: g.amount,
        change: groupChange,
        changeRate: groupChangeRate,
        percent: totalForPercent > 0 ? g.amount / totalForPercent : 0,
        assets: g.assets
      }
    })
  }

  return [null, {
    assetAmount,
    debtAmount,
    netAmount,
    assetGroups: buildGroups(assetItems, assetAmount),
    debtGroups: buildGroups(debtItems, debtAmount)
  }]
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
  // 软删除关联的资产记录
  const recordRes = await AssetRecord.updateMany(
    { assetId: mongoose.Types.ObjectId(id), isDel: false },
    { isDel: true }
  )
  if (!recordRes) return ['删除资产记录失败', null]
  return [null, true]
}
