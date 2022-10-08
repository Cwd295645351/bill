import Transaction from '../../database/modules/Transaction'
import Bill from '../../database/modules/Bills'
import User from '../../database/modules/User'

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
  const findBill = await Bill.findOne({ billId: data.billId }, { costTypes: 1, incomesType: 1, payMethods: 1, budget: 1 })
  if (!findBill) return ['未找到账本', null]
  const params = {
    billId: data.billId,
    userId: data.userId,
    date: data.date,
    type: data.type,
    remark: data.remark,
    money: data.money,
    isDel: false
  }
  if (params.type === 1) {
    if (data.costTypeId) {
      const costType = findBill.costTypes.find((item) => item.id === data.costTypeId)
      params.costTypeId = costType.id
      params.costTypeName = costType.name
    }
    if (data.payMethodId) {
      const payMethod = findBill.payMethods.find((item) => item.id === data.payMethodId)
      params.payMethodId = payMethod.id
      params.payMethodName = payMethod.name
    }
    params.reimbursement = params.reimbursement
  } else {
    if (data.incomesTypeId) {
      const incomes = findBill.incomesTypes.find((item) => item.id === data.payMethodId)
      params.incomesTypeId = incomes.id
      params.incomesTypeName = incomes.name
    }
  }

  const res = await Transaction.create(params)
  if (!res) return ['新增失败', null]

  // 支出明细创建成功后，需向账本表的预算新增数据，并需要增加用户表的总支出或总收入
  if (params.type === 1) {
    const budget = findBill.budget
    // 若有对应预算，对增加对应预算分项的支出金额
    const budgetDetail = budget.details.find((item) => item.costTypeId === data.costTypeId)
    if (budgetDetail) {
      budget.currCost += data.money
      budgetDetail.cost += data.money
    }
    const updateBillRes = await Bill.findOneAndUpdate({ billId: data.billId }, { budget: budget }, { new: true })
    const updateUserRes = await User.findByIdAndUpdate(data.userId, { $inc: { expenses: data.money } })
    if (updateUserRes && updateBillRes) {
      return [null, true]
    } else {
      return ['新增失败', null]
    }
  } else {
    const updateUserRes = await User.findByIdAndUpdate(data.userId, { $inc: { incomes: data.money } })
    if (updateUserRes) return [null, true]
    else return ['新增失败', null]
  }
}
