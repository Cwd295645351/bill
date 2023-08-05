const koaRouter = require('koa-router')
const { ResModel } = require('../../model/resModel')
const { xssData } = require('../../utils/xss')
const Budget = require('./controller')
const VERSION = require('../../config/version')

const router = koaRouter({ prefix: `/api/${VERSION}/budget` })

// 查询预算列表
router.get('/list', async (ctx, next) => {
  const data = ctx.query
  const userId = ctx.header.userid
  const { date, billId } = data
  const dateReg = /^\d{4}$/gi
  if (!billId) ctx.body = new ResModel(null, '账本id不能为空', 'error')
  else if (!userId) ctx.body = new ResModel(null, 'userId不能为空', 'error')
  else if (date) {
    if (!date.match(dateReg)) {
      ctx.body = new ResModel(null, '时间不规范', 'error')
      return
    }
    data.userId = userId
    const [err, res] = await Budget.getList(data)
    if (res) ctx.body = new ResModel(res, '查询成功')
    else ctx.body = new ResModel(null, err, 'error')
  } else {
    ctx.body = new ResModel(null, '时间不能为空', 'error')
  }
})

// 新增预算
router.post('/', async (ctx, next) => {
  const data = ctx.request.body
  const userId = ctx.header.userid
  xssData(data)
  const { date, billId, costTypeId, money } = data
  if (!billId) ctx.body = new ResModel(null, '账本id不能为空', 'error')
  else if (!userId) ctx.body = new ResModel(null, 'userId不能为空', 'error')
  else if (!date) ctx.body = new ResModel(null, '记账时间不能为空', 'error')
  else if (!costTypeId) ctx.body = new ResModel(null, '支出类型不能为空', 'error')
  else if (!money) ctx.body = new ResModel(null, '金额不能为空', 'error')
  else {
    data.userId = userId
    const [err, res] = await Budget.addBudget(data)
    if (res) ctx.body = new ResModel(null, '新增成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

// 编辑预算
router.put('/', async (ctx, next) => {
  const data = ctx.request.body
  const userId = ctx.header.userid
  xssData(data)
  const { date, billId, money, id } = data
  if (!id) ctx.body = new ResModel(null, 'id不能为空', 'error')
  else if (!userId) ctx.body = new ResModel(null, 'userId不能为空', 'error')
  else if (!billId) ctx.body = new ResModel(null, '账本id不能为空', 'error')
  else if (!date) ctx.body = new ResModel(null, '记账时间不能为空', 'error')
  else if (!money) ctx.body = new ResModel(null, '金额不能为空', 'error')
  else {
    data.userId = userId
    const [err, res] = await Budget.editBudget(data)
    if (res) ctx.body = new ResModel(null, '编辑成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

// 删除预算
router.delete('/', async (ctx, next) => {
  const data = ctx.request.query
  const userId = ctx.header.userid
  xssData(data)
  const { date, billId, id } = data
  if (!id) ctx.body = new ResModel(null, 'id不能为空', 'error')
  else if (!userId) ctx.body = new ResModel(null, 'userId不能为空', 'error')
  else if (!billId) ctx.body = new ResModel(null, '账本id不能为空', 'error')
  else if (!date) ctx.body = new ResModel(null, '记账时间不能为空', 'error')
  else {
    data.userId = userId
    const [err, res] = await Budget.deleteBudget(data)
    if (res) ctx.body = new ResModel(null, '删除成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

module.exports = router
