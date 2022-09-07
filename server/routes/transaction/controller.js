import Transaction from '../../database/modules/Transaction'

// 查询列表
export const getList = async (data) => {
  const params = {}
  const res = Transaction.find(params)
  if (res) return [null, res]
  else return ['查询失败', res]
}
