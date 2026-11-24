import type { Row, WhereBag } from '../../types/domain'
import type { ViewOrigin } from '../../http/view-origin'
import { Transaction } from '../../database/index'
import { billExists, listMembers } from '../bill'
import { readBillRole } from '../access'
import { attachImagesToList } from './image-service'
import { buildBelongWhere, toBelongResponse } from './belong-users'
import { Op } from 'sequelize'
import dayjs from 'dayjs'
import { toTimestamp, formatDate } from '../../utils/dateUtil'
import { createXlsx } from '../../utils/xlsx'
import { fixMoney } from '../../utils/money'

/** 将单个 id 或 id 数组统一为数组，避免 Op.in 收到字符串时按字符拆分 */
const toIdList = (value: unknown) => {
  if (value == null || value === '') return null
  return Array.isArray(value) ? value : [value]
}

const ORDER_DESC: [string, string][] = [
  ['date', 'DESC'],
  ['id', 'DESC']
]
const ORDER_ASC: [string, string][] = [
  ['date', 'ASC'],
  ['id', 'ASC']
]

/** 组装明细筛选条件。日期范围单独放入 andList，便于再叠加游标条件 */
const buildFilter = (data: Row) => {
  const where: WhereBag = {
    billId: data.billId,
    type: data.type,
    isDel: false,
    money: {}
  }
  const moneyOpMap: Record<string, symbol> = { gt: Op.gt, gte: Op.gte, lt: Op.lt, lte: Op.lte, eq: Op.eq }
  const condition = typeof data.condition === 'string' ? data.condition : ''
  const moneyOp = moneyOpMap[condition] || Op.gte
  where.money = { [moneyOp]: data.rangeMoney }

  const andList: WhereBag[] = []
  const beginTs = toTimestamp(data.beginDate)
  const endTs = toTimestamp(data.endDate)
  if (beginTs != null && endTs != null) {
    andList.push({ date: { [Op.between]: [beginTs, endTs] } })
  } else if (beginTs != null) {
    andList.push({ date: { [Op.gte]: beginTs } })
  } else if (endTs != null) {
    andList.push({ date: { [Op.lte]: endTs } })
  }

  if (data.remark) where.remark = { [Op.like]: `%${data.remark}%` }
  if (data.costTypeId) where.costTypeId = data.costTypeId
  if (data.payMethodId) where.payMethodId = data.payMethodId
  if (data.incomesTypeId) where.incomesTypeId = data.incomesTypeId
  const userIds = toIdList(data.userId)
  if (userIds) where.userId = { [Op.in]: userIds }
  const belongWhere = buildBelongWhere(data.belongUserIds)
  if (belongWhere) andList.push(belongWhere)

  return { where, andList }
}

/** 把日期范围与游标条件一并并入 where */
const withAnd = (where: WhereBag, andList: WhereBag[], extra?: WhereBag) => {
  const list = extra ? [...andList, extra] : [...andList]
  if (!list.length) return where
  return { ...where, [Op.and]: list }
}

/** 比游标更早：日期更小，或同一天且 id 更小（与 date DESC, id DESC 一致） */
const olderThanCursor = (cursorDate: number | string | null | undefined, cursorId: string | null | undefined) => {
  if (!cursorId) return { date: { [Op.lt]: cursorDate } }
  return {
    [Op.or]: [
      { date: { [Op.lt]: cursorDate } },
      { [Op.and]: [{ date: cursorDate }, { id: { [Op.lt]: cursorId } }] }
    ]
  }
}

/** 比游标更新：日期更大，或同一天且 id 更大 */
const newerThanCursor = (cursorDate: number | string | null | undefined, cursorId: string | null | undefined) => {
  if (!cursorId) return { date: { [Op.gt]: cursorDate } }
  return {
    [Op.or]: [
      { date: { [Op.gt]: cursorDate } },
      { [Op.and]: [{ date: cursorDate }, { id: { [Op.gt]: cursorId } }] }
    ]
  }
}

