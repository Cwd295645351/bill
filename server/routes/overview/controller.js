const { Transaction, BillUser, BillOverviewRule, User } = require('../../database/index')
const dayjs = require('dayjs')
const { Op } = require('sequelize')
const { buildSettlement } = require('../../database/services/overviewSettlement')
const { toBelongResponse } = require('../../database/services/belongUsers')

/** 金额保留两位小数（返回 number） */
const fixMoney = (n) => Number(Number(n).toFixed(2))

// 查询收支和各归属人概况
exports.getBlance = async (data, userId) => {
  const params = {
    billId: data.billId,
    date: { [Op.between]: [data.beginDate, data.endDate] },
    isDel: false
  }
  const res = await Transaction.findAll({
    where: params,
    attributes: ['type', 'money', 'belongUserId', 'costTypeId', 'costTypeName', 'belongUserName', 'userId']
  })
  let totalCost = 0,
    totalIncomes = 0,
    investCost = 0,
    belongUserCosts = [],
    costTypeRank = {}
  res.forEach((item) => {
    const money = item.money
    if (item.type === 1) {
      // 支出
      totalCost += money
      if (item.costTypeId === '1015') {
        // 投资支出
        investCost += money
      }
    } else {
      // 收入
      totalIncomes += money
    }
    // 统计各个归属人收支金额
    const user = belongUserCosts.find((ite) => ite.type === item.type && ite.belongUserId === item.belongUserId && ite.userId === item.userId)
    if (user) {
      user.money += money
    } else {
      belongUserCosts.push({
        type: item.type,
        belongUserId: item.belongUserId,
        belongUserName: item.belongUserName,
        userId: item.userId,
        money
      })
    }

    // 只统计支出
    if (item.type === 1) {
      if (costTypeRank[item.belongUserName]) {
        // 有对应归属人类型
        const costType = costTypeRank[item.belongUserName].find((ite) => ite.type === item.costTypeId)
        if (costType) {
          costType.money += money
        } else {
          costTypeRank[item.belongUserName].push({ type: item.costTypeId, name: item.costTypeName, money })
        }
      } else {
        costTypeRank[item.belongUserName] = [
          {
            type: item.costTypeId,
            name: item.costTypeName,
            money
          }
        ]
      }
    }
  })

  belongUserCosts = belongUserCosts.map((item) => toBelongResponse({ ...item, money: fixMoney(item.money) }))
  Object.keys(costTypeRank).forEach((key) => {
    costTypeRank[key].forEach((item) => {
      item.money = fixMoney(item.money)
    })
  })

  const result = {
    totalCost: fixMoney(totalCost),
    totalIncomes: fixMoney(totalIncomes),
    investCost: fixMoney(investCost),
    belongUserCosts,
    costTypeRank
  }

  if (res) return [null, result]
  else return ['查询失败', null]
}

