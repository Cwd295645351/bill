import mongoose from '../index'

// 账本
const BillSchema = mongoose.Schema({
  name: { type: String, required: true }, // 账本名
  creator: { type: String, required: true }, // 账本创建者（拥有新建、编辑、删除账单权限）
  users: { type: Array, required: true }, // 账本持有者-存放用户id
  costTypes: [{ id: String, name: String, isDel: Boolean }], // 账本支出消费类型
  incomesType: [{ id: String, name: String, isDel: Boolean }], // 账本收入消费类型
  payMethods: [{ id: String, name: String, isDel: Boolean }], // 支付类型
  // 计划购入
  planBuy: {
    count: { type: Number, required: true, default: 0 }, // 数量
    totalCost: { type: Number, required: true, default: 0 }, // 总花费
    details: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true }, // 预购内容
        costTypeId: { type: String, required: true }, // 支出类型id
        costTypeName: { type: String, required: true }, // 支出类型名称
        cost: { type: Number, required: true, default: 0 }, // 金额
        sort: { type: Number, required: true, default: 0, index: true }, // 排序
        isDel: { type: Boolean, required: true, default: false } // 是否删除
      }
    ]
  },
  // 预算
  budget: {
    totalBudget: { type: Number, required: true, default: 0 }, // 总预算
    currCost: { type: Number, required: true, default: 0 }, // 当前已支出金额
    details: [
      {
        costTypeId: { type: String, required: true }, // 支出类型id
        costTypeName: { type: String, required: true }, // 支出类型名称
        budget: { type: Number, required: true, default: 0 }, // 预算金额
        cost: { type: Number, required: true, default: 0 } // 当前已支出金额(在增删修改账单时顺便对cost进行修改)
      }
    ]
  },
  isDel: { type: Boolean, required: true, default: false } // 是否删除
})

const Bills = mongoose.model('bills', BillSchema)

export default Bills
