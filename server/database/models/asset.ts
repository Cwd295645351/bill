import { DataTypes } from 'sequelize'
import { decimalMoney, defineId, type DefineModel } from './helpers'

/** 家庭资产。members 是资产名单，不是账本成员 */
export function defineAssetModels(defineModel: DefineModel) {
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


  return { Member, Asset, AssetRecord, BillExchangeRate, AssetRetirePlan }
}
