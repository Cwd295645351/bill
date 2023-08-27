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
  const { billId, context, priority } = data
  if (!billId) ctx.body = new ResModel(null, '账本id不能为空', 'error')
  else if (!userId) ctx.body = new ResModel(null, 'userId不能为空', 'error')
  else if (!context) ctx.body = new ResModel(null, '内容不能为空', 'error')
  else if (!priority) ctx.body = new ResModel(null, '优先级不能为空', 'error')
  else {
    const [err, res] = await Plan.add({ billId, userId, context, priority })
    if (res) ctx.body = new ResModel(res, '新增成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

/** 更新计划 */
router.put('/', async (ctx, next) => {
  const data = ctx.request.body
  const userId = ctx.header.userid
  xssData(data)
  const { id, billId, context, priority, isBuy } = data
  if (!id) ctx.body = new ResModel(null, '计划id不能为空', 'error')
  else if (!billId) ctx.body = new ResModel(null, '账本id不能为空', 'error')
  else if (!userId) ctx.body = new ResModel(null, 'userId不能为空', 'error')
  else if (!context) ctx.body = new ResModel(null, '内容不能为空', 'error')
  else if (!priority) ctx.body = new ResModel(null, '优先级不能为空', 'error')
  else if (!isBuy) ctx.body = new ResModel(null, '是否已购不能为空', 'error')
  else {
    const [err, res] = await Plan.edit({ billId, id, userId, context, priority, isBuy })
    if (res) ctx.body = new ResModel(res, '编辑成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

/** 删除计划 */
router.delete('/', async (ctx, next) => {
  const data = ctx.request.query
  const userId = ctx.header.userid
  const { id, billId } = data
  if (!id) ctx.body = new ResModel(null, '计划id不能为空', 'error')
  else if (!userId) ctx.body = new ResModel(null, 'userId不能为空', 'error')
  else if (!billId) ctx.body = new ResModel(null, '账本id不能为空', 'error')
  else {
    const [err, res] = await Plan.delete({ billId, id, userId })
    if (res) ctx.body = new ResModel(res, '删除成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

module.exports = router
