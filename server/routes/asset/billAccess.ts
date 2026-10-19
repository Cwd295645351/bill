import { Asset, AssetRecord, BillUser, Member } from '../../database'
import { queryString, type HttpContext } from '../../types/domain'

/** 当前登录用户。未登录时为空 */
const currentUserId = (ctx: HttpContext) => queryString(ctx.header.userid)

/**
 * 确认当前用户是这个账本的成员。
 * @returns 失败文案；通过时为 null
 */
const assertBillMember = async (ctx: HttpContext, billId: string | null | undefined) => {
  const userId = currentUserId(ctx)
  if (!userId) return 'userId不能为空'
  if (!billId) return '账本id不能为空'
  const member = await BillUser.findOne({ where: { billId, userId } })
  if (!member) return '无权查看该账本'
  return null
}

/** 由未隐藏资产得到账本 id */
const billIdOfAsset = async (assetId: string | null | undefined) => {
  if (!assetId) return null
  const asset = await Asset.findOne({ where: { id: assetId, isDel: false } })
  return asset ? String(asset.billId || '') : null
}

/** 由未隐藏盘点得到账本 id */
const billIdOfRecord = async (id: string | null | undefined) => {
  if (!id) return null
  const record = await AssetRecord.findOne({ where: { id, isDel: false } })
  if (!record) return null
  return billIdOfAsset(String(record.assetId || ''))
}

/** 由资产成员得到账本 id。已隐藏的成员仍能定位账本，避免跨账本探测 */
const billIdOfMember = async (id: string | null | undefined) => {
  if (!id) return null
  const member = await Member.findByPk(id)
  return member ? String(member.billId || '') : null
}

export { assertBillMember, billIdOfAsset, billIdOfRecord, billIdOfMember }
