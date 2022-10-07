import Transaction from '../../database/modules/Transaction'
import Bill from '../../database/modules/Bills'

// 查询列表
export const getList = async (data) => {
  const params = {
    billId: data.billId,
    type: data.type,
    idDel: false
  }
  if (params.beginDate && params.endDate) {
    params.date = {
      $gte: new Date(params.beginDate),
      $lte: new Date(params.endDate)
    }
  } else if (params.beginDate && !params.endDate) {
    params.date = {
      $gte: new Date(params.beginDate)
    }
  } else if (!params.beginDate && params.endDate) {
    params.date = {
      $lte: new Date(params.endDate)
    }
  }
  if (params.costTypeId) params.costTypeId = data.costTypeId // 支出类型
  if (params.payMethodId) params.payMethodId = data.payMethodId // 支付方式
  if (params.incomesTypeId) params.incomesTypeId = data.incomesTypeId // 收入类型
  if (params.userId) params.userId = { $in: data.userId } // 记账人

  const res = Transaction.find(params)
  if (res) return [null, res]
  else return ['查询失败', res]
}

export const addTransaction = async (data) => {
  const params = {
    billId: data.billId,
    userId: data.userId,
    date: data.date,
    type: data.type || 1
  }
  const findBill = await Bill.findOne({ billId: data.billId }, { costTypes: 1, incomesType: 1, payMethods: 1 })
  if (!findBill) return ['未找到账本', null]
  if (params.type === 1) {
    params.costTypeId = params.costTypeId
  }
}
