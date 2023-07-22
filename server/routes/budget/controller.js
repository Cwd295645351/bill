const Bill = require('../../database/modules/Bills')
const Transaction = require('../../database/modules/Transaction')
const dayjs = require('dayjs')

// 查询预算列表
exports.getList = async (data) => {
  data.date = Number(data.date)
  const findBill = await Bill.findById(data.billId, { users: 1, budget: 1 })
  if (!findBill) return ['未找到账本', null]
  console.log(data.userId)
  if (!findBill.users.find((item) => item.id === data.userId)) return ['该用户并未加入此账本', null]
  console.log(findBill, data.date)
  const res = findBill.budget.find((item) => item.date === data.date) || { totalBudget: 0, currCost: 0, details: [] }
  if (res) return [null, res]
  else return ['查询失败', null]
}

// 新增预算
exports.addBudget = async (data) => {
  data.money = Number(data.money)
  const findBill = await Bill.findById(data.billId, { users: 1, costTypes: 1, budget: 1 })
  if (!findBill) return ['未找到账本', null]
  if (!findBill.users.find((item) => item.id === data.userId)) return ['该用户并未加入此账本', null]

  let budget = findBill.budget.find((item) => item.date === data.date)
  if (budget) {
    // 已存在年度预算
    let budgetDetailItem = budget.details.find((item) => item.costTypeId === data.costTypeId)
    if (budgetDetailItem) return ['已存在相关预算', null]
    budget.totalBudget += data.money
    budgetDetailItem = {
      costTypeId: data.costTypeId,
      costTypeName: findBill.costTypes.find((item) => item.id === data.costTypeId).name,
      budget: data.money,
      cost: 0
    }
    // 查找当前年度该支出类型支出的金额
    const params = {
      billId: data.billId,
      type: 1,
      costTypeId: data.costTypeId,
      date: {
        $gte: dayjs(new Date()).startOf('year').toDate(),
        $lte: dayjs(new Date()).endOf('year').toDate()
      },
      isDel: false
    }
    const res = await Transaction.find(params, { money: 1 })
    budgetDetailItem.cost = res.reduce((prev, curr) => {
      return prev + curr.money
    }, 0)
    budget.details.push(budgetDetailItem)
  } else {
    // 未存在当前年度预算
    budget = [
      {
        date: data.date,
        totalBudget: data.money,
        currCost: 0,
        details: [
          {
            costTypeId: data.costTypeId,
            costTypeName: findBill.costTypes.find((item) => item.id === data.costTypeId).name,
            budget: data.money,
            cost: 0
          }
        ]
      }
    ]
  }
  const updateBillRes = await Bill.findByIdAndUpdate(data.billId, { budget: budget }, { new: true })
  if (updateBillRes) return [null, true]
  else return ['新增失败', null]
}

// 修改预算
exports.editBudget = async (data) => {
  data.money = Number(data.money)
  const findBill = await Bill.findById(data.billId, { users: 1, budget: 1 })
  if (!findBill) return ['未找到账本', null]
  if (!findBill.users.find((item) => item.id === data.userId)) return ['该用户并未加入此账本', null]
  let budget = findBill.budget.find((item) => item.date === data.date)
  if (!budget) return ['不存在该年度预算', null]
  // 查找预算明细
  let budgetDetailItem = budget.details.find((item) => item._id.toString() === data.id)
  if (!budgetDetailItem) return ['不存在相关预算', null]
  budget.totalBudget = budget.totalBudget - budgetDetailItem.budget + data.money // 计算总预算
  budgetDetailItem.budget = data.money // 设置分项预算
  const updateBillRes = await Bill.findByIdAndUpdate(data.billId, { budget: budget }, { new: true })
  if (updateBillRes) return [null, true]
  else return ['编辑失败', null]
}

exports.deleteBudget = async (data) => {
  const findBill = await Bill.findById(data.billId, { users: 1, budget: 1 })
  if (!findBill) return ['未找到账本', null]
  if (!findBill.users.find((item) => item.id === data.userId)) return ['该用户并未加入此账本', null]
  let budget = findBill.budget.find((item) => item.date === data.date)
  if (!budget) return ['不存在该年度预算', null]
  // 查找预算明细
  const budgetDetailItem = budget.details.find((item) => item._id.toString() === data.id)
  if (!budgetDetailItem) return ['不存在相关预算', null]
  budget.totalBudget -= budgetDetailItem.budget
  budget.details = budget.details.filter((item) => item._id.toString() !== data.id)
  const updateBillRes = await Bill.findByIdAndUpdate(data.billId, { budget: budget }, { new: true })
  if (updateBillRes) return [null, true]
  else return ['删除失败', null]
}
