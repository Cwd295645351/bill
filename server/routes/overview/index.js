const koaRouter = require('koa-router')
const { ResModel } = require('../../model/resModel')

const Overview = require('./controller')
const { toTimestamp } = require('../../utils/dateUtil')
const VERSION = require('../../config/version')

const router = koaRouter({ prefix: `/api/${VERSION}/overview` })

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
    const params = { billId, beginDate: toTimestamp(beginDate), endDate: toTimestamp(endDate) }
    const [err, res] = await Overview.getBlance(params)
    if (res) ctx.body = new ResModel(res, '查询成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

// 多人分账。不影响上面的汇总接口
router.post('/settlement', async (ctx, next) => {
  const data = ctx.request.body || {}
  const billId = data.billId
  const beginDate = data.beginDate
  const endDate = data.endDate
  if (!billId) ctx.body = new ResModel(null, '账本id不能未空', 'error')
  else if (!beginDate) ctx.body = new ResModel(null, '开始时间不能为空', 'error')
  else if (!endDate) ctx.body = new ResModel(null, '结束时间不能为空', 'error')
  else {
    const params = {
      billId,
      beginDate: toTimestamp(beginDate),
      endDate: toTimestamp(endDate),
      quantityInputs: data.quantityInputs
    }
    const [err, res] = await Overview.getSettlement(params, ctx.header.userid)
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

module.exports = router
