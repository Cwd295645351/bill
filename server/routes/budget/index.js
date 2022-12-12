import koaRouter from 'koa-router'
import * as Budget from './controller'
import { ResModel } from '../../model/resModel'
import { xssData } from '../../utils/xss'

const router = koaRouter({ prefix: '/api/budget' })

// 查询预算列表
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

// 新增预算
router.post('/add', async (ctx, next) => {
  const data = ctx.request.body
  const userId = ctx.header.userid
  data.userId = userId
  xssData(data)
  const { date, billId, costTypeId, money } = data
  if (!billId) ctx.body = new ResModel(null, '账本id不能为空', 'error')
  else if (!date) ctx.body = new ResModel(null, '记账时间不能为空', 'error')
  else if (!costTypeId) ctx.body = new ResModel(null, '支出类型不能为空', 'error')
  else if (!money) ctx.body = new ResModel(null, '金额不能为空', 'error')
  else {
    const [err, res] = await Budget.addBudget(data)
    if (res) ctx.body = new ResModel(null, '新增成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

export default router
