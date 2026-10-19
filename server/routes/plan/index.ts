import { queryString, readBody, type HttpContext } from '../../types/domain'
import type { Next } from 'koa'
import KoaRouter from 'koa-router'
import { ResModel } from '../../model/resModel'
import { xssData } from '../../utils/xss'

import * as Plan from './controller'
import VERSION from '../../config/version'
const router = new KoaRouter({ prefix: `/api/${VERSION}/plan` })

/** 查询计划列表 */
router.get('/list', async (ctx: HttpContext, next: Next) => {
  const billId = queryString(ctx.query.billId)
  const userId = queryString(ctx.header.userid)
  if (!billId) ctx.body = new ResModel(null, '账本id不能为空', 'error')
  else if (!userId) ctx.body = new ResModel(null, 'userId不能为空', 'error')
  else {
    const [err, res] = await Plan.getList({ userId, billId })
    if (res) ctx.body = new ResModel(res, '查询成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

/** 新增计划 */
router.post('/', async (ctx: HttpContext, next: Next) => {
  const data = readBody(ctx)
  const userId = queryString(ctx.header.userid)
  xssData(data)
  const { billId, context, priority, title } = data
  if (!billId) ctx.body = new ResModel(null, '账本id不能为空', 'error')
  else if (!userId) ctx.body = new ResModel(null, 'userId不能为空', 'error')
  else if (!title) ctx.body = new ResModel(null, '标题不能为空', 'error')
  else if (!context) ctx.body = new ResModel(null, '内容不能为空', 'error')
  else if (!priority) ctx.body = new ResModel(null, '优先级不能为空', 'error')
  else {
    const [err, res] = await Plan.add({ billId, userId, context, priority, title })
    if (res) ctx.body = new ResModel(res, '新增成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

/** 更新计划 */
router.put('/', async (ctx: HttpContext, next: Next) => {
  const data = readBody(ctx)
  const userId = queryString(ctx.header.userid)
  xssData(data)
  const { id, billId, context, priority, title } = data
  if (!id) ctx.body = new ResModel(null, '计划id不能为空', 'error')
  else if (!billId) ctx.body = new ResModel(null, '账本id不能为空', 'error')
  else if (!userId) ctx.body = new ResModel(null, 'userId不能为空', 'error')
  else if (!title) ctx.body = new ResModel(null, '标题不能为空', 'error')
  else if (!context) ctx.body = new ResModel(null, '内容不能为空', 'error')
  else if (!priority) ctx.body = new ResModel(null, '优先级不能为空', 'error')
  else {
    const [err, res] = await Plan.edit({ billId, id, userId, context, priority, title })
    if (res) ctx.body = new ResModel(res, '编辑成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

/** 删除计划 */
router.delete('/', async (ctx: HttpContext, next: Next) => {
  const data = ctx.request.query
  const userId = queryString(ctx.header.userid)
  const id = queryString(data.id)
  const billId = queryString(data.billId)
  if (!id) ctx.body = new ResModel(null, '计划id不能为空', 'error')
  else if (!userId) ctx.body = new ResModel(null, 'userId不能为空', 'error')
  else if (!billId) ctx.body = new ResModel(null, '账本id不能为空', 'error')
  else {
    const [err, res] = await Plan.delete({ billId, id, userId })
    if (res) ctx.body = new ResModel(res, '删除成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

export default router
