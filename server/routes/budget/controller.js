import Bill from '../../database/modules/Bills'
import Transaction from '../../database/modules/Transaction'
import dayjs from 'dayjs'

// 查询预算列表
export const getList = async (data) => {
  const findBill = await Bill.findById(data.billId, { budget: 1 })
  if (!findBill) return ['未找到账本', null]
  const params = {
    billId: data.billId,
    date: data.date
  }
  const res = findBill.budget.find((item) => item.date === data.date) || { totalBudget: 0, currCost: 0, details: [] }
  if (res) return [null, res]
  else return ['查询失败', null]
}

// 新增预算
export const addBudget = async (data) => {
  const findBill = await Bill.findById(data.billId, { costTypes: 1, budget: 1 })
  if (!findBill) return ['未找到账本', null]

  let budget = findBill.budget.find((item) => item.date === data.date)
  console.log(data)
  if (budget) {
    // 已存在年度预算
    let budgetDetailItem = budget.details.find((item) => item.costTypeId === data.costTypeId)
    if (!budgetDetailItem) return ['已存在相关预算', null]
    budget.totalBudget += data.money
    budgetDetailItem = {
      costTypeId: data.costTypeId,
      costTypeName: findBill.costTypes.find((item) => item.id === data.costTypeId),
      budget: data.money,
      cost: 0
    }
    // 查找当前年度该支出类型支出的金额
    const params = {
      billId: data.billId,
      type: 1,
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
