/*
 * 交易表
 */
import mongoose from '../index'
import dayjs from 'dayjs'

const transactionSchema = mongoose.Schema({
  billId: { type: String, required: true }, // 所属账本
  userId: { type: String, required: true }, // 记账人
  // 日期
  date: {
    type: Date,
    required: true,
    get: (v) => {
      return v ? dayjs(v).format('YYYY-MM-DD') : ''
    },
    default: Date.now
  },
  type: { type: Number, required: true, default: 1 }, // 类型：1=支出，2=收入
  // 支出数据
  costTypeId: { type: String, required: false }, // 支出类型id
  costTypeName: { type: String, required: false }, // 支出类型名称
  payMethodId: { type: String, required: false }, // 支付方式id
  payMethodName: { type: String, required: false }, // 支付方式名称
  reimbursement: { type: Number, required: false }, // 报销进度：0=不用报销，1=待报销，2=已提交，3=已报销
  // 收入数据
  incomesTypeId: { type: String, required: false }, // 收入类型id
  incomesTypeName: { type: String, required: false }, // 收入类型名称
  remark: { type: String, required: false }, // 备注
  money: { type: Number, required: true, default: 0 }, // 金额
  isDel: { type: Boolean, required: true, default: false } // 是否删除
})

// 使格式化时间能输出
transactionSchema.set('toJSON', { getters: true })

const Transaction = mongoose.model('transaction', transactionSchema)

export default Transaction
