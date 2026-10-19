import type { Row, WhereBag } from '../../types/domain'
import { Asset, AssetRecord, Member } from '../../database/index'
import { Op } from 'sequelize'
import { getRecentRecordsGrouped } from '../../database/services/assetRecordService'

/** 获取资产列表
 * @param {string} billId 账本id
 * @param {string} memberId 成员id
 * @param {string} type 资产类型
 * @param {string} fourMoneyType 四笔钱类型
 * @returns {Array} [错误信息, 资产列表]
 */
export const getAssetList = async ({ billId, memberId, type, fourMoneyType }: Row) => {
  if (!billId) return ['账本id不能为空', null]
  const query: WhereBag = { isDel: false }
  if (memberId) query.memberId = memberId
  if (billId) query.billId = billId
  if (type) query.type = type
  if (fourMoneyType) query.fourMoneyType = fourMoneyType

  const res = await Asset.findAll({
    where: query,
    order: [['id', 'DESC']],
    include: [{ model: Member, as: 'member' }]
  })
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
export const addAsset = async ({ name, billId, memberId, type, fourMoneyType, latestAmount, insuranceCategory, annualPremium }: Row) => {
  if (!name) return ['资产名称不能为空', null]
  if (!billId) return ['账本id不能为空', null]
  if (!memberId) return ['成员id不能为空', null]
  if (!type) return ['资产类型不能为空', null]
  if (!fourMoneyType) return ['四笔钱类型不能为空', null]
  if (!latestAmount) return ['最新金额不能为空', null]
  const res = await Asset.create({
    name,
    billId,
    memberId,
    type,
    fourMoneyType,
    latestAmount,
    insuranceCategory,
    annualPremium
  })
  if (res) {
    await AssetRecord.create({
      assetId: res.id,
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
export const editAsset = async ({ id, name, memberId, type, fourMoneyType, latestAmount, insuranceCategory, annualPremium }: Row) => {
  if (!id) return ['资产id不能为空', null]
  if (!name) return ['资产名称不能为空', null]
  if (!memberId) return ['成员id不能为空', null]
  if (!type) return ['资产类型不能为空', null]
  if (!fourMoneyType) return ['四笔钱类型不能为空', null]
  if (!latestAmount) return ['最新金额不能为空', null]
  const [affected] = await Asset.update(
    { name, memberId, type, fourMoneyType, latestAmount, insuranceCategory, annualPremium },
    { where: { id, isDel: false } }
  )
  const res = affected ? await Asset.findByPk(id) : null
  if (!res) return ['编辑资产失败，资产可能已被删除', null]
  const recordRes = await AssetRecord.create({
    assetId: res.id,
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
 *       id, name, memberId, memberName,
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
export const getAssetListWithStats = async ({ billId, memberId }: Row) => {
  if (!billId) return ['账本id不能为空', null]

  const query: WhereBag = { billId, isDel: false }
  if (memberId) query.memberId = memberId

  const allAssets = await Asset.findAll({
    where: query,
    order: [['type', 'ASC'], ['id', 'DESC']],
    include: [{ model: Member, as: 'member' }]
  })
  if (!allAssets.length) return [null, { assetAmount: 0, debtAmount: 0, netAmount: 0, assetGroups: [], debtGroups: [] }]

  const assetIds = allAssets.map((a: Row) => a.id)
  const recentMap = await getRecentRecordsGrouped(assetIds, 2)
  const prevMap: Record<string, number | string | null> = {}
  Object.keys(recentMap).forEach((assetId) => {
    const list = recentMap[assetId] || []
    prevMap[assetId] = list.length >= 2 ? list[1].amount ?? null : null
  })

  // 拆分资产与负债
  const assetItems = allAssets.filter((a: Row) => !a.isDebt)
  const debtItems = allAssets.filter((a: Row) => a.isDebt)

  const assetAmount = assetItems.reduce((sum: number, a: Row) => sum + Math.abs(Number(a.latestAmount) || 0), 0)
  const debtAmount = debtItems.reduce((sum: number, a: Row) => sum + Math.abs(Number(a.latestAmount) || 0), 0)
  const netAmount = assetAmount - debtAmount

  const typeNameMap: Record<string, string> = {
    living: '流动资金',
    steady: '固定资产',
    longterm: '投资理财',
    receivable: '应收款',
    debt: '负债'
  }

  // 通用分组方法
  const buildGroups = (items: Row[], totalForPercent: number) => {
    const groupMap: Record<string, {
      type: string
      typeName: string
      amount: number
      prevAmount: number
      hasPrev: boolean
      assets: Row[]
    }> = {}
    items.forEach((asset) => {
      const key = String(asset.type || '')
      if (!groupMap[key]) {
        groupMap[key] = { type: key, typeName: typeNameMap[key] || key, amount: 0, prevAmount: 0, hasPrev: true, assets: [] }
      }
      const prev = asset.id ? prevMap[asset.id] : null
      const current = Math.abs(Number(asset.latestAmount) || 0)
      const prevNumber = prev == null ? null : Number(prev)
      const change = prevNumber !== null ? current - Math.abs(prevNumber) : 0
      const changeRate = prevNumber !== null && prevNumber !== 0 ? change / Math.abs(prevNumber) : null

      groupMap[key].amount += current
      if (prev !== null) {
        groupMap[key].prevAmount += Math.abs(Number(prev) || 0)
      } else {
        groupMap[key].hasPrev = false
      }

      groupMap[key].assets.push({
        id: asset.id,
        name: asset.name,
        memberId: asset.memberId,
        memberName: asset.member?.name || '',
        type: asset.type,
        fourMoneyType: asset.fourMoneyType,
        latestAmount: asset.latestAmount,
        prevAmount: prev == null ? null : Number(prev),
        change,
        changeRate,
        percent: totalForPercent > 0 ? current / totalForPercent : 0
      })
    })

    return Object.values(groupMap).map((g) => {
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
export const delAsset = async ({ id }: Row) => {
  if (!id) return ['资产id不能为空', null]
  const [affected] = await Asset.update({ isDel: true }, { where: { id, isDel: false } })
  const res = affected ? await Asset.findByPk(id) : null

  if (!res) return ['删除资产失败，资产可能已被删除', null]
  // 软删除关联的资产记录
  await AssetRecord.update({ isDel: true }, { where: { assetId: id, isDel: false } })
  return [null, true]
}
