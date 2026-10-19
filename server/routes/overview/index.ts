import { queryString, readBody, type Row, type HttpContext } from '../../types/domain'
import type { Next } from 'koa'
import KoaRouter from 'koa-router'
import { ResModel } from '../../model/resModel'

import * as Overview from './controller'
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
  else {
    const params: Row = { billId, beginDate: toTimestamp(beginDate), endDate: toTimestamp(endDate) }
    const [err, res] = await Overview.getBlance(params)
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
  else {
    const params: Row = {
      billId,
      beginDate: toTimestamp(beginDate),
      endDate: toTimestamp(endDate),
      quantityInputs: data.quantityInputs
    }
    const [err, res] = await Overview.getSettlement(params, queryString(ctx.header.userid))
    if (res) ctx.body = new ResModel(res, '查询成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

// 近三年支出
router.get('/threeYearCost', async (ctx: HttpContext, next: Next) => {
  const billId = queryString(ctx.query.billId)
  if (!billId) ctx.body = new ResModel(null, '账本id不能未空', 'error')
  else {
    const [err, res] = await Overview.getCosts(billId)
    if (res) ctx.body = new ResModel(res, '查询成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

export default router
