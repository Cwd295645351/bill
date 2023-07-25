const koaRouter = require('koa-router')
const { ResModel } = require('../../model/resModel')
const { xssData } = require('../../utils/xss')
const BILL = require('./controller')
const VERSION = require('../../config/version')

const router = koaRouter({ prefix: `/api/${VERSION}/bill` })
const name_reg = /^[\u4E00-\u9FA5A-Za-z0-9_]{3,10}$/ // 账本名称校验

router.get('/list', async (ctx, next) => {
  const userId = ctx.header.userid
  const nickName = decodeURIComponent(ctx.header.nickname)

  const [err, res] = await BILL.getBillList({ userId, nickName })
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 新增账本
router.post('/', async (ctx, next) => {
  const data = ctx.request.body
  xssData(data)
  const name = data.name
  const nickName = decodeURIComponent(ctx.header.nickname)
  if (!name || !name_reg.test(name)) {
    ctx.body = new ResModel(null, '账本名称不符合规范', 'error')
    return
  } else if (!nickName) {
    ctx.body = new ResModel(null, '用户昵称不能为空', 'error')
    return
  }
  const userId = ctx.header.userid
  const [err, res] = await BILL.createBill({ name, userId, nickName })
  if (res) ctx.body = new ResModel(res, '创建成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 编辑账本名称
router.put('/', async (ctx, next) => {
  const data = ctx.request.body
  xssData(data)
  const name = data.name
  const id = data.id
  if (!id) {
    ctx.body = new ResModel(null, 'id不能为空', 'error')
    return
  } else if (!name || !name_reg.test(name)) {
    ctx.body = new ResModel(null, '账本名称不符合规范', 'error')
    return
  }
  const [err, res] = await BILL.editBill({ name, id })
  if (res) ctx.body = new ResModel(null, '编辑成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 删除账本
router.delete('/', async (ctx, next) => {
  const data = ctx.request.query
  xssData(data)
  const id = data.id
  const userId = ctx.header.userid
  if (!id) {
    ctx.body = new ResModel(null, 'id不能为空', 'error')
    return
  }
  const [err, res] = await BILL.delBill({ id, userId })
  if (res) ctx.body = new ResModel(null, '删除成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 查看账本详情
router.get('/', async (ctx, next) => {
  const params = ctx.query
  xssData(params)
  const id = params.id
  const nickName = decodeURIComponent(ctx.header.nickname)
  if (!id) {
    ctx.body = new ResModel(null, 'id不能为空')
    return
  }
  const userId = ctx.header.userid
  const [err, res] = await BILL.getBillDetail({ id, userId, nickName })
  if (res) ctx.body = new ResModel(res, '查看成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 生成邀请码，共享账本
router.post('/invite', async (ctx, next) => {
  const data = ctx.request.body
  xssData(data)
  const id = data.id
  if (!id) {
    ctx.body = new ResModel(null, 'id不能为空', 'error')
    return
  }
  const [err, res] = await BILL.invite({ id, userId: ctx.header.userid })
  if (res) ctx.body = new ResModel(res, '生成邀请码成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 加入账本
router.post('/join', async (ctx, next) => {
  const data = ctx.request.body
  xssData(data)
  const nickName = decodeURIComponent(ctx.header.nickname)
  const code = data.code
  if (!code) {
    ctx.body = new ResModel(null, '邀请码不能为空', 'error')
    return
  } else if (!nickName) {
    ctx.body = new ResModel(null, '用户昵称不能为空', 'error')
    return
  }
  const userId = ctx.header.userid
  const [err, res] = await BILL.joinBill({ userId, code, nickName })
  if (res) ctx.body = new ResModel(res, '加入账本成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 退出账本/将某人移出账本
router.post('/quit', async (ctx, next) => {
  const data = ctx.request.body
  xssData(data)
  const id = data.id
  const userId = data.userId
  const nickName = decodeURIComponent(ctx.header.nickname)
  if (!id) {
    ctx.body = new ResModel(null, 'id不能为空', 'error')
    return
  } else if (!userId) {
    ctx.body = new ResModel(null, 'userId不能为空', 'error')
    return
  } else if (!nickName) {
    ctx.body = new ResModel(null, '用户昵称不能为空', 'error')
    return
  } else if (userId === ctx.header.userid) {
    // 退出账本
    const [err, res] = await BILL.quitBill({ userId, id, nickName })
    console.log(err, res)
    if (res) ctx.body = new ResModel(null, '退出成功')
    else ctx.body = new ResModel(null, err, 'error')
  } else {
    // 将某人移出账本
    const [err, res] = await BILL.removePerson({ userId, id, nickName })
    if (res) ctx.body = new ResModel(null, '移除成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

module.exports = router
