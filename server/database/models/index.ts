import { DataTypes, Sequelize } from 'sequelize'
import { v4 as uuidv4 } from 'uuid'
import { toTimestamp } from '../../utils/dateUtil'
import type { AnyModel } from '../../types/model'

const defineId = {
  type: DataTypes.CHAR(36),
  primaryKey: true,
  defaultValue: () => uuidv4()
}

/** Sequelize 属性 getter/setter 上的 this */
interface ModelField {
  getDataValue(key: string): unknown
  setDataValue(key: string, value: unknown): void
}

/** 金额字段：数据库存 DECIMAL，Sequelize 默认读成 string，通过 getter 转为 number */
function decimalMoney(attrName: string, options: Record<string, unknown> = {}) {
  return {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0,
    ...options,
    get(this: ModelField) {
      const v = this.getDataValue(attrName)
      if (v == null) return v
      return Number(v)
    }
  }
}

function initModels(sequelize: Sequelize) {
  const defineModel = (name: string, attributes: object, options?: object): AnyModel =>
    sequelize.define(name, attributes as never, options) as AnyModel

  const User = defineModel(
    'users',
    {
      id: defineId,
      username: { type: DataTypes.STRING(64), allowNull: false },
      password: { type: DataTypes.STRING(255), allowNull: false },
      nickName: { type: DataTypes.STRING(64), allowNull: false, field: 'nick_name' },
      avatarUrl: { type: DataTypes.STRING(512), allowNull: true, defaultValue: '', field: 'avatar_url' },
      incomes: decimalMoney('incomes'),
      expenses: decimalMoney('expenses'),
      isDel: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_del' }
    },
    { tableName: 'users' }
  )

  // 微信小程序 openid 与账号一对一绑定，不可解绑（换绑需管理员改库）
  const UserWechat = defineModel(
    'user_wechats',
    {
      id: defineId,
      userId: { type: DataTypes.CHAR(36), allowNull: false, unique: true, field: 'user_id' },
      openid: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      unionid: { type: DataTypes.STRING(64), allowNull: true, defaultValue: '' },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' }
    },
    { tableName: 'user_wechats' }
  )

  const Encryption = defineModel(
    'encryptions',
    {
      id: defineId,
      privateKey: { type: DataTypes.TEXT, allowNull: false, field: 'private_key' },
      publicKey: { type: DataTypes.TEXT, allowNull: false, field: 'public_key' }
    },
    { tableName: 'encryptions' }
  )

  const Bill = defineModel(
    'bills',
    {
      id: defineId,
      name: { type: DataTypes.STRING(128), allowNull: false },
      creator: { type: DataTypes.STRING(36), allowNull: false },
      planBuyCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'plan_buy_count' },
      isDel: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_del' }
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

  const Member = defineModel(
    'members',
    {
      id: defineId,
      billId: { type: DataTypes.CHAR(36), allowNull: false, field: 'bill_id' },
      name: { type: DataTypes.STRING(64), allowNull: false },
      isDel: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_del' }
    },
    { tableName: 'members' }
  )

  const Asset = defineModel(
    'assets',
    {
      id: defineId,
      name: { type: DataTypes.STRING(128), allowNull: false },
      billId: { type: DataTypes.CHAR(36), allowNull: false, field: 'bill_id' },
      memberId: { type: DataTypes.CHAR(36), allowNull: false, field: 'member_id' },
      type: { type: DataTypes.STRING(32), allowNull: false },
      /** CNY、HKD、USD。创建后不可改。已有行回填人民币 */
      currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'CNY' },
      fourMoneyType: { type: DataTypes.STRING(32), allowNull: true, field: 'four_money_type' },
      channel: { type: DataTypes.STRING(64), allowNull: true, field: 'channel' },
      turnaroundCycle: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'T+0', field: 'turnaround_cycle' },
      isDebt: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_debt' },
      latestAmount: decimalMoney('latestAmount', { field: 'latest_amount' }),
      insuranceCategory: { type: DataTypes.STRING(32), allowNull: true, field: 'insurance_category' },
      annualPremium: decimalMoney('annualPremium', { allowNull: true, field: 'annual_premium' }),
      lastUpdatedDate: { type: DataTypes.BIGINT, allowNull: true, field: 'last_updated_date' },
      isDel: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_del' }
    },
    { tableName: 'assets' }
  )

  const AssetRecord = defineModel(
    'asset_records',
    {
      id: defineId,
      assetId: { type: DataTypes.CHAR(36), allowNull: false, field: 'asset_id' },
      amount: decimalMoney('amount'),
      date: { type: DataTypes.BIGINT, allowNull: false },
      isDel: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_del' }
    },
    { tableName: 'asset_records' }
  )

  /** 一个账本一套港币、美元汇率。没有这一行表示尚未保存 */
  const BillExchangeRate = defineModel(
    'bill_exchange_rates',
    {
      billId: { type: DataTypes.CHAR(36), primaryKey: true, field: 'bill_id' },
      hkdRate: decimalMoney('hkdRate', { field: 'hkd_rate' }),
      usdRate: decimalMoney('usdRate', { field: 'usd_rate' })
    },
    { tableName: 'bill_exchange_rates' }
  )

  /** 养老计划。member_id 为空表示「全部」，同一范围只有一行 */
  const AssetRetirePlan = defineModel(
    'asset_retire_plans',
    {
      id: defineId,
      billId: { type: DataTypes.CHAR(36), allowNull: false, field: 'bill_id' },
      memberId: { type: DataTypes.CHAR(36), allowNull: true, field: 'member_id' },
      amount: decimalMoney('amount'),
      startMonth: { type: DataTypes.STRING(7), allowNull: false, field: 'start_month' },
      targetMonth: { type: DataTypes.STRING(7), allowNull: true, field: 'target_month' }
    },
    { tableName: 'asset_retire_plans' }
  )

  const Transaction = defineModel(
    'transactions',
    {
      id: defineId,
      billId: { type: DataTypes.STRING(36), allowNull: false, field: 'bill_id' },
      userId: { type: DataTypes.STRING(36), allowNull: false, field: 'user_id' },
      date: {
        type: DataTypes.BIGINT,
        allowNull: false,
        get(this: ModelField) {
          const raw = this.getDataValue('date')
          return raw == null ? null : Number(raw)
        },
        set(this: ModelField, value: unknown) {
          const ts = toTimestamp(value as string | number | Date)
          if (ts != null) this.setDataValue('date', ts)
        }
      },
      type: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      costTypeId: { type: DataTypes.STRING(32), allowNull: true, field: 'cost_type_id' },
      costTypeName: { type: DataTypes.STRING(64), allowNull: true, field: 'cost_type_name' },
      payMethodId: { type: DataTypes.STRING(32), allowNull: true, field: 'pay_method_id' },
      payMethodName: { type: DataTypes.STRING(64), allowNull: true, field: 'pay_method_name' },
      reimbursement: { type: DataTypes.INTEGER, allowNull: true },
      incomesTypeId: { type: DataTypes.STRING(32), allowNull: true, field: 'incomes_type_id' },
      incomesTypeName: { type: DataTypes.STRING(64), allowNull: true, field: 'incomes_type_name' },
      belongUserId: { type: DataTypes.STRING(1024), allowNull: true, field: 'belong_user_id' },
      belongUserName: { type: DataTypes.STRING(2048), allowNull: true, field: 'belong_user_name' },
      remark: { type: DataTypes.STRING(512), allowNull: true },
      money: decimalMoney('money'),
      isDel: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_del' }
    },
    {
      tableName: 'transactions',
      indexes: [{ fields: ['date'], name: 'idx_transactions_date' }]
    }
  )

  // 记账照片：一行一张，不改 transactions 列；未挂接时 transaction_id 为空
  const TransactionImage = defineModel(
    'transaction_images',
    {
      id: defineId,
      billId: { type: DataTypes.CHAR(36), allowNull: false, field: 'bill_id' },
      transactionId: { type: DataTypes.CHAR(36), allowNull: true, field: 'transaction_id' },
      userId: { type: DataTypes.CHAR(36), allowNull: false, field: 'user_id' },
      objectKey: { type: DataTypes.STRING(512), allowNull: false, field: 'object_key' },
      sort: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      size: { type: DataTypes.INTEGER, allowNull: false },
      contentType: { type: DataTypes.STRING(64), allowNull: false, field: 'content_type' },
      viewable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' }
    },
    {
      tableName: 'transaction_images',
      indexes: [
        { fields: ['transaction_id'], name: 'idx_transaction_images_transaction_id' },
        { fields: ['bill_id', 'user_id'], name: 'idx_transaction_images_bill_user' }
      ]
    }
  )

  Bill.hasMany(BillUser, { foreignKey: 'billId', as: 'billUsers' })
  Bill.hasMany(BillCostType, { foreignKey: 'billId', as: 'costTypes' })
  Bill.hasMany(BillIncomeType, { foreignKey: 'billId', as: 'incomesTypes' })
  Bill.hasMany(BillPayMethod, { foreignKey: 'billId', as: 'payMethods' })
  Bill.hasMany(BillOverviewRule, { foreignKey: 'billId', as: 'overviewRules' })
  BillOverviewRule.hasMany(BillOverviewRuleYear, { foreignKey: 'ruleId', as: 'yearlyRecords' })
  BillOverviewRuleYear.belongsTo(BillOverviewRule, { foreignKey: 'ruleId', as: 'rule' })
  Bill.hasMany(BillPlanBuy, { foreignKey: 'billId', as: 'planBuyDetails' })
  Bill.hasMany(BillBudget, { foreignKey: 'billId', as: 'budgets' })
  BillBudget.hasMany(BillBudgetDetail, { foreignKey: 'budgetId', as: 'details' })

  Asset.belongsTo(Member, { foreignKey: 'memberId', as: 'member' })
  Asset.hasMany(AssetRecord, { foreignKey: 'assetId', as: 'records' })

  Transaction.hasMany(TransactionImage, { foreignKey: 'transactionId', as: 'images' })
  TransactionImage.belongsTo(Transaction, { foreignKey: 'transactionId', as: 'transaction' })

  return {
    User,
    UserWechat,
    Encryption,
    Bill,
    BillUser,
    BillCostType,
    BillIncomeType,
    BillPayMethod,
    BillOverviewRule,
    BillOverviewRuleYear,
    BillPlanBuy,
    BillBudget,
    BillBudgetDetail,
    Member,
    Asset,
    AssetRecord,
    BillExchangeRate,
    AssetRetirePlan,
    Transaction,
    TransactionImage
  }
}

export default initModels
