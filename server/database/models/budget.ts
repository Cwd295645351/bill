import { DataTypes } from 'sequelize'
import { decimalMoney, defineId, type DefineModel } from './helpers'

/** 当年预算 */
export function defineBudgetModels(defineModel: DefineModel) {
  const BillBudget = defineModel(
      'bill_budgets',
      {
        id: defineId,
        billId: { type: DataTypes.CHAR(36), allowNull: false, field: 'bill_id' },
        date: { type: DataTypes.INTEGER, allowNull: false },
        totalBudget: decimalMoney('totalBudget', { field: 'total_budget' }),
        currCost: decimalMoney('currCost', { field: 'curr_cost' })
      },
      { tableName: 'bill_budgets' }
    )

  const BillBudgetDetail = defineModel(
      'bill_budget_details',
      {
        id: defineId,
        budgetId: { type: DataTypes.CHAR(36), allowNull: false, field: 'budget_id' },
        costTypeId: { type: DataTypes.STRING(32), allowNull: false, field: 'cost_type_id' },
        costTypeName: { type: DataTypes.STRING(64), allowNull: false, field: 'cost_type_name' },
        budget: decimalMoney('budget'),
        cost: decimalMoney('cost')
      },
      { tableName: 'bill_budget_details' }
    )


  return { BillBudget, BillBudgetDetail }
}
