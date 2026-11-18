import { Op } from 'sequelize'
import { Bill, BillUser, Transaction, User, sequelize } from '../../database/index'

const pageParams = (page?: number, pageSize?: number) => {
  const p = Math.max(1, Number(page) || 1)
  const size = Math.min(100, Math.max(1, Number(pageSize) || 20))
  return { page: p, pageSize: size, offset: (p - 1) * size }
}

/** 账本列表 */
const listBills = async (opts: {
  keyword?: string
  includeDeleted?: boolean
  page?: number
  pageSize?: number
}) => {
  const { page, pageSize, offset } = pageParams(opts.page, opts.pageSize)
  const where: Record<string, unknown> = {}
  if (!opts.includeDeleted) where.isDel = false
  if (opts.keyword && opts.keyword.trim()) {
    where.name = { [Op.like]: `%${opts.keyword.trim()}%` }
  }

  const { rows, count } = await Bill.findAndCountAll({
    where,
    attributes: ['id', 'name', 'creator', 'isDel', 'createdAt'],
    order: [['createdAt', 'DESC']],
    limit: pageSize,
    offset
  })

  const billIds = rows.map((r: { id: string }) => String(r.id))
  const creatorIds = [...new Set(rows.map((r: { creator: string }) => String(r.creator)))]

  const [memberRows, txRows, creators] = await Promise.all([
    BillUser.findAll({
      where: { billId: { [Op.in]: billIds } },
      attributes: ['billId'],
      raw: true
    }) as Promise<Array<{ billId: string }>>,
    Transaction.findAll({
      where: { billId: { [Op.in]: billIds }, isDel: false },
      attributes: [
        'billId',
        'type',
        [sequelize.fn('COUNT', sequelize.col('id')), 'cnt'],
        [sequelize.fn('SUM', sequelize.col('money')), 'sum']
      ],
      group: ['billId', 'type'],
      raw: true
    }) as Promise<Array<{ billId: string; type: number; cnt: string | number; sum: string | number }>>,
    User.findAll({
      where: { id: { [Op.in]: creatorIds } },
      attributes: ['id', 'username', 'nickName'],
      raw: true
    }) as Promise<Array<{ id: string; username: string; nickName: string }>>
  ])

  const memberCountMap = new Map<string, number>()
  for (const row of memberRows) {
    memberCountMap.set(row.billId, (memberCountMap.get(row.billId) || 0) + 1)
  }
  const moneyMap = new Map<string, { transactionCount: number; expenseSum: number; incomeSum: number }>()
  for (const row of txRows) {
    const cur = moneyMap.get(row.billId) || { transactionCount: 0, expenseSum: 0, incomeSum: 0 }
    const cnt = Number(row.cnt) || 0
    const sum = Number(row.sum) || 0
    cur.transactionCount += cnt
    if (Number(row.type) === 1) cur.expenseSum += sum
    else cur.incomeSum += sum
    moneyMap.set(row.billId, cur)
  }
  const creatorMap = new Map(creators.map((c) => [c.id, c]))

  const list = rows.map((r: { get?: (o: { plain: boolean }) => Record<string, unknown> }) => {
    const plain = r.get ? r.get({ plain: true }) : (r as Record<string, unknown>)
    const creator = creatorMap.get(String(plain.creator))
    const money = moneyMap.get(String(plain.id)) || { transactionCount: 0, expenseSum: 0, incomeSum: 0 }
    return {
      id: plain.id,
      name: plain.name,
      creatorId: plain.creator,
      creatorName: creator?.nickName || creator?.username || '',
      memberCount: memberCountMap.get(String(plain.id)) || 0,
      transactionCount: money.transactionCount,
      expenseSum: money.expenseSum,
      incomeSum: money.incomeSum,
      createdAt: plain.createdAt || null,
      isDel: !!plain.isDel
    }
  })

  return { list, total: count, page, pageSize }
}

/** 账本详情 */
const getBillDetail = async (id: string) => {
  const bill = await Bill.findByPk(id, {
    attributes: ['id', 'name', 'creator', 'isDel', 'createdAt']
  })
  if (!bill) return null
  const plain = bill.get({ plain: true }) as Record<string, unknown>
  const [members, creator, txAgg] = await Promise.all([
    BillUser.findAll({
      where: { billId: id },
      attributes: ['userId', 'userName'],
      raw: true
    }) as Promise<Array<{ userId: string; userName: string }>>,
    User.findByPk(String(plain.creator), { attributes: ['id', 'username', 'nickName'], raw: true }) as Promise<{
      id: string
      username: string
      nickName: string
    } | null>,
    Transaction.findAll({
      where: { billId: id, isDel: false },
      attributes: [
        'type',
        [sequelize.fn('COUNT', sequelize.col('id')), 'cnt'],
        [sequelize.fn('SUM', sequelize.col('money')), 'sum']
      ],
      group: ['type'],
      raw: true
    }) as Promise<Array<{ type: number; cnt: string | number; sum: string | number }>>
  ])

  let transactionCount = 0
  let expenseSum = 0
  let incomeSum = 0
  for (const row of txAgg) {
    const cnt = Number(row.cnt) || 0
    const sum = Number(row.sum) || 0
    transactionCount += cnt
    if (Number(row.type) === 1) expenseSum += sum
    else incomeSum += sum
  }

  return {
    id: plain.id,
    name: plain.name,
    creatorId: plain.creator,
    creatorName: creator?.nickName || creator?.username || '',
    memberCount: members.length,
    transactionCount,
    expenseSum,
    incomeSum,
    createdAt: plain.createdAt || null,
    isDel: !!plain.isDel,
    members: members.map((m) => ({ userId: m.userId, userName: m.userName }))
  }
}

export { listBills, getBillDetail }
