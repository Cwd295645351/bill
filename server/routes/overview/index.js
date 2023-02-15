import koaRouter from 'koa-router'
import { ResModel } from '../../model/resModel'

import * as Overview from './controller'

const router = koaRouter({ prefix: '/api/overview' })

// 收支记录
router.get('/balance', async (ctx, next) => {
  const query = ctx.query
  const billId = query.billId
  const beginDate = query.beginDate
  const endDate = query.endDate
  if (!billId) ctx.body = new ResModel(null, '账本id不能未空', 'error')
  else if (!beginDate) ctx.body = new ResModel(null, '开始时间不能为空', 'error')
  else if (!endDate) ctx.body = new ResModel(null, '结束时间不能为空', 'error')
  else {
    const params = { billId, beginDate: new Date(beginDate + ' 00:00:00'), endDate: new Date(endDate + ' 23:59:59') }
    const [err, res] = await Overview.getBlance(params)
    if (res) ctx.body = new ResModel(res, '查询成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

// 近三年支出
router.get('/threeYearCost', async (ctx, next) => {
  const { billId } = ctx.query
  if (!billId) ctx.body = new ResModel(null, '账本id不能未空', 'error')
  else {
    const [err, res] = await Overview.getCosts(billId)
    if (res) ctx.body = new ResModel(res, '查询成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

export default router
