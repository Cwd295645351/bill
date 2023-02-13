import Transaction from '../../database/modules/Transaction'

// 查询收支和各归属人概况
export const getBlance = async (data, userId) => {
  const params = {
    billId: data.billId,
    date: {
      $gte: new Date(data.beginDate),
      $lte: new Date(data.endDate)
    },
    isDel: false
  }
  const res = await Transaction.find(params, { type: 1, money: 1, belongUserId: 1, costTypeId: 1, costTypeName: 1, belongUserName: 1, userId: 1 })
  let totalCost = 0,
    totalIncomes = 0,
    belongUserCosts = [],
    costTypeRank = {}
  res.forEach((item) => {
    if (item.type === 1) {
      // 支出
      totalCost += item.money
    } else {
      // 收入
      totalIncomes += item.money
    }
    // 统计各个归属人收支金额
    const user = belongUserCosts.find((ite) => ite.type === item.type && ite.belongUserId === item.belongUserId && ite.userId === item.userId)
    if (user) {
      user.money += item.money
    } else {
      belongUserCosts.push({
        type: item.type,
        belongUserId: item.belongUserId,
        belongUserName: item.belongUserName,
        userId: item.userId,
        money: item.money
      })
    }

    // 只统计支出
    if (item.type === 1) {
      if (costTypeRank[item.belongUserName]) {
        // 有对应归属人类型
        const costType = costTypeRank[item.belongUserName].find((ite) => ite.type === item.costTypeId)
        if (costType) {
          costType.money += item.money
        } else {
          costTypeRank[item.belongUserName].push({ type: item.costTypeId, name: item.costTypeName, money: item.money })
        }
      } else {
        costTypeRank[item.belongUserName] = [
          {
            type: item.costTypeId,
            name: item.costTypeName,
            money: item.money
          }
        ]
      }
    }
  })

  const result = { totalCost: totalCost.toFixed(2), totalIncomes: totalIncomes.toFixed(2), belongUserCosts, costTypeRank }

  if (res) return [null, result]
  else return ['查询失败', null]
}
