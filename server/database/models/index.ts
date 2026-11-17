import type { Sequelize } from 'sequelize'
import { defineAssetModels } from './asset'
import { defineAuthModels } from './auth'
import { defineBillModels } from './bill'
import { defineBudgetModels } from './budget'
import { defineCatalogModels } from './catalog'
import { createDefineModel } from './helpers'
import { definePlanModels } from './plan'
import { defineTransactionModels } from './transaction'

function initModels(sequelize: Sequelize) {
  const defineModel = createDefineModel(sequelize)
  const auth = defineAuthModels(defineModel)
  const bill = defineBillModels(defineModel)
  const catalog = defineCatalogModels(defineModel)
  const plan = definePlanModels(defineModel)
  const budget = defineBudgetModels(defineModel)
  const asset = defineAssetModels(defineModel)
  const transaction = defineTransactionModels(defineModel)

  const { User, UserWechat, Encryption } = auth
  const { Bill, BillUser } = bill
  const { BillCostType, BillIncomeType, BillPayMethod, BillOverviewRule, BillOverviewRuleYear } = catalog
  const { BillPlanBuy } = plan
  const { BillBudget, BillBudgetDetail } = budget
  const { Member, Asset, AssetRecord, BillExchangeRate, AssetRetirePlan } = asset
  const { Transaction, TransactionImage } = transaction

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
