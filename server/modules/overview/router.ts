import { currentUserId } from '../../http/current-user'
import { queryString, readBody, type Row, type HttpContext } from '../../types/domain'
import type { Next } from 'koa'
import KoaRouter from 'koa-router'
import { ResModel } from '../../http/res-model'

import { getBlance, getCosts } from './query-service'
import { getSettlement } from './settlement-route'
import { getMobileOverview, getMobileRecords } from './mobile-view'
import { toTimestamp } from '../../utils/dateUtil'
import VERSION from '../../config/version'

const router = new KoaRouter({ prefix: `/api/${VERSION}/overview` })

// 收支记录
router.get('/balance', async (ctx: HttpContext, next: Next) => {
  const query = ctx.query
  const billId = queryString(query.billId)
  const beginDate = queryString(query.beginDate)
  const endDate = queryString(query.endDate)
  if (!billId) ctx.body = new ResModel(null, '账本id不能未空', 'error')
  else if (!beginDate) ctx.body = new ResModel(null, '开始时间不能为空', 'error')
  else if (!endDate) ctx.body = new ResModel(null, '结束时间不能为空', 'error')
  else if (toTimestamp(beginDate) == null) ctx.body = new ResModel(null, '开始时间不正确', 'error')
  else if (toTimestamp(endDate) == null) ctx.body = new ResModel(null, '结束时间不正确', 'error')
  else {
    const params: Row = { billId, beginDate: toTimestamp(beginDate), endDate: toTimestamp(endDate) }
    const [err, res] = await getBlance(params, currentUserId(ctx))
    if (res) ctx.body = new ResModel(res, '查询成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

// 多人分账。不影响上面的汇总接口
router.post('/settlement', async (ctx: HttpContext, next: Next) => {
  const data = readBody(ctx) || {}
  const billId = data.billId
  const beginDate = data.beginDate
  const endDate = data.endDate
  if (!billId) ctx.body = new ResModel(null, '账本id不能未空', 'error')
  else if (!beginDate) ctx.body = new ResModel(null, '开始时间不能为空', 'error')
  else if (!endDate) ctx.body = new ResModel(null, '结束时间不能为空', 'error')
  else if (toTimestamp(beginDate) == null) ctx.body = new ResModel(null, '开始时间不正确', 'error')
  else if (toTimestamp(endDate) == null) ctx.body = new ResModel(null, '结束时间不正确', 'error')
  else if (Object.prototype.hasOwnProperty.call(data, 'cumulativeIncome') && typeof data.cumulativeIncome !== 'boolean') {
    ctx.body = new ResModel(null, '按累计收入分参数不正确', 'error')
  } else {
    const params: Row = {
      billId,
      beginDate: toTimestamp(beginDate),
      endDate: toTimestamp(endDate),
      cumulativeIncome: data.cumulativeIncome === true
    }
    const [err, res] = await getSettlement(params, currentUserId(ctx))
    if (res) ctx.body = new ResModel(res, '查询成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

// 手机概览。只读，不接收数量输入
router.get('/mobile/records', async (ctx: HttpContext, next: Next) => {
  const query = ctx.query
  const billId = queryString(query.billId)
  const beginDate = queryString(query.beginDate)
  const endDate = queryString(query.endDate)
  const costTypeId = queryString(query.costTypeId)
  if (!billId) ctx.body = new ResModel(null, '账本id不能未空', 'error')
  else if (!beginDate) ctx.body = new ResModel(null, '开始时间不能为空', 'error')
  else if (!endDate) ctx.body = new ResModel(null, '结束时间不能为空', 'error')
  else if (!costTypeId) ctx.body = new ResModel(null, '分类不能为空', 'error')
  else {
    const [err, res] = await getMobileRecords(
      { billId, beginDate, endDate, costTypeId, memberId: queryString(query.memberId) },
      currentUserId(ctx)
    )
    if (res) ctx.body = new ResModel(res, '查询成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

router.get('/mobile', async (ctx: HttpContext, next: Next) => {
  const query = ctx.query
  const billId = queryString(query.billId)
  const beginDate = queryString(query.beginDate)
  const endDate = queryString(query.endDate)
  const cumulativeText = queryString(query.cumulativeIncome)
  const cumulativeInvalid = query.cumulativeIncome !== undefined && cumulativeText !== 'true' && cumulativeText !== 'false'
  if (!billId) ctx.body = new ResModel(null, '账本id不能未空', 'error')
  else if (!beginDate) ctx.body = new ResModel(null, '开始时间不能为空', 'error')
  else if (!endDate) ctx.body = new ResModel(null, '结束时间不能为空', 'error')
  else if (cumulativeInvalid) {
    ctx.body = new ResModel(null, '按累计收入分参数不正确', 'error')
  } else {
    const [err, res] = await getMobileOverview(
      { billId, beginDate, endDate, cumulativeIncome: cumulativeText === 'true' },
      currentUserId(ctx)
    )
    if (res) ctx.body = new ResModel(res, '查询成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

// 近三年支出
router.get('/threeYearCost', async (ctx: HttpContext, next: Next) => {
  const billId = queryString(ctx.query.billId)
  if (!billId) ctx.body = new ResModel(null, '账本id不能未空', 'error')
  else {
    const [err, res] = await getCosts(billId, currentUserId(ctx))
    if (res) ctx.body = new ResModel(res, '查询成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

export default router
