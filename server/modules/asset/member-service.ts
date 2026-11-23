import type { Row } from '../../types/domain'
import { Asset, Member } from '../../database/index'

export const getMemberList = async ({ billId }: Row) => {
  if (!billId) return ['账本id不能为空', null]
  const res = await Member.findAll({ where: { billId, isDel: false } })
  return [null, res]
}

export const addMember = async ({ name, billId }: Row) => {
  const text = String(name || '').trim()
  if (!text) return ['成员名称不能为空', null]
  if (text.length > 64) return ['成员名称不能超过64个字', null]
  if (!billId) return ['账本id不能为空', null]
  const res = await Member.create({ name: text, billId })
  if (res) return [null, res]
  return ['创建成员失败', null]
}

export const editMember = async ({ id, name }: Row) => {
  const text = String(name || '').trim()
  if (!text) return ['成员名称不能为空', null]
  if (text.length > 64) return ['成员名称不能超过64个字', null]
  if (!id) return ['成员id不能为空', null]
  const current = await Member.findOne({ where: { id, isDel: false } })
  if (!current) return ['编辑成员失败，成员可能已被删除', null]
  if (String(current.name || '') !== text) {
    await Member.update({ name: text }, { where: { id, isDel: false } })
  }
  const res = await Member.findByPk(id)
  if (res) return [null, res]
  return ['编辑成员失败，成员可能已被删除', null]
}

export const delMember = async ({ id }: Row) => {
  if (!id) return ['成员id不能为空', null]
  const holding = await Asset.count({ where: { memberId: id, isDel: false } })
  if (holding) return ['该成员名下还有资产，不能删除', null]
  const [affected] = await Member.update({ isDel: true }, { where: { id, isDel: false } })
  if (affected) return [null, true]
  return ['删除成员失败，成员可能已被删除', null]
}
