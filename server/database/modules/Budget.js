/**
 * 预算表
 */
import mongoose from '../index'
import dayjs from 'dayjs'

const budgetSchema = mongoose.Schema({
  billId: { type: String, required: true }, // 所属账本
  // 日期
  date: {
    type: Date,
    required: true,
    get: (v) => {
      return v ? dayjs(v).format('YYYY') : ''
    },
    default: Date.now
  },
  // 支出数据
  costTypeId: { type: String, required: false }, // 支出类型id
  costTypeName: { type: String, required: false }, // 支出类型名称
  money: { type: Number, required: true, default: 0 }, // 预算金额
  cost: { type: Number, required: true, default: 0 }, // 当前花费金额
  sort: { type: Number, required: true, default: 1 }, // 排序
  isDel: { type: Boolean, required: true, default: false } // 是否删除
})

// 使格式化时间能输出
budgetSchema.set('toJSON', { getters: true })

const Transaction = mongoose.model('budget', budgetSchema)

export default Transaction
