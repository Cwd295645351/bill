const koaRouter = require('koa-router')
const { ResModel } = require('../../model/resModel')
const {
  createCostType, editCostType, deleteCostType, toggleCostTypeShow,
  createIncomeType, editIncomeType, deleteIncomeType, toggleIncomeTypeShow,
  createOverviewRule, editOverviewRule, toggleOverviewRule, deleteOverviewRule
} = require('./controller')

const VERSION = require('../../config/version')

const router = koaRouter({ prefix: `/api/${VERSION}/billtype` })

// 支出类型
router.post('/costType/create', async (ctx) => {
  const { billId, name } = ctx.request.body
  const userId = ctx.header.userid
  if (!billId) { ctx.body = new ResModel(null, '缺少账本ID', 'error'); return }
  if (!name || !name.trim()) { ctx.body = new ResModel(null, '类型名称不能为空', 'error'); return }
  const [err, res] = await createCostType({ billId, name: name.trim(), userId })
  if (res) ctx.body = new ResModel(res, '新增成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.put('/costType/edit', async (ctx) => {
  const { id, billId, name } = ctx.request.body
  const userId = ctx.header.userid
  if (!id || !billId) { ctx.body = new ResModel(null, '参数不完整', 'error'); return }
  if (!name || !name.trim()) { ctx.body = new ResModel(null, '类型名称不能为空', 'error'); return }
  const [err, res] = await editCostType({ id, billId, name: name.trim(), userId })
  if (res) ctx.body = new ResModel(res, '编辑成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.post('/costType/delete', async (ctx) => {
  const { id, billId } = ctx.request.body
  const userId = ctx.header.userid
  if (!id || !billId) { ctx.body = new ResModel(null, '参数不完整', 'error'); return }
  const [err, res] = await deleteCostType({ id, billId, userId })
  if (res) ctx.body = new ResModel(res, '删除成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 收入类型
router.post('/incomeType/create', async (ctx) => {
  const { billId, name } = ctx.request.body
  const userId = ctx.header.userid
  if (!billId) { ctx.body = new ResModel(null, '缺少账本ID', 'error'); return }
  if (!name || !name.trim()) { ctx.body = new ResModel(null, '类型名称不能为空', 'error'); return }
  const [err, res] = await createIncomeType({ billId, name: name.trim(), userId })
  if (res) ctx.body = new ResModel(res, '新增成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.put('/incomeType/edit', async (ctx) => {
  const { id, billId, name } = ctx.request.body
  const userId = ctx.header.userid
  if (!id || !billId) { ctx.body = new ResModel(null, '参数不完整', 'error'); return }
  if (!name || !name.trim()) { ctx.body = new ResModel(null, '类型名称不能为空', 'error'); return }
  const [err, res] = await editIncomeType({ id, billId, name: name.trim(), userId })
  if (res) ctx.body = new ResModel(res, '编辑成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.post('/incomeType/delete', async (ctx) => {
  const { id, billId } = ctx.request.body
  const userId = ctx.header.userid
  if (!id || !billId) { ctx.body = new ResModel(null, '参数不完整', 'error'); return }
  const [err, res] = await deleteIncomeType({ id, billId, userId })
  if (res) ctx.body = new ResModel(res, '删除成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 显隐切换

router.post('/costType/toggle', async (ctx) => {
  const { id, billId } = ctx.request.body
  const userId = ctx.header.userid
  if (!id || !billId) { ctx.body = new ResModel(null, '参数不完整', 'error'); return }
  const [err, res] = await toggleCostTypeShow({ id, billId, userId })
  if (res) ctx.body = new ResModel(res, '切换成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.post('/incomeType/toggle', async (ctx) => {
  const { id, billId } = ctx.request.body
  const userId = ctx.header.userid
  if (!id || !billId) { ctx.body = new ResModel(null, '参数不完整', 'error'); return }
  const [err, res] = await toggleIncomeTypeShow({ id, billId, userId })
  if (res) ctx.body = new ResModel(res, '切换成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 概览调整规则
router.post('/overviewRule/create', async (ctx) => {
  const { billId, name, ruleType, unitName, unitPrice, costTypeId } = ctx.request.body
  const userId = ctx.header.userid
  if (!billId) { ctx.body = new ResModel(null, '缺少账本ID', 'error'); return }
  const [err, res] = await createOverviewRule({ billId, name, ruleType, unitName, unitPrice, costTypeId, userId })
  if (res) ctx.body = new ResModel(res, '新增成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.put('/overviewRule/edit', async (ctx) => {
  const { id, billId, name, ruleType, unitName, unitPrice, costTypeId } = ctx.request.body
  const userId = ctx.header.userid
  if (!id || !billId) { ctx.body = new ResModel(null, '参数不完整', 'error'); return }
  const [err, res] = await editOverviewRule({ id, billId, name, ruleType, unitName, unitPrice, costTypeId, userId })
  if (res) ctx.body = new ResModel(res, '编辑成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.post('/overviewRule/toggle', async (ctx) => {
  const { id, billId } = ctx.request.body
  const userId = ctx.header.userid
  if (!id || !billId) { ctx.body = new ResModel(null, '参数不完整', 'error'); return }
  const [err, res] = await toggleOverviewRule({ id, billId, userId })
  if (res) ctx.body = new ResModel(res, '切换成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.post('/overviewRule/delete', async (ctx) => {
  const { id, billId } = ctx.request.body
  const userId = ctx.header.userid
  if (!id || !billId) { ctx.body = new ResModel(null, '参数不完整', 'error'); return }
  const [err, res] = await deleteOverviewRule({ id, billId, userId })
  if (res) ctx.body = new ResModel(res, '删除成功')
  else ctx.body = new ResModel(null, err, 'error')
})

module.exports = router
