import { QueryTypes, type Transaction as DbTransaction } from 'sequelize'
import { Asset, AssetRecord, Bill, Member, sequelize } from '../../database'

/** 未删除账本上调用方会用到的字段 */
export type BillBrief = { id: string; name: string; creator: string }

/**
 * 一次读出的账本访问结果，四种互斥：
 * invalid 缺少账本编号；not_found 账本不存在；not_member 账本在但不是成员；member 是成员。
 */
export type BillRole =
  | { kind: 'invalid' }
  | { kind: 'not_found' }
  | { kind: 'not_member'; bill: BillBrief }
  | { kind: 'member'; bill: BillBrief; isCreator: boolean }

type BillRoleRow = { id: string; name: string; creator: string; isMember: number | string | boolean }

/**
 * 一次读取未删除账本，并判断调用者是不是成员、是不是创建者。
 * 有账本编号时即使没有用户也会查账本，方便调用方区分不存在和不是成员。
 */
export async function readBillRole(userId: string | null | undefined, billId: string | null | undefined): Promise<BillRole> {
  if (!billId) return { kind: 'invalid' }
  const rows = (await sequelize.query(
    `SELECT b.id, b.name, b.creator,
            EXISTS(SELECT 1 FROM bill_users bu WHERE bu.bill_id = b.id AND bu.user_id = :userId) AS isMember
     FROM bills b
     WHERE b.id = :billId AND b.is_del = 0
     LIMIT 1`,
    { replacements: { userId: userId || '', billId }, type: QueryTypes.SELECT }
  )) as BillRoleRow[]
  const row = rows[0]
  if (!row) return { kind: 'not_found' }
  const bill: BillBrief = {
    id: String(row.id),
    name: String(row.name ?? ''),
    creator: String(row.creator)
  }
  if (!userId || !Number(row.isMember)) return { kind: 'not_member', bill }
  return { kind: 'member', bill, isCreator: String(bill.creator) === String(userId) }
}

/** 锁住账本行，让同一账本上的记账、预算、计划等写操作串行执行 */
export async function lockBill(billId: string | null | undefined, transaction: DbTransaction) {
  if (!billId) return null
  const bill = await Bill.findByPk(billId, { transaction, lock: transaction.LOCK.UPDATE })
  if (!bill || bill.isDel) return null
  return bill
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
