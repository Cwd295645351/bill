import koaRouter from 'koa-router'
import { ResModel } from '../../model/resModel'
import { xssData } from '../../utils/xss'
import * as BILL from './controller'

const router = koaRouter({ prefix: '/api/bill' })
const name_reg = /^[\u4E00-\u9FA5A-Za-z0-9_]{3,10}$/ // 账本名称校验

// 新增账本
router.post('/create', async (ctx, next) => {
  const data = ctx.request.body
  xssData(data)
  const name = data.name
  if (name === null || name === undefined || !name_reg.test(name)) {
    ctx.body = new ResModel(null, '账本名称不符合规范', 'error')
    return
  }
  const userId = ctx.session.userId
  const [err, res] = await BILL.createBill({ name, userId })
  if (res) ctx.body = new ResModel(res, '创建成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 编辑账本名称
router.post('/edit', async (ctx, next) => {
  const data = ctx.request.body
  xssData(data)
  const name = data.name
  const id = data.id
  if (id === null || id === undefined || id === '') {
    ctx.body = new ResModel(null, 'id不能为空', 'error')
    return
  } else if (name === null || name === undefined || !name_reg.test(name)) {
    ctx.body = new ResModel(null, '账本名称不符合规范', 'error')
    return
  }
  const [err, res] = await BILL.editBill({ name, id })
  if (res) ctx.body = new ResModel(null, '编辑成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 删除账本
router.post('/delete', async (ctx, next) => {
  const data = ctx.request.body
  xssData(data)
  const id = data.id
  const userId = ctx.session.userId
  if (id === null || id === undefined || id === '') {
    ctx.body = new ResModel(null, 'id不能为空', 'error')
    return
  }
  const [err, res] = await BILL.delBill({ id, userId })
  if (res) ctx.body = new ResModel(null, '删除成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 查看账本详情
router.get('/detail', async (ctx, next) => {
  const params = ctx.query
  xssData(params)
  const id = params.id
  if (id === null || id === undefined || id === '') {
    ctx.body = new ResModel(null, 'id不能为空')
    return
  }
  const userId = ctx.session.userId
  const [err, res] = await BILL.getBillDetail({ id, userId })
  if (res) ctx.body = new ResModel(res, '查看成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 生成邀请码，共享账本
router.post('/invite', async (ctx, next) => {
  const data = ctx.request.body
  xssData(data)
  const id = data.id
  if (id === null || id === undefined || id === '') {
    ctx.body = new ResModel(null, 'id不能为空', 'error')
    return
  }
  const [err, res] = await BILL.invite({ id, userId: ctx.session.userId })
  if (res) ctx.body = new ResModel(res, '生成邀请码成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 加入账本
router.post('/join', async (ctx, next) => {
  const data = ctx.request.body
  xssData(data)
  const code = data.code
  if (code === null || code === undefined || code === '') {
    ctx.body = new ResModel(null, '邀请码不能为空', 'error')
    return
  }
  const userId = ctx.session.userId
  const [err, res] = await BILL.joinBill({ userId, code })
  if (res) ctx.body = new ResModel(res, '加入账本成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 退出账本/将某人移出账本
router.post('/quit', async (ctx, next) => {
  const data = ctx.request.body
  xssData(data)
  const id = data.id
  const userId = data.userId
  if (id === null || id === undefined || id === '') {
    ctx.body = new ResModel(null, 'id不能为空', 'error')
    return
  } else if (userId === null || userId === undefined || userId === '') {
    ctx.body = new ResModel(null, 'userId不能为空', 'error')
    return
  } else if (userId === ctx.session.userId) {
    // 退出账本
    const [err, res] = await BILL.quitBill({ userId, id })
    console.log(err, res)
    if (res) ctx.body = new ResModel(null, '退出成功')
    else ctx.body = new ResModel(null, err, 'error')
  } else {
    // 将某人移出账本
    const [err, res] = await BILL.removePerson({ userId, id })
    if (res) ctx.body = new ResModel(null, '移除成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

export default router