/** 多取 1 条判断是否还有下一页，返回给前端的数据不含这 1 条 */
const queryPage = async (where: WhereBag, order: [string, string][], pageSize: number | string | undefined) => {
  const size = Number(pageSize)
  const rows = await Transaction.findAll({
    where,
    order,
    limit: Number.isFinite(size) ? size + 1 : undefined
  })
  const hasMore = Number.isFinite(size) && rows.length > size
  return { rows: hasMore ? rows.slice(0, size) : rows, hasMore }
}

/** 按筛选条件聚合各月笔数与金额，归月使用 dayjs，避免数据库时区与前端不一致 */
const loadMonthSummaries = async (where: WhereBag) => {
  const rows = await Transaction.findAll({
    where,
    attributes: ['date', 'money'],
    raw: true
  })
  const map = new Map<string, { month: string; count: number; money: number }>()
  rows.forEach((row: Row) => {
    const month = dayjs(Number(row.date)).format('YYYY-MM')
    let item = map.get(month)
    if (!item) {
      item = { month, count: 0, money: 0 }
      map.set(month, item)
    }
    item.count += 1
    item.money += Number(row.money) || 0
  })
  return [...map.values()]
    .map((item) => ({ ...item, money: fixMoney(item.money) }))
    .sort((a, b) => (a.month < b.month ? 1 : -1))
}


// 查询列表
export const getList = async (data: Row, origin: ViewOrigin) => {
  const member = await readBillRole(data.viewerUserId, data.billId)
  if (member.kind !== 'member') return ['不是该账本成员', null]
  const pageIndex = data.pageIndex
  const pageSize = data.pageSize
  const { where, andList } = buildFilter(data)
  const filterWhere = withAnd(where, andList)
  const direction = data.direction
  const anchorTs = toTimestamp(data.anchorDate)
  const useCursor = direction === 'latest' || direction === 'older' || direction === 'newer' || anchorTs != null
  const listOpts = { billId: data.billId, userId: data.viewerUserId, origin }

  // 未传游标参数时保持原来的页码分页，供总览、移动端继续使用
  if (!useCursor) {
    const res = await Transaction.findAll({
      where: filterWhere,
      order: [['date', 'DESC']],
      offset: Number(pageIndex) * Number(pageSize),
      limit: Number.isFinite(Number(pageSize)) ? Number(pageSize) : undefined
    })
    const length = await Transaction.count({ where: filterWhere })
    if (res) {
      const datas = (await attachImagesToList(res, listOpts)).map(toBelongResponse)
      return [null, { total: length, datas }]
    }
    return ['查询失败', res]
  }

  let datas: Row[] = []
  let hasOlder = false
  let hasNewer = false

  if (anchorTs != null && direction !== 'older' && direction !== 'newer') {
    // 定位：该日及更早一页 + 该日之后一页
    const anchorEnd = dayjs(anchorTs).endOf('day').valueOf()
    const olderWhere = withAnd(where, andList, { date: { [Op.lte]: anchorEnd } })
    const newerWhere = withAnd(where, andList, { date: { [Op.gt]: anchorEnd } })
    const older = await queryPage(olderWhere, ORDER_DESC, pageSize)
    const newer = await queryPage(newerWhere, ORDER_ASC, pageSize)
    datas = [...newer.rows].reverse().concat(older.rows)
    hasOlder = older.hasMore
    hasNewer = newer.hasMore
  } else if (direction === 'older' || direction === 'newer') {
    const cursorDate = toTimestamp(data.cursorDate)
    if (cursorDate == null) return ['游标日期不能为空', null]
    const page = await queryPage(
      withAnd(where, andList, direction === 'older' ? olderThanCursor(cursorDate, data.cursorId) : newerThanCursor(cursorDate, data.cursorId)),
      direction === 'older' ? ORDER_DESC : ORDER_ASC,
      pageSize
    )
    datas = direction === 'older' ? page.rows : [...page.rows].reverse()
    hasOlder = direction === 'older' ? page.hasMore : true
    hasNewer = direction === 'newer' ? page.hasMore : true
  } else {
    const page = await queryPage(filterWhere, ORDER_DESC, pageSize)
    datas = page.rows
    hasOlder = page.hasMore
    hasNewer = false
  }

  const total = await Transaction.count({ where: filterWhere })
  datas = (await attachImagesToList(datas, listOpts)).map(toBelongResponse)
  const retData: {
    total: number
    datas: Row[]
    hasOlder: boolean
    hasNewer: boolean
    monthSummaries?: { month: string; count: number; money: number }[]
  } = { total, datas, hasOlder, hasNewer }
  if (data.withMonthSummary) {
    retData.monthSummaries = await loadMonthSummaries(filterWhere)
  }
  return [null, retData]
}

