import { Op } from 'sequelize'
import { CatalogDefault } from '../../database/index'

type CatalogKind = 'cost' | 'income' | 'pay_method'

const KINDS: CatalogKind[] = ['cost', 'income', 'pay_method']

const isKind = (v: string): v is CatalogKind => KINDS.includes(v as CatalogKind)

/** 新建账本用：未删除模板 */
const listActiveCatalogDefaults = async () => {
  const rows = (await CatalogDefault.findAll({
    where: { isDel: false },
    order: [['id', 'ASC']],
    raw: true
  })) as Array<{ kind: string; id: string; name: string }>
  return {
    cost: rows.filter((r) => r.kind === 'cost').map((r) => ({ id: r.id, name: r.name })),
    income: rows.filter((r) => r.kind === 'income').map((r) => ({ id: r.id, name: r.name })),
    pay_method: rows.filter((r) => r.kind === 'pay_method').map((r) => ({ id: r.id, name: r.name }))
  }
}

const listCatalogDefaults = async (opts: { kind?: string; includeDeleted?: boolean }) => {
  const where: Record<string, unknown> = {}
  if (opts.kind && isKind(opts.kind)) where.kind = opts.kind
  if (!opts.includeDeleted) where.isDel = false
  const rows = await CatalogDefault.findAll({
    where,
    order: [
      ['kind', 'ASC'],
      ['id', 'ASC']
    ],
    raw: true
  })
  return rows
}

const nextIdForKind = async (kind: CatalogKind) => {
  const rows = (await CatalogDefault.findAll({
    where: { kind },
    attributes: ['id'],
    raw: true
  })) as Array<{ id: string }>
  let max = kind === 'cost' ? 1000 : kind === 'income' ? 2000 : 3000
  for (const row of rows) {
    const n = Number.parseInt(String(row.id), 10)
    if (Number.isFinite(n) && n > max) max = n
  }
  return String(max + 1)
}

const createCatalogDefault = async (kind: string, name: string) => {
  if (!isKind(kind)) return ['类型种类无效', null] as const
  const trimmed = String(name || '').trim()
  if (!trimmed) return ['名称不能为空', null] as const
  if (trimmed.length > 64) return ['名称不能超过 64 个字符', null] as const
  const dup = await CatalogDefault.findOne({ where: { kind, name: trimmed, isDel: false } })
  if (dup) return ['同类未删除项中名称已存在', null] as const
  const id = await nextIdForKind(kind)
  await CatalogDefault.create({ kind, id, name: trimmed, isDel: false })
  return [null, { kind, id, name: trimmed, isDel: false }] as const
}

const renameCatalogDefault = async (kind: string, id: string, name: string) => {
  if (!isKind(kind)) return ['类型种类无效', null] as const
  const trimmed = String(name || '').trim()
  if (!trimmed) return ['名称不能为空', null] as const
  if (trimmed.length > 64) return ['名称不能超过 64 个字符', null] as const
  const row = await CatalogDefault.findOne({ where: { kind, id } })
  if (!row) return ['找不到该项', null] as const
  if (row.isDel) return ['已删除项不可改名', null] as const
  const dup = await CatalogDefault.findOne({
    where: { kind, name: trimmed, isDel: false, id: { [Op.ne]: id } }
  })
  if (dup) return ['同类未删除项中名称已存在', null] as const
  await CatalogDefault.update({ name: trimmed }, { where: { kind, id } })
  return [null, true] as const
}

const deleteCatalogDefault = async (kind: string, id: string) => {
  if (!isKind(kind)) return ['类型种类无效', null] as const
  const row = await CatalogDefault.findOne({ where: { kind, id } })
  if (!row) return ['找不到该项', null] as const
  if (row.isDel) return [null, true] as const
  const activeCount = await CatalogDefault.count({ where: { kind, isDel: false } })
  if (activeCount <= 1) return ['至少保留一项', null] as const
  await CatalogDefault.update({ isDel: true }, { where: { kind, id } })
  return [null, true] as const
}

export {
  listActiveCatalogDefaults,
  listCatalogDefaults,
  createCatalogDefault,
  renameCatalogDefault,
  deleteCatalogDefault
}
