import { Op } from 'sequelize'
import { AiCallAudit, Bill, User } from '../../database/index'

const pageParams = (page?: number, pageSize?: number) => {
  const p = Math.max(1, Number(page) || 1)
  const size = Math.min(100, Math.max(1, Number(pageSize) || 20))
  return { page: p, pageSize: size, offset: (p - 1) * size }
}

/** AI 审计列表 */
const listAiAudits = async (opts: {
  keyword?: string
  outcome?: string
  page?: number
  pageSize?: number
}) => {
  const { page, pageSize, offset } = pageParams(opts.page, opts.pageSize)
  const where: Record<string, unknown> = {}
  if (opts.outcome === 'success' || opts.outcome === 'error') {
    where.outcome = opts.outcome
  }

  let userIds: string[] | null = null
  if (opts.keyword && opts.keyword.trim()) {
    const kw = `%${opts.keyword.trim()}%`
    const users = (await User.findAll({
      where: { [Op.or]: [{ username: { [Op.like]: kw } }, { nickName: { [Op.like]: kw } }] },
      attributes: ['id'],
      raw: true
    })) as Array<{ id: string }>
    userIds = users.map((u) => u.id)
    if (!userIds.length) {
      return { list: [], total: 0, page, pageSize }
    }
    where.userId = { [Op.in]: userIds }
  }

  const { rows, count } = await AiCallAudit.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: pageSize,
    offset
  })

  const uids = [...new Set(rows.map((r: { userId: string }) => String(r.userId)))]
  const bids = [...new Set(rows.map((r: { billId: string }) => String(r.billId)))]
  const [users, bills] = await Promise.all([
    User.findAll({
      where: { id: { [Op.in]: uids } },
      attributes: ['id', 'username', 'nickName'],
      raw: true
    }) as Promise<Array<{ id: string; username: string; nickName: string }>>,
    Bill.findAll({
      where: { id: { [Op.in]: bids } },
      attributes: ['id', 'name'],
      raw: true
    }) as Promise<Array<{ id: string; name: string }>>
  ])
  const userMap = new Map(users.map((u) => [u.id, u]))
  const billMap = new Map(bills.map((b) => [b.id, b]))

  const list = rows.map((r: { get?: (o: { plain: boolean }) => Record<string, unknown> }) => {
    const plain = r.get ? r.get({ plain: true }) : (r as Record<string, unknown>)
    const user = userMap.get(String(plain.userId))
    const bill = billMap.get(String(plain.billId))
    return {
      id: plain.id,
      createdAt: plain.createdAt,
      userId: plain.userId,
      userName: user?.nickName || user?.username || '',
      billId: plain.billId,
      billName: bill?.name || '',
      capability: plain.capability,
      outcome: plain.outcome,
      errorCategory: plain.errorCategory,
      durationMs: plain.durationMs,
      promptTokens: plain.promptTokens,
      completionTokens: plain.completionTokens,
      totalTokens: plain.totalTokens,
      dailyCount: plain.dailyCount,
      upstreamRequested: plain.upstreamRequested
    }
  })

  return { list, total: count, page, pageSize }
}

export { listAiAudits }
