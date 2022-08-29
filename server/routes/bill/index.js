import koaRouter from 'koa-router'
import { ResModel } from '../../model/resModel'
import * as BILL from './controller'

const router = koaRouter({ prefix: '/api/bill' })
const name_reg = /^[\u4E00-\u9FA5A-Za-z0-9_]{3,10}$/ // 账本名称校验

// 新增账本
router.post('/create', async (ctx, next) => {
  const data = ctx.request.body
  const name = data.name
  if (name === null || name === undefined || !name_reg.test(name)) {
    ctx.body = new ResModel(null, '账本名称不符合规范', 'error')
    return
  } else {
    const userId = ctx.session.user_id
    const [err, res] = await BILL.createBill({ name, userId })
    if (res) ctx.body = new ResModel(null, '创建成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

// 编辑账本
router.post('/edit', async (ctx, next) => {})

// 删除账本
router.post('/delete', async (ctx, next) => {})

// 生成邀请码，共享账本
router.post('/invite', async (ctx, next) => {})

// 加入账本
router.post('/join', async (ctx, next) => {})

export default router
