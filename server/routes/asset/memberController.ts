import type { Row } from '../../types/domain'
import { Member } from '../../database/index'

export const getMemberList = async ({ billId }: Row) => {
  if (!billId) return ['账本id不能为空', null]
  const res = await Member.findAll({ where: { billId, isDel: false } })
  return [null, res]
}

export const addMember = async ({ name, billId }: Row) => {
  if (!name) return ['成员名称不能为空', null]
  if (!billId) return ['账本id不能为空', null]
  const res = await Member.create({ name, billId })
  if (res) return [null, res]
  return ['创建成员失败', null]
}

export const editMember = async ({ id, name }: Row) => {
  if (!name) return ['成员名称不能为空', null]
  if (!id) return ['成员id不能为空', null]
  const [affected] = await Member.update({ name }, { where: { id, isDel: false } })
  const res = affected ? await Member.findByPk(id) : null
  if (res) return [null, res]
  return ['编辑成员失败，成员可能已被删除', null]
}

export const delMember = async ({ id }: Row) => {
  if (!id) return ['成员id不能为空', null]
  const [affected] = await Member.update({ isDel: true }, { where: { id, isDel: false } })
  if (affected) return [null, true]
  return ['删除成员失败，成员可能已被删除', null]
}
