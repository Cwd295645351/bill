const koaRouter = require('koa-router')
const { ResModel } = require('../../model/resModel')
const { xssData } = require('../../utils/xss')

const Plan = require('./controller')
const VERSION = require('../../config/version')
const router = koaRouter({ prefix: `/api/${VERSION}/plan` })

/** 查询计划列表 */
router.get('/list', async (ctx, next) => {
  const billId = ctx.query.billId
  const userId = ctx.header.userid
  if (!billId) ctx.body = new ResModel(null, '账本id不能为空', 'error')
  else if (!userId) ctx.body = new ResModel(null, 'userId不能为空', 'error')
  else {
    const [err, res] = await Plan.getList({ userId, billId })
    if (res) ctx.body = new ResModel(res, '查询成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

/** 新增计划 */
router.post('/', async (ctx, next) => {
  const data = ctx.request.body
  const userId = ctx.header.userid
  xssData(data)
  const { billId, sort, context } = data
  if (!billId) ctx.body = new ResModel(null, '账本id不能为空', 'error')
  else if (!userId) ctx.body = new ResModel(null, 'userId不能为空', 'error')
  else if (!context) ctx.body = new ResModel(null, '内容不能为空', 'error')
  else if (!sort) ctx.body = new ResModel(null, '序号不能为空', 'error')
  else {
    data.userId = userId
    ctx.body = new ResModel(data, null)
  }
})

/** 更新计划 */
router.put('/', async (ctx, next) => {
  const data = ctx.request.body
  const userId = ctx.header.userid
  xssData(data)
  const { id, billId, sort, context } = data
  if (!id) ctx.body = new ResModel(null, '计划id不能为空', 'error')
  else if (!billId) ctx.body = new ResModel(null, '账本id不能为空', 'error')
  else if (!userId) ctx.body = new ResModel(null, 'userId不能为空', 'error')
  else if (!context) ctx.body = new ResModel(null, '内容不能为空', 'error')
  else if (!sort) ctx.body = new ResModel(null, '序号不能为空', 'error')
  else {
    data.userId = userId
    ctx.body = new ResModel(data, null)
  }
})

/** 删除计划 */
router.delete('/', async (ctx, next) => {
  const data = ctx.request.query
  const userId = ctx.header.userid
  const { id, billId } = data
  if (!id) ctx.body = new ResModel(null, '计划id不能为空', 'error')
  else if (!billId) ctx.body = new ResModel(null, '账本id不能为空', 'error')
  else {
    data.userId = userId
    ctx.body = new ResModel(data, null)
  }
})

/** 完成计划 */
router.post('/finish', async (ctx, next) => {
  const data = ctx.request.query
  const userId = ctx.header.userid
  const { id, billId } = data
  if (!id) ctx.body = new ResModel(null, '计划id不能为空', 'error')
  else if (!billId) ctx.body = new ResModel(null, '账本id不能为空', 'error')
  else {
    data.userId = userId
    ctx.body = new ResModel(data, null)
  }
})

module.exports = router