// 查询当月收支和各归属人概况
export const getCurrentMonthCost = async (data: Row, userId: string | null | undefined) => {
  const member = await readBillRole(userId, data.billId)
  if (member.kind !== 'member') return ['不是该账本成员', null]
  const beginTs = toTimestamp(data.beginDate)
  const endTs = toTimestamp(data.endDate)
  const params: WhereBag = {
    billId: data.billId,
    type: 1,
    isDel: false,
    [Op.or]: [{ reimbursement: 0 }, { reimbursement: null }]
  }
  if (beginTs != null && endTs != null) {
    params.date = { [Op.between]: [beginTs, endTs] }
  }
  const res = await Transaction.findAll({
    where: params,
    attributes: ['type', 'money', 'belongUserId', 'costTypeId', 'costTypeName', 'belongUserName', 'userId']
  })
  let totalCost = 0,
    belongUserCosts: { belongUserId?: string | null; belongUserName?: string | null; userId?: string | null; money: number }[] = [],
    costTypeCost: { type?: string | number | null; name?: string | null; money: number }[] = []
  res.forEach((item: Row) => {
    const money = Number(item.money) || 0
    totalCost += money
    // 统计各个归属人支出的金额
    const user = belongUserCosts.find((ite) => ite.belongUserId === item.belongUserId && ite.userId === item.userId)
    if (user) {
      user.money += money
    } else {
      belongUserCosts.push({
        belongUserId: item.belongUserId,
        belongUserName: item.belongUserName,
        userId: item.userId,
        money
      })
    }
    // 统计当月各个支出类型的金额
    const costType = costTypeCost.find((ite) => ite.type === item.costTypeId)
    if (costType) {
      costType.money += money
    } else {
      costTypeCost.push({ type: item.costTypeId, name: item.costTypeName, money })
    }
  })

  const belongCosts = belongUserCosts.map((item) => toBelongResponse({ ...item, money: fixMoney(item.money) } as Row))
  // 按照从大到小排序
  costTypeCost = costTypeCost
    .sort((a, b) => (b.money || 0) - (a.money || 0))
    .map((item) => ({ ...item, money: fixMoney(item.money) }))

  if (res) return [null, { totalCost: fixMoney(totalCost), belongUserCosts: belongCosts, costTypeCost }]
  else return ['查询失败', null]
}

// 导出交易明细
export const exportData = async (data: Row) => {
  const member = await readBillRole(data.userId, data.billId)
  if (member.kind !== 'member') return ['不是该账本成员', null]
  if (!(await billExists(data.billId))) return ['未找到账本', null]
  const memberRows = await listMembers(data.billId)
  const users: Record<string, string | undefined> = {}
  memberRows.forEach((item: { id?: string; name?: string }) => {
    if (item.id) users[item.id] = item.name
  })

  const { where, andList } = buildFilter(data)
  const res = await Transaction.findAll({
    where: withAnd(where, andList),
    attributes: ['date', 'costTypeName', 'userId', 'belongUserName', 'money', 'remark'],
    order: [['date', 'DESC']]
  })
  const excelSrcData = res.map((item: Row) => ({
    date: formatDate(item.getDataValue ? item.getDataValue('date') : item.date),
    costTypeName: item.costTypeName,
    belongUserName: item.belongUserName,
    money: item.money,
    remark: item.remark,
    userName: users[item.userId || '']
  }))
  const headerMaps: Row[] = [
    { key: 'date', name: '日期' },
    { key: 'costTypeName', name: '类型' },
    { key: 'belongUserName', name: '归属人' },
    { key: 'money', name: '金额' },
    { key: 'remark', name: '备注' },
    { key: 'userName', name: '记账人' }
  ]
  const buffer = createXlsx(excelSrcData, headerMaps)
  return buffer
}
