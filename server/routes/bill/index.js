import koaRouter from 'koa-router'
import { ResModel } from '../../model/resModel'

const router = koaRouter({ prefix: '/api/bill' })
const name_reg = /^[\u4E00-\u9FA5A-Za-z0-9_]{3,10}$/ // 账单名称校验

router.post('/create', async (ctx, next) => {
  const data = ctx.request.body
  const name = data.name
  if (name === null || name === undefined || !name_reg.test(name)) {
    ctx.body = new ResModel(null, '账单名称不符合规范', 'error')
    return
  } else {
    ctx.body = new ResModel(data, '创建成功')
  }
})

export default router
