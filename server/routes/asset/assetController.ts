import type { Row, WhereBag } from '../../types/domain'
import { Asset, AssetRecord, Member } from '../../database/index'
import { Op } from 'sequelize'
import { getRecentRecordsGrouped, placeRecordDate, recomputeLatestAmount } from '../../database/services/assetRecordService'

/** 金额必须大于 0。空值和非法值分开提示 */
const readPositiveAmount = (value: unknown, emptyMessage: string, invalidMessage: string): [string, null] | [null, number] => {
  if (value === undefined || value === null || value === '') return [emptyMessage, null]
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) return [invalidMessage, null]
  return [null, amount]
}

/** 非保险分类不保留险种和年交保费 */
const insurancePatch = (fourMoneyType: unknown, insuranceCategory: unknown, annualPremium: unknown) => {
  if (fourMoneyType !== 'insurance') return { insuranceCategory: null, annualPremium: null }
  const premium = annualPremium === undefined || annualPremium === null || annualPremium === '' ? null : Number(annualPremium)
  return {
    insuranceCategory: insuranceCategory ? String(insuranceCategory) : null,
    annualPremium: premium != null && Number.isFinite(premium) ? premium : null
  }
}

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
  const moneyType = type === 'debt' ? '' : fourMoneyType
  if (type !== 'debt' && !moneyType) return ['四笔钱类型不能为空', null]
  const [amountErr, amount] = readPositiveAmount(latestAmount, '最新金额不能为空', '最新金额必须大于0')
  if (amountErr || amount == null) return [amountErr, null]
  const member = await Member.findOne({ where: { id: memberId, billId, isDel: false } })
  if (!member) return ['成员不存在', null]
  const recordedAt = Date.now()
  const res = await Asset.create({
    name,
    billId,
    memberId,
    type,
    fourMoneyType: moneyType,
    latestAmount: amount,
    isDebt: type === 'debt',
    lastUpdatedDate: recordedAt,
    ...insurancePatch(moneyType, insuranceCategory, annualPremium)
  })
  if (res) {
    await AssetRecord.create({
      assetId: res.id,
      amount,
      date: recordedAt
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
  const moneyType = type === 'debt' ? '' : fourMoneyType
  if (type !== 'debt' && !moneyType) return ['四笔钱类型不能为空', null]
  const [amountErr, amount] = readPositiveAmount(latestAmount, '最新金额不能为空', '最新金额必须大于0')
  if (amountErr || amount == null) return [amountErr, null]
  const current = await Asset.findOne({ where: { id, isDel: false } })
  if (!current) return ['编辑资产失败，资产可能已被删除', null]
  const member = await Member.findOne({ where: { id: memberId, billId: current.billId, isDel: false } })
  if (!member) return ['成员不存在', null]
  const amountChanged = Number(current.latestAmount) !== amount
  const [affected] = await Asset.update(
    {
      name,
      memberId,
      type,
      fourMoneyType: moneyType,
      isDebt: type === 'debt',
      ...insurancePatch(moneyType, insuranceCategory, annualPremium)
    },
    { where: { id, isDel: false } }
  )
  if (!affected) return ['编辑资产失败，资产可能已被删除', null]
  if (amountChanged) {
    const date = await placeRecordDate(String(id), Date.now())
    const recordRes = await AssetRecord.create({ assetId: id, amount, date })
    if (!recordRes) return ['创建资产记录失败', null]
    await recomputeLatestAmount(String(id))
  }
  const res = await Asset.findByPk(id)
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
 *     change:     number|null,         // 合计变化金额；整组都没有上一次盘点时为空
 *     changeRate: number|null,         // 合计变化百分比；没有可比的上一次盘点时为空
 *     percent:    number,              // 占资产总额百分比
 *     assets: [{                       // 具体资产
 *       id, name, memberId, memberName,
 *       fourMoneyType, latestAmount,
 *       prevAmount,                    // 上一次盘点金额
 *       change,                        // 变化金额
 *       changeRate,                    // 变化百分比（null 表示无前值）
 *       percent                        // 占本组百分比
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
      change: number
      hasPrev: boolean
      assets: Row[]
    }> = {}
    items.forEach((asset) => {
      const key = String(asset.type || '')
      if (!groupMap[key]) {
        groupMap[key] = { type: key, typeName: typeNameMap[key] || key, amount: 0, prevAmount: 0, change: 0, hasPrev: false, assets: [] }
      }
      const prev = asset.id ? prevMap[asset.id] : null
      const current = Math.abs(Number(asset.latestAmount) || 0)
      const prevNumber = prev == null ? null : Math.abs(Number(prev) || 0)
      const change = prevNumber !== null ? current - prevNumber : 0
      const changeRate = prevNumber !== null && prevNumber !== 0 ? change / prevNumber : null

      groupMap[key].amount += current
      // 只累加有上一次盘点的资产。不能因为组内另有一笔没有上一次，就把整组变化清成 0
      if (prevNumber !== null) {
        groupMap[key].prevAmount += prevNumber
        groupMap[key].change += change
        groupMap[key].hasPrev = true
      }

      groupMap[key].assets.push({
        id: asset.id,
        name: asset.name,
        memberId: asset.memberId,
        memberName: asset.member?.name || '',
        type: asset.type,
        fourMoneyType: asset.fourMoneyType,
        latestAmount: asset.latestAmount,
        isDebt: Boolean(asset.isDebt),
        insuranceCategory: asset.insuranceCategory || '',
        annualPremium: asset.annualPremium,
        prevAmount: prev == null ? null : Number(prev),
        change,
        changeRate,
        percent: 0
      })
    })

    return Object.values(groupMap).map((g) => {
      const groupChange = g.hasPrev ? g.change : null
      const groupChangeRate = g.hasPrev && g.prevAmount !== 0 ? g.change / g.prevAmount : null
      return {
        type: g.type,
        typeName: g.typeName,
        amount: g.amount,
        change: groupChange,
        changeRate: groupChangeRate,
        percent: totalForPercent > 0 ? g.amount / totalForPercent : 0,
        assets: g.assets.map((asset) => ({
          ...asset,
          percent: g.amount > 0 ? Math.abs(Number(asset.latestAmount) || 0) / g.amount : 0
        }))
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
