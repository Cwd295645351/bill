import KoaRouter from 'koa-router'
import { ResModel } from '../../http/res-model'
import { queryString, readBody, type HttpContext } from '../../types/domain'
import VERSION from '../../config/version'
import { requireAdmin } from './require-admin'
import { getOverview } from './overview-service'
import { listUsers, getUserDetail } from './user-service'
import { listBills, getBillDetail } from './bill-admin-service'
import { listAiAudits } from './audit-list-service'
import {
  listCatalogDefaults,
  createCatalogDefault,
  renameCatalogDefault,
  deleteCatalogDefault
} from './catalog-defaults-service'

const router = new KoaRouter({ prefix: `/api/${VERSION}/admin` })

const truthy = (v: unknown) => v === true || v === 'true' || v === '1'

router.get('/overview', async (ctx: HttpContext) => {
  if (!(await requireAdmin(ctx))) return
  const raw = queryString(ctx.query.range)
  const range: 7 | 30 = raw === '30' ? 30 : 7
  const data = await getOverview(range)
  ctx.body = new ResModel(data, '查询成功')
})

router.get('/users', async (ctx: HttpContext) => {
  if (!(await requireAdmin(ctx))) return
  const data = await listUsers({
    keyword: queryString(ctx.query.keyword) || '',
    includeDeleted: truthy(queryString(ctx.query.includeDeleted)),
    page: Number(queryString(ctx.query.page) || 1),
    pageSize: Number(queryString(ctx.query.pageSize) || 20)
  })
  ctx.body = new ResModel(data, '查询成功')
})

router.get('/users/:id', async (ctx: HttpContext) => {
  if (!(await requireAdmin(ctx))) return
  const id = String(ctx.params.id || '')
  const data = await getUserDetail(id)
  if (!data) {
    ctx.body = new ResModel(null, '找不到用户', 'error')
    return
  }
  ctx.body = new ResModel(data, '查询成功')
})

router.get('/bills', async (ctx: HttpContext) => {
  if (!(await requireAdmin(ctx))) return
  const data = await listBills({
    keyword: queryString(ctx.query.keyword) || '',
    includeDeleted: truthy(queryString(ctx.query.includeDeleted)),
    page: Number(queryString(ctx.query.page) || 1),
    pageSize: Number(queryString(ctx.query.pageSize) || 20)
  })
  ctx.body = new ResModel(data, '查询成功')
})

router.get('/bills/:id', async (ctx: HttpContext) => {
  if (!(await requireAdmin(ctx))) return
  const id = String(ctx.params.id || '')
  const data = await getBillDetail(id)
  if (!data) {
    ctx.body = new ResModel(null, '找不到账本', 'error')
    return
  }
  ctx.body = new ResModel(data, '查询成功')
})

router.get('/ai-audits', async (ctx: HttpContext) => {
  if (!(await requireAdmin(ctx))) return
  const data = await listAiAudits({
    keyword: queryString(ctx.query.keyword) || '',
    outcome: queryString(ctx.query.outcome) || '',
    page: Number(queryString(ctx.query.page) || 1),
    pageSize: Number(queryString(ctx.query.pageSize) || 20)
  })
  ctx.body = new ResModel(data, '查询成功')
})

router.get('/catalog-defaults', async (ctx: HttpContext) => {
  if (!(await requireAdmin(ctx))) return
  const data = await listCatalogDefaults({
    kind: queryString(ctx.query.kind) || '',
    includeDeleted: truthy(queryString(ctx.query.includeDeleted))
  })
  ctx.body = new ResModel(data, '查询成功')
})

router.post('/catalog-defaults', async (ctx: HttpContext) => {
  if (!(await requireAdmin(ctx))) return
  const body = readBody(ctx) || {}
  const [err, data] = await createCatalogDefault(String((body as { kind?: string }).kind || ''), String((body as { name?: string }).name || ''))
  if (err) {
    ctx.body = new ResModel(null, err, 'error')
    return
  }
  ctx.body = new ResModel(data, '创建成功')
})

router.put('/catalog-defaults/:kind/:id', async (ctx: HttpContext) => {
  if (!(await requireAdmin(ctx))) return
  const body = readBody(ctx) || {}
  const [err] = await renameCatalogDefault(
    String(ctx.params.kind || ''),
    String(ctx.params.id || ''),
    String((body as { name?: string }).name || '')
  )
  if (err) {
    ctx.body = new ResModel(null, err, 'error')
    return
  }
  ctx.body = new ResModel(true, '更新成功')
})

router.post('/catalog-defaults/:kind/:id/delete', async (ctx: HttpContext) => {
  if (!(await requireAdmin(ctx))) return
  const [err] = await deleteCatalogDefault(String(ctx.params.kind || ''), String(ctx.params.id || ''))
  if (err) {
    ctx.body = new ResModel(null, err, 'error')
    return
  }
  ctx.body = new ResModel(true, '删除成功')
})

export default router
