const Transaction = require('../../database/modules/Transaction')
const Bill = require('../../database/modules/Bills')
const User = require('../../database/modules/User')
const mongoose = require('../../database/index')
const dayjs = require('dayjs')
const { createXlsx } = require('../../utils/xlsx')
const xlsx = require('node-xlsx')
const fs = require('fs')

// 查询列表
exports.getList = async (data) => {
  const pageIndex = data.pageIndex
  const pageSize = data.pageSize
  const params = {
    billId: data.billId,
    type: data.type,
    isDel: false,
    money: {}
  }
  params.money[`$${data.condition}`] = data.rangeMoney
  if (data.beginDate && data.endDate) {
    params.date = {
      $gte: new Date(data.beginDate),
      $lte: new Date(data.endDate)
    }
  } else if (data.beginDate && !data.endDate) {
    params.date = {
      $gte: new Date(data.beginDate)
    }
  } else if (!data.beginDate && data.endDate) {
    params.date = {
      $lte: new Date(data.endDate)
    }
  }
  if (data.remark) params.remark = { $regex: data.remark, $options: 'im' }
  if (data.costTypeId) params.costTypeId = data.costTypeId // 支出类型
  if (data.payMethodId) params.payMethodId = data.payMethodId // 支付方式
  if (data.incomesTypeId) params.incomesTypeId = data.incomesTypeId // 收入类型
  if (data.userId) params.userId = { $in: data.userId } // 记账人
  if (data.belongUserId) params.belongUserId = { $in: data.belongUserId } // 归属人

  const res = await Transaction.find(params, {})
    .sort({ date: -1 })
    .skip(pageIndex * pageSize)
    .limit(pageSize)
  const length = await Transaction.find(params, {}).count()
  const retData = {
    total: length,
    datas: res
  }
  if (res) return [null, retData]
  else return ['查询失败', res]
}

