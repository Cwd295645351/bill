import { Asset, AssetRecord, Bill, BillUser, Member } from '../../database'

export type AccessResult = { ok: true } | { ok: false }

/** 确认用户是该账本成员。失败说明由调用方决定。 */
export async function requireMember(userId: string | null | undefined, billId: string | null | undefined): Promise<AccessResult> {
  if (!userId || !billId) return { ok: false }
  const bill = await Bill.findOne({ where: { id: billId, isDel: false } })
  if (!bill) return { ok: false }
  const member = await BillUser.findOne({ where: { billId, userId } })
  if (!member) return { ok: false }
  return { ok: true }
}

/** 先确认是成员，再确认是创建者。失败说明由调用方决定。 */
export async function requireCreator(userId: string | null | undefined, billId: string | null | undefined): Promise<AccessResult> {
  const member = await requireMember(userId, billId)
  if (!member.ok) return member
  const bill = await Bill.findOne({ where: { id: billId, isDel: false } })
  if (!bill || String(bill.creator) !== String(userId)) return { ok: false }
  return { ok: true }
}

/** 由未隐藏资产得到账本 id */
export async function billIdOfAsset(assetId: string | null | undefined) {
  if (!assetId) return null
  const asset = await Asset.findOne({ where: { id: assetId, isDel: false } })
  return asset ? String(asset.billId || '') : null
}

/** 由未隐藏盘点得到账本 id */
export async function billIdOfRecord(id: string | null | undefined) {
  if (!id) return null
  const record = await AssetRecord.findOne({ where: { id, isDel: false } })
  if (!record) return null
  return billIdOfAsset(String(record.assetId || ''))
}

/** 由资产成员得到账本 id。已隐藏的成员仍能定位账本，避免跨账本探测 */
export async function billIdOfMember(id: string | null | undefined) {
  if (!id) return null
  const member = await Member.findByPk(id)
  return member ? String(member.billId || '') : null
}
