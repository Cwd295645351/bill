const { DataTypes } = require('sequelize')
const { v4: uuidv4 } = require('uuid')
const { toTimestamp } = require('../../utils/dateUtil')

const defineId = {
  type: DataTypes.CHAR(36),
  primaryKey: true,
  defaultValue: () => uuidv4()
}

/** 金额字段：数据库存 DECIMAL，Sequelize 默认读成 string，通过 getter 转为 number */
function decimalMoney(attrName, options = {}) {
  return {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0,
    ...options,
    get() {
      const v = this.getDataValue(attrName)
      if (v == null) return v
      return Number(v)
    }
  }
}

function initModels(sequelize) {
  const User = sequelize.define(
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

  const Encryption = sequelize.define(
    'encryptions',
    {
      id: defineId,
      privateKey: { type: DataTypes.TEXT, allowNull: false, field: 'private_key' },
      publicKey: { type: DataTypes.TEXT, allowNull: false, field: 'public_key' }
    },
    { tableName: 'encryptions' }
  )

  const Bill = sequelize.define(
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

  const BillUser = sequelize.define(
    'bill_users',
    {
      id: defineId,
      billId: { type: DataTypes.CHAR(36), allowNull: false, field: 'bill_id' },
      userId: { type: DataTypes.STRING(36), allowNull: false, field: 'user_id' },
      userName: { type: DataTypes.STRING(64), allowNull: false, field: 'user_name' }
    },
    { tableName: 'bill_users' }
  )

  const BillCostType = sequelize.define(
    'bill_cost_types',
    {
      id: { type: DataTypes.STRING(32), primaryKey: true },
      billId: { type: DataTypes.CHAR(36), primaryKey: true, allowNull: false, field: 'bill_id' },
      name: { type: DataTypes.STRING(64), allowNull: false },
      isDel: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_del' }
    },
    { tableName: 'bill_cost_types' }
  )

  const BillIncomeType = sequelize.define(
    'bill_income_types',
    {
      id: { type: DataTypes.STRING(32), primaryKey: true },
      billId: { type: DataTypes.CHAR(36), primaryKey: true, allowNull: false, field: 'bill_id' },
      name: { type: DataTypes.STRING(64), allowNull: false },
      isDel: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_del' }
    },
    { tableName: 'bill_income_types' }
  )

  const BillPayMethod = sequelize.define(
    'bill_pay_methods',
    {
      id: { type: DataTypes.STRING(32), primaryKey: true },
      billId: { type: DataTypes.CHAR(36), primaryKey: true, allowNull: false, field: 'bill_id' },
      name: { type: DataTypes.STRING(64), allowNull: false },
      isDel: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_del' }
    },
    { tableName: 'bill_pay_methods' }
  )

  const BillPlanBuy = sequelize.define(
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

  const BillBudget = sequelize.define(
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

  const BillBudgetDetail = sequelize.define(
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

  const Member = sequelize.define(
    'members',
    {
      id: defineId,
      billId: { type: DataTypes.CHAR(36), allowNull: false, field: 'bill_id' },
      name: { type: DataTypes.STRING(64), allowNull: false },
      isDel: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_del' }
    },
    { tableName: 'members' }
  )

  const Asset = sequelize.define(
    'assets',
    {
      id: defineId,
      name: { type: DataTypes.STRING(128), allowNull: false },
      billId: { type: DataTypes.CHAR(36), allowNull: false, field: 'bill_id' },
      memberId: { type: DataTypes.CHAR(36), allowNull: false, field: 'member_id' },
      type: { type: DataTypes.STRING(32), allowNull: false },
      fourMoneyType: { type: DataTypes.STRING(32), allowNull: false, field: 'four_money_type' },
      isDebt: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_debt' },
      latestAmount: decimalMoney('latestAmount', { field: 'latest_amount' }),
      insuranceCategory: { type: DataTypes.STRING(32), allowNull: true, field: 'insurance_category' },
      annualPremium: decimalMoney('annualPremium', { allowNull: true, field: 'annual_premium' }),
      lastUpdatedDate: { type: DataTypes.BIGINT, allowNull: true, field: 'last_updated_date' },
      isDel: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_del' }
    },
    { tableName: 'assets' }
  )

  const AssetRecord = sequelize.define(
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

  const Transaction = sequelize.define(
    'transactions',
    {
      id: defineId,
      billId: { type: DataTypes.STRING(36), allowNull: false, field: 'bill_id' },
      userId: { type: DataTypes.STRING(36), allowNull: false, field: 'user_id' },
      date: {
        type: DataTypes.BIGINT,
        allowNull: false,
        get() {
          const raw = this.getDataValue('date')
          return raw == null ? null : Number(raw)
        },
        set(value) {
          const ts = toTimestamp(value)
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
      belongUserId: { type: DataTypes.STRING(36), allowNull: true, field: 'belong_user_id' },
      belongUserName: { type: DataTypes.STRING(64), allowNull: true, field: 'belong_user_name' },
      remark: { type: DataTypes.STRING(512), allowNull: true },
      money: decimalMoney('money'),
      isDel: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_del' }
    },
    {
      tableName: 'transactions',
      indexes: [{ fields: ['date'], name: 'idx_transactions_date' }]
    }
  )

  Bill.hasMany(BillUser, { foreignKey: 'billId', as: 'billUsers' })
  Bill.hasMany(BillCostType, { foreignKey: 'billId', as: 'costTypes' })
  Bill.hasMany(BillIncomeType, { foreignKey: 'billId', as: 'incomesTypes' })
  Bill.hasMany(BillPayMethod, { foreignKey: 'billId', as: 'payMethods' })
  Bill.hasMany(BillPlanBuy, { foreignKey: 'billId', as: 'planBuyDetails' })
  Bill.hasMany(BillBudget, { foreignKey: 'billId', as: 'budgets' })
  BillBudget.hasMany(BillBudgetDetail, { foreignKey: 'budgetId', as: 'details' })

  Asset.belongsTo(Member, { foreignKey: 'memberId', as: 'member' })
  Asset.hasMany(AssetRecord, { foreignKey: 'assetId', as: 'records' })

  return {
    User,
    Encryption,
    Bill,
    BillUser,
    BillCostType,
    BillIncomeType,
    BillPayMethod,
    BillPlanBuy,
    BillBudget,
    BillBudgetDetail,
    Member,
    Asset,
    AssetRecord,
    Transaction
  }
}

module.exports = initModels