// 新增交易信息
exports.addTransaction = async (data) => {
  data.money = Number(data.money)
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
    const year = Number(dayjs(new Date(data.date)).format('YYYY'))
    const budgetItem = budget.find((item) => item.date === year)
    if (budgetItem) {
      budgetItem.currCost += data.money
      const budgetDetail = budgetItem.details.find((item) => item.costTypeId === data.costTypeId)
      if (budgetDetail) {
        budgetDetail.cost += data.money
      }
    } else {
      budget.push({
        date: year,
        totalBudget: 0,
        currCost: data.money,
        details: []
      })
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
exports.editTransaction = async (data) => {
  data.money = Number(data.money)
  const findBill = await Bill.findById(data.billId, { users: 1, costTypes: 1, incomesTypes: 1, payMethods: 1, budget: 1 })
  if (!findBill) return ['未找到账本', null]
  const params = { _id: mongoose.Types.ObjectId(data.id), isDel: false }
  const changeData = {
    date: data.date,
    remark: data.remark,
    money: data.money,
    type: data.type,
    belongUserId: '',
    belongUserName: '全部'
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
    const year = Number(dayjs(new Date(data.date)).format('YYYY'))
    const budgetItem = budget.find((item) => item.date === year)
    if (budgetItem) {
      budgetItem.currCost += differenceMoney
      const budgetDetail = budgetItem.details.find((item) => item.costTypeId === data.costTypeId)
      if (budgetDetail) {
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
exports.deleteTransaction = async (data) => {
  const params = { _id: mongoose.Types.ObjectId(data.id), isDel: false }
  const res = await Transaction.findOneAndUpdate(params, { isDel: true }, { new: true })
  if (!res) return ['该明细不存在', null]

  const findBill = await Bill.findById(res.billId, { budget: 1 })
  if (!findBill) return ['未找到账本', null]

  // 支出交易明细创删除成功后，需向账本表的预算删除数据，并需要减少用户表的总支出或总收入
  if (res.type === 1) {
    // 支出交易明细删除成功后，需向账本表的预算更改数据
    const budget = findBill.budget
    // 若有对应预算，对增加对应预算分项的支出金额
    const year = Number(dayjs(new Date(res.date)).format('YYYY'))
    const budgetItem = budget.find((item) => item.date === year)
    if (budgetItem) {
      budgetItem.currCost -= res.money
      const budgetDetail = budgetItem.details.find((item) => item.costTypeId === data.costTypeId)
      if (budgetDetail) {
        budgetDetail.cost -= res.money
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
exports.getCurrentMonthCost = async (data, userId) => {
  const params = {
    billId: data.billId,
    reimbursement: 0,
    date: {
      $gte: new Date(data.beginDate),
      $lte: new Date(data.endDate)
    },
    isDel: false
  }
  const res = await Transaction.find(params, { type: 1, money: 1, belongUserId: 1, costTypeId: 1, costTypeName: 1, belongUserName: 1, userId: 1 })
  let totalCost = 0,
    belongUserCosts = [],
    costTypeCost = []
  res.forEach((item) => {
    totalCost += item.money
    // 统计各个归属人支出的金额
    const user = belongUserCosts.find((ite) => ite.belongUserId === item.belongUserId && ite.userId === item.userId)
    if (user) {
      user.money += item.money
    } else {
      belongUserCosts.push({
        belongUserId: item.belongUserId,
        belongUserName: item.belongUserName,
        userId: item.userId,
        money: item.money
      })
    }
    // 统计当月各个支出类型的金额
    const costType = costTypeCost.find((ite) => ite.type === item.costTypeId)
    if (costType) {
      costType.money += item.money
    } else {
      costTypeCost.push({ type: item.costTypeId, name: item.costTypeName, money: item.money })
    }
  })

  // 按照从大到小排序
  costTypeCost = costTypeCost
    .sort((a, b) => b.money - a.money)
    .map((item) => {
      item.money = Number(item.money.toFixed(2))
      return item
    })

  if (res) return [null, { totalCost: totalCost.toFixed(2), belongUserCosts, costTypeCost }]
  else return ['查询失败', null]
}

// 导出交易明细
exports.exportData = async (data) => {
  const params = {
    billId: data.billId,
    type: data.type,
    isDel: false
  }
  const findBill = await Bill.findById(data.billId, { users: 1 })
  const users = {}
  findBill.users.forEach((item) => {
    users[item.id] = item.name
  })
  if (!findBill) return ['未找到账本', null]
  const res = await Transaction.find(params, { date: 1, costTypeName: 1, userId: 1, belongUserName: 1, money: 1, remark: 1 }).sort({ date: -1 })
  const excelSrcData = res.map((item) => {
    item.userName = users[item.userId]
    return item
  })
  const headerMaps = [
    { key: 'date', name: '日期' },
    { key: 'costTypeName', name: '类型' },
    { key: 'belongUserName', name: '归属人' },
    { key: 'money', name: '金额' },
    { key: 'remark', name: '备注' },
    { key: 'userName', name: '记账人' }
  ]
  const buffer = createXlsx(excelSrcData, headerMaps)
  return buffer
}

// 解析 excel 文件
exports.getExcelObjs = async (filePath, billId, userId) => {
  const findBill = await Bill.findById(billId, { users: 1, costTypes: 1 })
  if (!findBill) return ['未找到账本', null]
  const workbook = xlsx.parse(filePath)
  const xlsxData = workbook[0].data
  xlsxData.shift()

  const insertData = xlsxData.map((item) => {
    const obj = {
      billId: billId,
      userId: userId,
      date: item[0],
      type: 1,
      costTypeId: '',
      costTypeName: item[1],
      reimbursement: 0,
      belongUserId: '',
      belongUserName: item[2],
      money: item[3],
      remark: item[4],
      isDel: false
    }
    const costType = findBill.costTypes.find((ite) => ite.name === obj.costTypeName)
    obj.costTypeId = costType.id
    const belongUser = findBill.users.find((ite) => ite.name === obj.belongUserName)
    if (belongUser) obj.belongUserId = belongUser.id
    const user = findBill.users.find((ite) => ite.name === item[5])
    if (user) obj.userId = user.id
    return obj
  })
  const res = await Transaction.insertMany(insertData)
  fs.unlinkSync(filePath) // 删除文件
  if (res) return [null, '导入成功']
  return ['导出失败', null]
}
