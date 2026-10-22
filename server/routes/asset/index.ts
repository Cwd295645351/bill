import { asInput, queryString, readBody, type HttpContext } from '../../types/domain'
import KoaRouter from 'koa-router'
import { ResModel } from '../../model/resModel'
import { xssData } from '../../utils/xss'
import * as MEMBER from './memberController'
import * as ASSET from './assetController'
import * as RECORD from './recordController'
import * as STATISTICS from './statisticsController'
import * as EXCHANGE from './exchangeController'
import * as LEDGER from './ledgerController'
import * as RETIRE from './retireController'
import VERSION from '../../config/version'
import { assertBillMember, billIdOfAsset, billIdOfMember, billIdOfRecord } from './billAccess'

const router = new KoaRouter({ prefix: `/api/${VERSION}/asset` })

/** 成员校验失败时直接返回，不带出数据 */
const deny = (ctx: HttpContext, message: string) => {
  ctx.body = new ResModel(null, message, 'error')
}

const guard = async (ctx: HttpContext, billId: string | null | undefined) => {
  const message = await assertBillMember(ctx, billId)
  if (message) {
    deny(ctx, message)
    return false
  }
  return true
}

// --- 成员管理 ---
router.get('/members', async (ctx: HttpContext) => {
  const billId = queryString(ctx.query.billId)
  if (!(await guard(ctx, billId))) return
  const [err, res] = await MEMBER.getMemberList({ billId })
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.post('/member', async (ctx: HttpContext) => {
  const data = readBody(ctx)
  xssData(data)
  if (!(await guard(ctx, queryString(data.billId)))) return
  const [err, res] = await MEMBER.addMember(data)
  if (res) ctx.body = new ResModel(res, '创建成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.put('/member', async (ctx: HttpContext) => {
  const data = readBody(ctx)
  xssData(data)
  const billId = await billIdOfMember(queryString(data.id))
  if (billId && !(await guard(ctx, billId))) return
  const [err, res] = await MEMBER.editMember(data)
  if (res) ctx.body = new ResModel(res, '编辑成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.delete('/member', async (ctx: HttpContext) => {
  const id = queryString(ctx.query.id)
  const billId = await billIdOfMember(id)
  if (billId && !(await guard(ctx, billId))) return
  const [err, res] = await MEMBER.delMember({ id })
  if (res) ctx.body = new ResModel(null, '删除成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// --- 资产管理 ---
router.get('/list', async (ctx: HttpContext) => {
  const billId = queryString(ctx.query.billId)
  if (!(await guard(ctx, billId))) return
  const [err, res] = await ASSET.getAssetList(asInput(ctx.query))
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.get('/list-stats', async (ctx: HttpContext) => {
  const billId = queryString(ctx.query.billId)
  const memberId = queryString(ctx.query.memberId)
  if (!(await guard(ctx, billId))) return
  const [err, res] = await ASSET.getAssetListWithStats({ billId, memberId })
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.post('/', async (ctx: HttpContext) => {
  const data = readBody(ctx)
  xssData(data)
  if (!(await guard(ctx, queryString(data.billId)))) return
  const [err, res] = await ASSET.addAsset(data)
  if (res) ctx.body = new ResModel(res, '创建成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.put('/', async (ctx: HttpContext) => {
  const data = readBody(ctx)
  xssData(data)
  const billId = await billIdOfAsset(queryString(data.id))
  if (billId && !(await guard(ctx, billId))) return
  const [err, res] = await ASSET.editAsset(data)
  if (res) ctx.body = new ResModel(res, '编辑成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.delete('/', async (ctx: HttpContext) => {
  const id = queryString(ctx.query.id)
  const billId = await billIdOfAsset(id)
  if (billId && !(await guard(ctx, billId))) return
  const [err, res] = await ASSET.delAsset({ id })
  if (res) ctx.body = new ResModel(null, '删除成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// --- 资产流水/盘点 ---
router.post('/record', async (ctx: HttpContext) => {
  const data = readBody(ctx)
  xssData(data)
  const billId = await billIdOfAsset(queryString(data.assetId))
  if (billId && !(await guard(ctx, billId))) return
  const [err, res] = await RECORD.addAssetRecord(data)
  if (res) ctx.body = new ResModel(res, '盘点成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.get('/records', async (ctx: HttpContext) => {
  const assetId = queryString(ctx.query.assetId)
  const billId = await billIdOfAsset(assetId)
  if (billId && !(await guard(ctx, billId))) return
  const [err, res] = await RECORD.getAssetRecords(asInput(ctx.query))
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.put('/record', async (ctx: HttpContext) => {
  const data = readBody(ctx)
  xssData(data)
  const billId = await billIdOfRecord(queryString(data.id))
  if (billId && !(await guard(ctx, billId))) return
  const [err, res] = await RECORD.editAssetRecord(data)
  if (res) ctx.body = new ResModel(res, '编辑成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.delete('/record', async (ctx: HttpContext) => {
  const id = queryString(ctx.query.id)
  const billId = await billIdOfRecord(id)
  if (billId && !(await guard(ctx, billId))) return
  const [err, res] = await RECORD.delAssetRecord({ id })
  if (res) ctx.body = new ResModel(null, '删除成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// --- 统计分析 ---
router.get('/overview', async (ctx: HttpContext) => {
  const billId = queryString(ctx.query.billId)
  const memberId = queryString(ctx.query.memberId)
  const asOf = queryString(ctx.query.asOf)
  if (!(await guard(ctx, billId))) return
  const [err, res] = await STATISTICS.getAssetOverview({ billId, memberId, asOf })
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.get('/sankey', async (ctx: HttpContext) => {
  const billId = queryString(ctx.query.billId)
  const memberId = queryString(ctx.query.memberId)
  if (!(await guard(ctx, billId))) return
  const [err, res] = await STATISTICS.getSankeyData({ billId, memberId })
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.get('/four-money', async (ctx: HttpContext) => {
  const billId = queryString(ctx.query.billId)
  const memberId = queryString(ctx.query.memberId)
  if (!(await guard(ctx, billId))) return
  const [err, res] = await STATISTICS.getFourMoneySummary({ billId, memberId })
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.get('/monthly-report', async (ctx: HttpContext) => {
  const billId = queryString(ctx.query.billId)
  const year = queryString(ctx.query.year)
  const memberId = queryString(ctx.query.memberId)
  if (!(await guard(ctx, billId))) return
  const [err, res] = await STATISTICS.getMonthlyReport({ billId, year: year || new Date().getFullYear(), memberId })
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.get('/exchange-rate', async (ctx: HttpContext) => {
  const billId = queryString(ctx.query.billId)
  if (!(await guard(ctx, billId))) return
  const [err, res] = await EXCHANGE.getExchangeRate({ billId })
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.put('/exchange-rate', async (ctx: HttpContext) => {
  const data = readBody(ctx)
  xssData(data)
  if (!(await guard(ctx, queryString(data.billId)))) return
  const [err, res] = await EXCHANGE.saveExchangeRate(data)
  if (res) ctx.body = new ResModel(res, '保存成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.post('/ledger', async (ctx: HttpContext) => {
  const data = readBody(ctx)
  xssData(data)
  if (!(await guard(ctx, queryString(data.billId)))) return
  const [err, res] = await LEDGER.getLedger(data)
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.get('/retire-plan', async (ctx: HttpContext) => {
  const billId = queryString(ctx.query.billId)
  if (!(await guard(ctx, billId))) return
  const [err, res] = await RETIRE.readRetirePlan(asInput(ctx.query))
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.put('/retire-plan', async (ctx: HttpContext) => {
  const data = readBody(ctx)
  xssData(data)
  if (!(await guard(ctx, queryString(data.billId)))) return
  const [err, res] = await RETIRE.writeRetirePlan(data)
  if (res) ctx.body = new ResModel(res, '保存成功')
  else ctx.body = new ResModel(null, err, 'error')
})

export default router
