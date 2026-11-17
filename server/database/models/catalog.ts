import { DataTypes } from 'sequelize'
import { decimalMoney, defineId, type DefineModel } from './helpers'

/** 类型、支付方式、概览规则 */
export function defineCatalogModels(defineModel: DefineModel) {
  const BillCostType = defineModel(
      'bill_cost_types',
      {
        id: { type: DataTypes.STRING(32), primaryKey: true },
        billId: { type: DataTypes.CHAR(36), primaryKey: true, allowNull: false, field: 'bill_id' },
        name: { type: DataTypes.STRING(64), allowNull: false },
        isDel: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_del' },
        hidden: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
      },
      { tableName: 'bill_cost_types' }
    )

  const BillIncomeType = defineModel(
      'bill_income_types',
      {
        id: { type: DataTypes.STRING(32), primaryKey: true },
        billId: { type: DataTypes.CHAR(36), primaryKey: true, allowNull: false, field: 'bill_id' },
        name: { type: DataTypes.STRING(64), allowNull: false },
        isDel: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_del' },
        hidden: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
      },
      { tableName: 'bill_income_types' }
    )

  const BillPayMethod = defineModel(
      'bill_pay_methods',
      {
        id: { type: DataTypes.STRING(32), primaryKey: true },
        billId: { type: DataTypes.CHAR(36), primaryKey: true, allowNull: false, field: 'bill_id' },
        name: { type: DataTypes.STRING(64), allowNull: false },
        isDel: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_del' }
      },
      { tableName: 'bill_pay_methods' }
    )

  /** 账本概览收入调整规则：数量×单价扣减 / 指定支出类型扣减 */
  const BillOverviewRule = defineModel(
      'bill_overview_rules',
      {
        id: defineId,
        billId: { type: DataTypes.CHAR(36), allowNull: false, field: 'bill_id' },
        name: { type: DataTypes.STRING(64), allowNull: false },
        /** quantity=数量×单价；cost_type=指定支出类型 */
        ruleType: { type: DataTypes.STRING(32), allowNull: false, field: 'rule_type' },
        enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        unitName: { type: DataTypes.STRING(32), allowNull: true, field: 'unit_name' },
        unitPrice: decimalMoney('unitPrice', { allowNull: true, defaultValue: 0, field: 'unit_price' }),
        costTypeId: { type: DataTypes.STRING(32), allowNull: true, field: 'cost_type_id' },
        sort: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        isBuiltin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_builtin' },
        builtinKey: { type: DataTypes.STRING(64), allowNull: true, field: 'builtin_key' }
      },
      { tableName: 'bill_overview_rules' }
    )

  /** 数量型概览规则每年的实际数量与归属人配置（如香港天数每年天数与扣减归属人） */
  const BillOverviewRuleYear = defineModel(
      'bill_overview_rule_years',
      {
        id: defineId,
        billId: { type: DataTypes.CHAR(36), allowNull: false, field: 'bill_id' },
        ruleId: { type: DataTypes.CHAR(36), allowNull: false, field: 'rule_id' },
        year: { type: DataTypes.INTEGER, allowNull: false },
        quantity: decimalMoney('quantity', { allowNull: false, defaultValue: 0 }),
        belongUserId: { type: DataTypes.CHAR(36), allowNull: true, field: 'belong_user_id' }
      },
      {
        tableName: 'bill_overview_rule_years',
        indexes: [
          { unique: true, fields: ['rule_id', 'year'], name: 'idx_rule_year_unique' },
          { fields: ['bill_id', 'year'], name: 'idx_rule_years_bill_year' }
        ]
      }
    )


  return { BillCostType, BillIncomeType, BillPayMethod, BillOverviewRule, BillOverviewRuleYear }
}
