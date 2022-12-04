import Budget from '../../database/modules/Budget'

export const getList = async (data) => {
  const params = {
    billId: data.billId,
    date: data.date
  }
  const res = await Budget.find(params, { costTypeId: 1, costTypeName: 1, money: 1, cost: 1 }).sort({ money: 1, cost: 1 })
  if (res) return [null, res]
  else return ['查询失败', null]
}
