import Transaction from '../../database/modules/Transaction'
import dayjs from 'dayjs'

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

// 查询过去三年的支出类型
export const getCosts = async (billId) => {
  const date = new Date()
  const lastYear = dayjs(date).subtract(1, 'year')
  const twoYearBefore = dayjs(date).subtract(2, 'year')
  const threeYearBefore = dayjs(date).subtract(3, 'year')

  const currDateRange = {
    beginDate: lastYear.startOf('year').toDate(),
    endDate: lastYear.endOf('year').toDate()
  }
  const lastDateRange = {
    beginDate: twoYearBefore.startOf('year').toDate(),
    endDate: twoYearBefore.endOf('year').toDate()
  }
  const twoYearBeforeRange = {
    beginDate: threeYearBefore.startOf('year').toDate(),
    endDate: threeYearBefore.endOf('year').toDate()
  }
  const params = {
    billId: billId,
    date: {
      $gte: currDateRange.beginDate,
      $lte: currDateRange.endDate
    },
    type: 1,
    isDel: false
  }
  const lastYearRes = await Transaction.find(params, { money: 1, costTypeId: 1, costTypeName: 1 })
  params.date = {
    $gte: lastDateRange.beginDate,
    $lte: lastDateRange.endDate
  }
  const twoYearBeforeRes = await Transaction.find(params, { money: 1, costTypeId: 1, costTypeName: 1 })
  params.date = {
    $gte: twoYearBeforeRange.beginDate,
    $lte: twoYearBeforeRange.endDate
  }
  const threeYearBeforeRes = await Transaction.find(params, { money: 1, costTypeId: 1, costTypeName: 1 })

  const res = [
    { name: lastYear.format('YYYY'), datas: lastYearRes },
    { name: twoYearBefore.format('YYYY'), datas: twoYearBeforeRes },
    { name: threeYearBefore.format('YYYY'), datas: threeYearBeforeRes }
  ]
  const result = batchDeal(res)
  return [null, result]
}

const batchDeal = (res) => {
  // 对一年的数据进行处理
  const deal = (res) => {
    const result = []
    res.forEach((item) => {
      let typeObj = result.find((ite) => ite.id === item.costTypeId)
      if (typeObj) {
        typeObj.value += item.money
      } else {
        typeObj = { id: item.costTypeId, name: item.costTypeName, value: item.money }
        result.push(typeObj)
      }
    })
    result.forEach((item) => {
      item.value = item.value.toFixed(2)
    })
    return result
  }

  // 补充剩余的支出类型
  const completeType = (array, maxLength, maxData) => {
    array.forEach((item) => {
      if (item.length !== maxLength) {
        const noData = maxData.filter((ite) => !item.datas.find((it) => it.id === ite.id))
        noData.forEach((ite) => {
          const obj = Object.assign({}, ite)
          obj.value = 0
          item.datas.push(obj)
        })
      }
    })
  }
  const result = res.map((item) => {
    const datas = deal(item.datas)
    return {
      name: item.name,
      datas: datas,
      length: datas.length
    }
  })
  const length1 = result[0].length
  const length2 = result[1].length
  const length3 = result[2].length

  const maxLength = Math.max(length1, length2, length3)

  const maxData = result.find((item) => item.length === maxLength).datas
  completeType(result, maxLength, maxData)

  result.forEach((item) => {
    item.datas = item.datas.sort((a, b) => a.id - b.id)
  })

  const resObj = {
    type: result[0].datas.map((item) => item.name),
    datas: result.map((item) => {
      return { name: item.name, datas: item.datas.map((ite) => ite.value) }
    })
  }

  return resObj
}
