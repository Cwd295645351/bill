import { DataTypes } from 'sequelize'
import type { DefineModel } from './helpers'

/** 新建账本时复制的默认类型模板 */
export function defineCatalogDefaultModels(defineModel: DefineModel) {
  const CatalogDefault = defineModel(
    'catalog_defaults',
    {
      kind: { type: DataTypes.STRING(16), primaryKey: true, allowNull: false },
      id: { type: DataTypes.STRING(32), primaryKey: true, allowNull: false },
      name: { type: DataTypes.STRING(64), allowNull: false },
      isDel: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_del' }
    },
    { tableName: 'catalog_defaults' }
  )

  return { CatalogDefault }
}
