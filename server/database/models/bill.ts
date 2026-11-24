import { DataTypes } from 'sequelize'
import { defineId, type DefineModel } from './helpers'

/** 账本与账本成员 */
export function defineBillModels(defineModel: DefineModel) {
  const Bill = defineModel(
      'bills',
      {
        id: defineId,
        name: { type: DataTypes.STRING(128), allowNull: false },
        creator: { type: DataTypes.STRING(36), allowNull: false },
        isDel: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_del' },
        createdAt: { type: DataTypes.DATE, allowNull: true, field: 'created_at' }
      },
      { tableName: 'bills' }
    )

  const BillUser = defineModel(
      'bill_users',
      {
        id: defineId,
        billId: { type: DataTypes.CHAR(36), allowNull: false, field: 'bill_id' },
        userId: { type: DataTypes.STRING(36), allowNull: false, field: 'user_id' },
        userName: { type: DataTypes.STRING(64), allowNull: false, field: 'user_name' }
      },
      { tableName: 'bill_users' }
    )


  return { Bill, BillUser }
}
