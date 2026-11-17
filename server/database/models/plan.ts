import { DataTypes } from 'sequelize'
import { defineId, type DefineModel } from './helpers'

/** 购物计划 */
export function definePlanModels(defineModel: DefineModel) {
  const BillPlanBuy = defineModel(
      'bill_plan_buys',
      {
        id: defineId,
        billId: { type: DataTypes.CHAR(36), allowNull: false, field: 'bill_id' },
        title: { type: DataTypes.STRING(255), allowNull: false },
        context: { type: DataTypes.TEXT, allowNull: false },
        priority: { type: DataTypes.INTEGER, allowNull: false },
        isBuy: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_buy' },
        isDel: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_del' }
      },
      { tableName: 'bill_plan_buys' }
    )


  return { BillPlanBuy }
}