// 查询过去三年的支出类型
exports.getCosts = async (billId) => {
  const date = new Date()
  const lastYear = dayjs(date).subtract(1, 'year')
  const twoYearBefore = dayjs(date).subtract(2, 'year')
  const threeYearBefore = dayjs(date).subtract(3, 'year')

  const params = {
    billId: billId,
    type: 1,
    isDel: false
  }
  params.date = { [Op.between]: [lastYear.startOf('year').valueOf(), lastYear.endOf('year').valueOf()] }
  const lastYearRes = await Transaction.findAll({ where: params, attributes: ['money', 'costTypeId', 'costTypeName'] })
  params.date = { [Op.between]: [twoYearBefore.startOf('year').valueOf(), twoYearBefore.endOf('year').valueOf()] }
  const twoYearBeforeRes = await Transaction.findAll({ where: params, attributes: ['money', 'costTypeId', 'costTypeName'] })
  params.date = { [Op.between]: [threeYearBefore.startOf('year').valueOf(), threeYearBefore.endOf('year').valueOf()] }
  const threeYearBeforeRes = await Transaction.findAll({ where: params, attributes: ['money', 'costTypeId', 'costTypeName'] })

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
      item.value = fixMoney(item.value)
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
          obj.value = fixMoney(0)
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

/**
 * 校验数量规则输入。通过时返回归一化后的数组。
 * 未出现在请求里的已启用数量规则按数量 0。
 */
const normalizeQuantityInputs = (rawInputs, enabledRules, memberIds) => {
  const inputs = Array.isArray(rawInputs) ? rawInputs : []
  const quantityRules = enabledRules.filter((rule) => rule.ruleType === 'quantity')
  const ruleById = new Map(quantityRules.map((rule) => [rule.id, rule]))
  const seen = new Set()
  const normalized = []
  for (const input of inputs) {
    const ruleId = input && input.ruleId
    const rule = ruleById.get(ruleId)
    if (!rule) return ['数量规则不存在或未启用', null]
    if (seen.has(ruleId)) continue
    seen.add(ruleId)
    const rawQty = input.quantity
    const quantity = rawQty === undefined || rawQty === null || rawQty === '' ? 0 : Number(rawQty)
    if (!Number.isFinite(quantity) || quantity < 0) return [`${rule.name}数量不能为负`, null]
    const belongUserId = input.belongUserId || ''
    if (quantity > 0 && !memberIds.has(belongUserId)) return ['归属人不是该账本成员', null]
    normalized.push({ ruleId, quantity, belongUserId })
  }
  quantityRules.forEach((rule) => {
    if (!seen.has(rule.id)) normalized.push({ ruleId: rule.id, quantity: 0, belongUserId: '' })
  })
  return [null, normalized]
}

/** 多人分账。不改总支出等汇总口径 */
exports.getSettlement = async (data, userId) => {
  const member = await BillUser.findOne({ where: { billId: data.billId, userId } })
  if (!member) return ['不是该账本成员', null]

  const billUsers = await BillUser.findAll({
    where: { billId: data.billId },
    order: [['id', 'ASC']]
  })
  const enabledRules = await BillOverviewRule.findAll({
    where: { billId: data.billId, enabled: true }
  })
  const memberIds = new Set(billUsers.map((item) => item.userId))
  const [inputErr, quantityInputs] = normalizeQuantityInputs(data.quantityInputs, enabledRules, memberIds)
  if (inputErr) return [inputErr, null]

  const rows = await Transaction.findAll({
    where: {
      billId: data.billId,
      date: { [Op.between]: [data.beginDate, data.endDate] },
      isDel: false
    },
    attributes: ['id', 'type', 'money', 'belongUserId', 'costTypeId', 'costTypeName', 'belongUserName', 'userId']
  })

  const outsiderIds = [...new Set(rows.map((row) => row.userId).filter((id) => id && !memberIds.has(id)))]
  const outsiderUsers = outsiderIds.length
    ? await User.findAll({ where: { id: { [Op.in]: outsiderIds } }, attributes: ['id', 'nickName'] })
    : []
  const outsiderNames = new Map(outsiderUsers.map((item) => [item.id, item.nickName]))
  const memberNames = new Map(billUsers.map((item) => [item.userId, item.userName]))

  const result = buildSettlement({
    members: billUsers.map((item) => ({ userId: item.userId, name: item.userName })),
    rules: enabledRules.map((item) => ({
      id: item.id,
      name: item.name,
      ruleType: item.ruleType,
      unitPrice: item.unitPrice,
      costTypeId: item.costTypeId
    })),
    quantityInputs,
    transactions: rows.map((row) => ({
      id: row.id,
      type: row.type,
      money: row.money,
      userId: row.userId,
      payerName: memberNames.get(row.userId) || outsiderNames.get(row.userId) || '未知',
      belongUserId: row.belongUserId,
      belongUserName: row.belongUserName,
      costTypeId: row.costTypeId,
      costTypeName: row.costTypeName
    }))
  })
  return [null, result]
}
