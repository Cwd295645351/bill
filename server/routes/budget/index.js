import koaRouter from 'koa-router'
import * as Budget from './controller'
import { ResModel } from '../../model/resModel'

const router = koaRouter({ prefix: '/api/budget' })

router.get('/list', async (ctx, next) => {
  const data = ctx.query
  const { date, billId } = data
  const dateReg = /^\d{4}$/gi
  if (!billId) ctx.body = new ResModel(null, '账本id不能为空', 'error')
  else if (date) {
    if (!date.match(dateReg)) {
      ctx.body = new ResModel(null, '时间不规范', 'error')
      return
    }
    data.date = new Date(date)
    const [err, res] = await Budget.getList(data)
    if (res) ctx.body = new ResModel(res, '查询成功')
    else ctx.body = new ResModel(null, err, 'error')
  } else {
    ctx.body = new ResModel(null, '时间不能为空', 'error')
  }
})

export default router
