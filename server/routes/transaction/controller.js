import Transaction from '../../database/modules/Transaction'
import Bill from '../../database/modules/Bills'
import User from '../../database/modules/User'
import mongoose from '../../database/index'
import dayjs from 'dayjs'

// 查询列表
export const getList = async (data) => {
  const pageIndex = data.pageIndex
  const pageSize = data.pageSize
  const params = {
    billId: data.billId,
    type: data.type,
    remark: { $regex: data.remark, $options: 'im' },
    isDel: false
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
  if (params.belongUserId) params.belongUserId = { $in: data.belongUserId } // 归属人

  const res = await Transaction.find(params, {})
    .sort({ date: -1 })
    .skip(pageIndex * pageSize)
    .limit(pageSize)
  const length = await Transaction.find(params, {}).count()
  const retData = {
    total: length,
    datas: res
  }
  console.log(params)
  if (res) return [null, retData]
  else return ['查询失败', res]
}

// 新增交易信息
export const addTransaction = async (data) => {
  const findBill = await Bill.findById(data.billId, { users: 1, costTypes: 1, incomesTypes: 1, payMethods: 1, budget: 1 })
  if (!findBill) return ['未找到账本', null]
  const params = {
    billId: data.billId,
    userId: data.userId,
    date: data.date,
    type: data.type,
    remark: data.remark,
    money: data.money,
    belongUserId: '',
    belongUserName: '全部',
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
    params.reimbursement = data.reimbursement
  } else {
    if (data.incomesTypeId) {
      const incomes = findBill.incomesTypes.find((item) => item.id === data.incomesTypeId)
      params.incomesTypeId = incomes.id
      params.incomesTypeName = incomes.name
    }
  }
  if (data.belongUserId) {
    const users = findBill.users.find((item) => item.id === data.belongUserId)
    params.belongUserId = users.id
    params.belongUserName = users.name
  }

  const res = await Transaction.create(params)
  if (!res) return ['新增失败', null]

  // 需要增加用户表的总支出或总收入
  if (params.type === 1) {
    // 支出交易明细创建成功后，需向账本表的预算新增数据
    const budget = findBill.budget
    // 若有对应预算，对增加对应预算分项的支出金额
    const budgetItem = budget.find((item) => item.date === dayjs(new Date()).format('YYYY-MM'))
    if (budgetItem) {
      const budgetDetail = budgetItem.details.find((item) => item.costTypeId === data.costTypeId)
      if (budgetDetail) {
        if (budgetDetail) {
          budget.currCost += data.money
          budgetDetail.cost += data.money
        }
      }
    }
    const updateBillRes = await Bill.findByIdAndUpdate(data.billId, { budget: budget }, { new: true })
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

// 编辑交易信息
export const editTransaction = async (data) => {
  const findBill = await Bill.findById(data.billId, { users: 1, costTypes: 1, incomesTypes: 1, payMethods: 1, budget: 1 })
  if (!findBill) return ['未找到账本', null]
  const params = { _id: mongoose.Types.ObjectId(data.id), isDel: false }
  const changeData = {
    date: data.date,
    remark: data.remark,
    money: data.money,
    type: data.type,
    belongUserId: '',
    belongUserName: ''
  }
  if (data.type === 1) {
    if (data.costTypeId) {
      const costType = findBill.costTypes.find((item) => item.id === data.costTypeId)
      changeData.costTypeId = costType.id
      changeData.costTypeName = costType.name
    }
    if (data.payMethodId) {
      const payMethod = findBill.payMethods.find((item) => item.id === data.payMethodId)
      changeData.payMethodId = payMethod.id
      changeData.payMethodName = payMethod.name
    }
    changeData.reimbursement = data.reimbursement
  } else {
    if (data.incomesTypeId) {
      const incomes = findBill.incomesTypes.find((item) => item.id === data.incomesTypeId)
      changeData.incomesTypeId = incomes.id
      changeData.incomesTypeName = incomes.name
    }
  }
  if (data.belongUserId) {
    const users = findBill.users.find((item) => item.id === data.belongUserId)
    changeData.belongUserId = users.id
    changeData.belongUserName = users.name
  }
  const res = await Transaction.findOneAndUpdate(params, changeData)
  if (!res) return ['编辑失败', null]

  const differenceMoney = data.money - res.money // 编辑后的金额差

  // 支出交易明细创编辑成功后，需向账本表的预算新增数据，并需要增加用户表的总支出或总收入
  if (data.type === 1) {
    // 支出交易明细编辑成功后，需向账本表的预算更改数据
    const budget = findBill.budget
    // 若有对应预算，对增加对应预算分项的支出金额
    const budgetItem = budget.find((item) => item.date === dayjs(new Date()).format('YYYY-MM'))
    if (budgetItem) {
      const budgetDetail = budgetItem.details.find((item) => item.costTypeId === data.costTypeId)
      if (budgetDetail) {
        budget.currCost += differenceMoney
        budgetDetail.cost += differenceMoney
      }
    }
    const updateBillRes = await Bill.findByIdAndUpdate(data.billId, { budget: budget }, { new: true })
    const updateUserRes = await User.findByIdAndUpdate(data.userId, { $inc: { expenses: differenceMoney } })
    if (updateUserRes && updateBillRes) {
      return [null, true]
    } else {
      return ['编辑失败', null]
    }
  } else {
    const updateUserRes = await User.findByIdAndUpdate(data.userId, { $inc: { incomes: differenceMoney } })
    if (updateUserRes) return [null, true]
    else return ['编辑失败', null]
  }
}

// 删除交易信息
export const deleteTransaction = async (data) => {
  const params = { _id: mongoose.Types.ObjectId(data.id), isDel: false }
  const res = await Transaction.findOneAndUpdate(params, { isDel: true }, { new: true })
  console.log(params, res, '================')
  if (!res) return ['该明细不存在', null]

  const findBill = await Bill.findById(res.billId, { budget: 1 })
  if (!findBill) return ['未找到账本', null]

  // 支出交易明细创删除成功后，需向账本表的预算删除数据，并需要减少用户表的总支出或总收入
  if (res.type === 1) {
    // 支出交易明细删除成功后，需向账本表的预算更改数据
    const budget = findBill.budget
    // 若有对应预算，对增加对应预算分项的支出金额
    const budgetItem = budget.find((item) => item.date === dayjs(new Date()).format('YYYY-MM'))
    if (budgetItem) {
      const budgetDetail = budgetItem.details.find((item) => item.costTypeId === data.costTypeId)
      if (budgetDetail) {
        if (budgetDetail) {
          budget.currCost -= res.money
          budgetDetail.cost -= res.money
        }
      }
    }
    const updateBillRes = await Bill.findByIdAndUpdate(res.billId, { budget: budget }, { new: true })
    const updateUserRes = await User.findByIdAndUpdate(res.userId, { $inc: { expenses: 0 - res.money } })
    if (updateUserRes && updateBillRes) {
      return [null, true]
    } else {
      return ['删除失败', null]
    }
  } else {
    const updateUserRes = await User.findByIdAndUpdate(res.userId, { $inc: { incomes: 0 - res.money } })
    if (updateUserRes) return [null, true]
    else return ['删除失败', null]
  }
}

// 查询当月收支和各归属人概况
export const getCurrentMonthCost = async (data, userId) => {
  const res = await Transaction.find(data, { type: 1, money: 1, belongUserId: 1, belongUserName: 1 })
  const costDetail = res.filter((item) => item.type === 1)
  let totalCost = 0,
    belongUserCosts = []
  costDetail.forEach((item) => {
    totalCost += item.money
    const user = belongUserCosts.find((ite) => ite.belongUserId === item.belongUserId)
    if (user) {
      user.money += item.money
    } else {
      belongUserCosts.push({
        belongUserId: item.belongUserId,
        belongUserName: item.belongUserName,
        money: item.money
      })
    }
  })
  // const cost = costDetail
  //   .reduce((prev, curr) => {
  //     return prev + curr.money
  //   }, 0)
  //   .toFixed(2)
  // const incomes = res
  //   .filter((item) => item.type === 2)
  //   .reduce((prev, curr) => {
  //     return prev + curr.money
  //   }, 0)
  //   .toFixed(2)

  if (res) return [null, { totalCost: totalCost.toFixed(2), belongUserCosts }]
  else return ['查询失败', null]
}
