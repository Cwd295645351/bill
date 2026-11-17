import { DataTypes } from 'sequelize'
import { toTimestamp } from '../../utils/dateUtil'
import { decimalMoney, defineId, type DefineModel, type ModelField } from './helpers'

/** 记账明细与照片 */
export function defineTransactionModels(defineModel: DefineModel) {
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


  return { Transaction, TransactionImage }
}
