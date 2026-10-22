import { queryString, readBody, type HttpContext } from '../../types/domain'
import KoaRouter from 'koa-router'
import { ResModel } from '../../model/resModel'
import { createCostType, editCostType, deleteCostType, toggleCostTypeShow, createIncomeType, editIncomeType, deleteIncomeType, toggleIncomeTypeShow, createOverviewRule, editOverviewRule, toggleOverviewRule, deleteOverviewRule, getOverviewRuleYearlyList, saveOverviewRuleYearly, deleteOverviewRuleYearly } from './controller'

import VERSION from '../../config/version'

const router = new KoaRouter({ prefix: `/api/${VERSION}/billtype` })

// 支出类型
router.post('/costType/create', async (ctx: HttpContext) => {
  const { billId, name } = readBody(ctx)
  const userId = queryString(ctx.header.userid)
  if (!billId) { ctx.body = new ResModel(null, '缺少账本ID', 'error'); return }
  if (!name || !name.trim()) { ctx.body = new ResModel(null, '类型名称不能为空', 'error'); return }
  const [err, res] = await createCostType({ billId, name: name.trim(), userId })
  if (res) ctx.body = new ResModel(res, '新增成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.put('/costType/edit', async (ctx: HttpContext) => {
  const { id, billId, name } = readBody(ctx)
  const userId = queryString(ctx.header.userid)
  if (!id || !billId) { ctx.body = new ResModel(null, '参数不完整', 'error'); return }
  if (!name || !name.trim()) { ctx.body = new ResModel(null, '类型名称不能为空', 'error'); return }
  const [err, res] = await editCostType({ id, billId, name: name.trim(), userId })
  if (res) ctx.body = new ResModel(res, '编辑成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.post('/costType/delete', async (ctx: HttpContext) => {
  const { id, billId } = readBody(ctx)
  const userId = queryString(ctx.header.userid)
  if (!id || !billId) { ctx.body = new ResModel(null, '参数不完整', 'error'); return }
  const [err, res] = await deleteCostType({ id, billId, userId })
  if (res) ctx.body = new ResModel(res, '删除成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 收入类型
router.post('/incomeType/create', async (ctx: HttpContext) => {
  const { billId, name } = readBody(ctx)
  const userId = queryString(ctx.header.userid)
  if (!billId) { ctx.body = new ResModel(null, '缺少账本ID', 'error'); return }
  if (!name || !name.trim()) { ctx.body = new ResModel(null, '类型名称不能为空', 'error'); return }
  const [err, res] = await createIncomeType({ billId, name: name.trim(), userId })
  if (res) ctx.body = new ResModel(res, '新增成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.put('/incomeType/edit', async (ctx: HttpContext) => {
  const { id, billId, name } = readBody(ctx)
  const userId = queryString(ctx.header.userid)
  if (!id || !billId) { ctx.body = new ResModel(null, '参数不完整', 'error'); return }
  if (!name || !name.trim()) { ctx.body = new ResModel(null, '类型名称不能为空', 'error'); return }
  const [err, res] = await editIncomeType({ id, billId, name: name.trim(), userId })
  if (res) ctx.body = new ResModel(res, '编辑成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.post('/incomeType/delete', async (ctx: HttpContext) => {
  const { id, billId } = readBody(ctx)
  const userId = queryString(ctx.header.userid)
  if (!id || !billId) { ctx.body = new ResModel(null, '参数不完整', 'error'); return }
  const [err, res] = await deleteIncomeType({ id, billId, userId })
  if (res) ctx.body = new ResModel(res, '删除成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 显隐切换

router.post('/costType/toggle', async (ctx: HttpContext) => {
  const { id, billId } = readBody(ctx)
  const userId = queryString(ctx.header.userid)
  if (!id || !billId) { ctx.body = new ResModel(null, '参数不完整', 'error'); return }
  const [err, res] = await toggleCostTypeShow({ id, billId, userId })
  if (res) ctx.body = new ResModel(res, '切换成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.post('/incomeType/toggle', async (ctx: HttpContext) => {
  const { id, billId } = readBody(ctx)
  const userId = queryString(ctx.header.userid)
  if (!id || !billId) { ctx.body = new ResModel(null, '参数不完整', 'error'); return }
  const [err, res] = await toggleIncomeTypeShow({ id, billId, userId })
  if (res) ctx.body = new ResModel(res, '切换成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 概览调整规则
router.post('/overviewRule/create', async (ctx: HttpContext) => {
  const { billId, name, ruleType, unitName, unitPrice, costTypeId } = readBody(ctx)
  const userId = queryString(ctx.header.userid)
  if (!billId) { ctx.body = new ResModel(null, '缺少账本ID', 'error'); return }
  const [err, res] = await createOverviewRule({ billId, name, ruleType, unitName, unitPrice, costTypeId, userId })
  if (res) ctx.body = new ResModel(res, '新增成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.put('/overviewRule/edit', async (ctx: HttpContext) => {
  const { id, billId, name, ruleType, unitName, unitPrice, costTypeId } = readBody(ctx)
  const userId = queryString(ctx.header.userid)
  if (!id || !billId) { ctx.body = new ResModel(null, '参数不完整', 'error'); return }
  const [err, res] = await editOverviewRule({ id, billId, name, ruleType, unitName, unitPrice, costTypeId, userId })
  if (res) ctx.body = new ResModel(res, '编辑成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.post('/overviewRule/toggle', async (ctx: HttpContext) => {
  const { id, billId } = readBody(ctx)
  const userId = queryString(ctx.header.userid)
  if (!id || !billId) { ctx.body = new ResModel(null, '参数不完整', 'error'); return }
  const [err, res] = await toggleOverviewRule({ id, billId, userId })
  if (res) ctx.body = new ResModel(res, '切换成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.post('/overviewRule/delete', async (ctx: HttpContext) => {
  const { id, billId } = readBody(ctx)
  const userId = queryString(ctx.header.userid)
  if (!id || !billId) { ctx.body = new ResModel(null, '参数不完整', 'error'); return }
  const [err, res] = await deleteOverviewRule({ id, billId, userId })
  if (res) ctx.body = new ResModel(res, '删除成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 数量型规则年度配置
router.get('/overviewRule/yearlyList', async (ctx: HttpContext) => {
  const billId = queryString(ctx.query.billId)
  const ruleId = queryString(ctx.query.ruleId)
  const year = queryString(ctx.query.year)
  const userId = queryString(ctx.header.userid)
  if (!billId) { ctx.body = new ResModel(null, '缺少账本ID', 'error'); return }
  const [err, res] = await getOverviewRuleYearlyList({ billId, ruleId, year, userId })
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.post('/overviewRule/saveYearly', async (ctx: HttpContext) => {
  const { billId, ruleId, year, quantity, belongUserId } = readBody(ctx)
  const userId = queryString(ctx.header.userid)
  if (!billId || !ruleId || year == null) { ctx.body = new ResModel(null, '参数不完整', 'error'); return }
  const [err, res] = await saveOverviewRuleYearly({ billId, ruleId, year, quantity, belongUserId, userId })
  if (res) ctx.body = new ResModel(res, '保存成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.post('/overviewRule/deleteYearly', async (ctx: HttpContext) => {
  const { id, billId } = readBody(ctx)
  const userId = queryString(ctx.header.userid)
  if (!id || !billId) { ctx.body = new ResModel(null, '参数不完整', 'error'); return }
  const [err, res] = await deleteOverviewRuleYearly({ id, billId, userId })
  if (res) ctx.body = new ResModel(res, '删除成功')
  else ctx.body = new ResModel(null, err, 'error')
})

export default router
