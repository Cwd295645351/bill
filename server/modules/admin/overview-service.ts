import { Op } from 'sequelize'
import {
  AiCallAudit,
  Bill,
  Transaction,
  User,
  UserWechat,
  sequelize
} from '../../database/index'
import { shanghaiKeyFromTimestamp, shanghaiRange } from './time-window'

const emptyDayBuckets = (keys: string[]) =>
  keys.map((date) => ({ date, count: 0, expenseSum: 0, incomeSum: 0 }))

const emptyAiBuckets = (keys: string[]) =>
  keys.map((date) => ({ date, total: 0, success: 0, totalTokens: 0 }))

/** 运营总览：存量 + 近 7/30 日趋势 */
const getOverview = async (range: 7 | 30) => {
  const window = shanghaiRange(range)

  const activeUsers = (await User.findAll({
    where: { isDel: false },
    attributes: ['id'],
    raw: true
  })) as Array<{ id: string }>
  const activeUserIds = activeUsers.map((u) => String(u.id))

  const [userCount, billCount, wechatBindCount, txAgg, newUserCount, newBillCount] = await Promise.all([
    Promise.resolve(activeUserIds.length),
    Bill.count({ where: { isDel: false } }),
    activeUserIds.length
      ? UserWechat.count({ where: { userId: { [Op.in]: activeUserIds } } })
      : Promise.resolve(0),
    Transaction.findAll({
      where: { isDel: false },
      attributes: [
        'type',
        [sequelize.fn('COUNT', sequelize.col('id')), 'cnt'],
        [sequelize.fn('SUM', sequelize.col('money')), 'sum']
      ],
      group: ['type'],
      raw: true
    }) as Promise<Array<{ type: number; cnt: string | number; sum: string | number }>>,
    User.count({
      where: {
        createdAt: { [Op.gte]: window.startAt, [Op.lte]: window.endAt }
      }
    }),
    Bill.count({
      where: {
        createdAt: { [Op.gte]: window.startAt, [Op.lte]: window.endAt }
      }
    })
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

  const txRows = (await Transaction.findAll({
    where: {
      isDel: false,
      date: { [Op.gte]: window.startAt.getTime(), [Op.lte]: window.endAt.getTime() }
    },
    attributes: ['date', 'type', 'money'],
    raw: true
  })) as Array<{ date: number; type: number; money: number }>

  const txTrendMap = new Map(emptyDayBuckets(window.keys).map((d) => [d.date, { ...d }]))
  for (const row of txRows) {
    const key = shanghaiKeyFromTimestamp(Number(row.date))
    const bucket = txTrendMap.get(key)
    if (!bucket) continue
    bucket.count += 1
    const money = Number(row.money) || 0
    if (Number(row.type) === 1) bucket.expenseSum += money
    else bucket.incomeSum += money
  }

  const aiRows = (await AiCallAudit.findAll({
    where: {
      createdAt: { [Op.gte]: window.startAt, [Op.lte]: window.endAt }
    },
    attributes: ['createdAt', 'outcome', 'totalTokens'],
    raw: true
  })) as Array<{ createdAt: Date; outcome: string; totalTokens: number | null }>

  const aiTrendMap = new Map(emptyAiBuckets(window.keys).map((d) => [d.date, { ...d }]))
  let aiTotal = 0
  let aiSuccess = 0
  let promptTokens = 0
  let completionTokens = 0
  let totalTokens = 0

  const aiTokenRows = (await AiCallAudit.findAll({
    where: {
      createdAt: { [Op.gte]: window.startAt, [Op.lte]: window.endAt }
    },
    attributes: [
      [sequelize.fn('SUM', sequelize.col('prompt_tokens')), 'promptTokens'],
      [sequelize.fn('SUM', sequelize.col('completion_tokens')), 'completionTokens'],
      [sequelize.fn('SUM', sequelize.col('total_tokens')), 'totalTokens']
    ],
    raw: true
  })) as Array<{ promptTokens: string | number | null; completionTokens: string | number | null; totalTokens: string | number | null }>

  promptTokens = Number(aiTokenRows[0]?.promptTokens) || 0
  completionTokens = Number(aiTokenRows[0]?.completionTokens) || 0
  totalTokens = Number(aiTokenRows[0]?.totalTokens) || 0

  for (const row of aiRows) {
    aiTotal += 1
    if (row.outcome === 'success') aiSuccess += 1
    const key = shanghaiKeyFromTimestamp(new Date(row.createdAt).getTime())
    const bucket = aiTrendMap.get(key)
    if (!bucket) continue
    bucket.total += 1
    if (row.outcome === 'success') bucket.success += 1
    bucket.totalTokens += Number(row.totalTokens) || 0
  }

  return {
    userCount,
    billCount,
    wechatBindCount,
    transactionCount,
    expenseSum,
    incomeSum,
    newUserCount,
    newBillCount,
    range,
    transactionTrend: window.keys.map((k) => txTrendMap.get(k)!),
    aiTotal,
    aiSuccess,
    successRate: aiTotal === 0 ? null : aiSuccess / aiTotal,
    promptTokens,
    completionTokens,
    totalTokens,
    aiTrend: window.keys.map((k) => aiTrendMap.get(k)!)
  }
}

export { getOverview }
