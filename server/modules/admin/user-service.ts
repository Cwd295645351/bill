import { Op } from 'sequelize'
import { AiCallAudit, Bill, BillUser, User, UserWechat } from '../../database/index'

const pageParams = (page?: number, pageSize?: number) => {
  const p = Math.max(1, Number(page) || 1)
  const size = Math.min(100, Math.max(1, Number(pageSize) || 20))
  return { page: p, pageSize: size, offset: (p - 1) * size }
}

/** 用户列表 */
const listUsers = async (opts: {
  keyword?: string
  includeDeleted?: boolean
  page?: number
  pageSize?: number
}) => {
  const { page, pageSize, offset } = pageParams(opts.page, opts.pageSize)
  const where: Record<string, unknown> = {}
  if (!opts.includeDeleted) where.isDel = false
  if (opts.keyword && opts.keyword.trim()) {
    const kw = `%${opts.keyword.trim()}%`
    Object.assign(where, {
      [Op.or]: [{ username: { [Op.like]: kw } }, { nickName: { [Op.like]: kw } }]
    })
  }

  const { rows, count } = await User.findAndCountAll({
    where: where as never,
    attributes: ['id', 'username', 'nickName', 'incomes', 'expenses', 'isDel', 'createdAt'],
    order: [['createdAt', 'DESC']],
    limit: pageSize,
    offset
  })

  const ids = rows.map((r: { id: string }) => String(r.id))
  const [wechatRows, billCounts] = await Promise.all([
    UserWechat.findAll({ where: { userId: { [Op.in]: ids } }, attributes: ['userId'], raw: true }) as Promise<
      Array<{ userId: string }>
    >,
    BillUser.findAll({
      where: { userId: { [Op.in]: ids } },
      attributes: ['userId'],
      raw: true
    }) as Promise<Array<{ userId: string }>>
  ])
  const wechatSet = new Set(wechatRows.map((w) => w.userId))
  const billCountMap = new Map<string, number>()
  for (const row of billCounts) {
    billCountMap.set(row.userId, (billCountMap.get(row.userId) || 0) + 1)
  }

  const list = rows.map((r: { get?: (o: { plain: boolean }) => Record<string, unknown>; id?: string }) => {
    const plain = r.get ? r.get({ plain: true }) : (r as Record<string, unknown>)
    return {
      id: plain.id,
      username: plain.username,
      nickName: plain.nickName,
      wechatBound: wechatSet.has(String(plain.id)),
      createdAt: plain.createdAt || null,
      billCount: billCountMap.get(String(plain.id)) || 0,
      incomes: Number(plain.incomes) || 0,
      expenses: Number(plain.expenses) || 0,
      isDel: !!plain.isDel
    }
  })

  return { list, total: count, page, pageSize }
}

/** 用户详情 */
const getUserDetail = async (id: string) => {
  const user = await User.findByPk(id, {
    attributes: ['id', 'username', 'nickName', 'incomes', 'expenses', 'isDel', 'createdAt']
  })
  if (!user) return null
  const plain = user.get({ plain: true }) as Record<string, unknown>
  const [wechat, memberships, recentAi] = await Promise.all([
    UserWechat.findOne({ where: { userId: id } }),
    BillUser.findAll({ where: { userId: id }, raw: true }) as Promise<Array<{ billId: string }>>,
    AiCallAudit.findAll({
      where: { userId: id },
      order: [['createdAt', 'DESC']],
      limit: 20,
      raw: true
    })
  ])
  const billIds = memberships.map((m) => m.billId)
  const bills = billIds.length
    ? ((await Bill.findAll({
        where: { id: { [Op.in]: billIds } },
        attributes: ['id', 'name', 'creator'],
        raw: true
      })) as Array<{ id: string; name: string; creator: string }>)
    : []

  return {
    id: plain.id,
    username: plain.username,
    nickName: plain.nickName,
    wechatBound: !!wechat,
    createdAt: plain.createdAt || null,
    billCount: bills.length,
    incomes: Number(plain.incomes) || 0,
    expenses: Number(plain.expenses) || 0,
    isDel: !!plain.isDel,
    bills: bills.map((b) => ({
      id: b.id,
      name: b.name,
      isCreator: String(b.creator) === String(id)
    })),
    recentAi: recentAi.map((a: Record<string, unknown>) => ({
      id: a.id,
      createdAt: a.createdAt,
      billId: a.billId,
      capability: a.capability,
      outcome: a.outcome,
      errorCategory: a.errorCategory,
      durationMs: a.durationMs,
      promptTokens: a.promptTokens,
      completionTokens: a.completionTokens,
      totalTokens: a.totalTokens,
      dailyCount: a.dailyCount,
      upstreamRequested: a.upstreamRequested
    }))
  }
}

export { listUsers, getUserDetail }
