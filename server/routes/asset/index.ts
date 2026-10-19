import { asInput, queryString, readBody, type HttpContext } from '../../types/domain'
import KoaRouter from 'koa-router'
import { ResModel } from '../../model/resModel'
import { xssData } from '../../utils/xss'
import * as MEMBER from './memberController'
import * as ASSET from './assetController'
import * as RECORD from './recordController'
import * as STATISTICS from './statisticsController'
import VERSION from '../../config/version'

const router = new KoaRouter({ prefix: `/api/${VERSION}/asset` })

// --- 成员管理 ---
router.get('/members', async (ctx: HttpContext) => {
  const billId = queryString(ctx.query.billId)
  const [err, res] = await MEMBER.getMemberList({ billId })
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.post('/member', async (ctx: HttpContext) => {
  const data = readBody(ctx)
  xssData(data)
  const [err, res] = await MEMBER.addMember(data)
  if (res) ctx.body = new ResModel(res, '创建成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.put('/member', async (ctx: HttpContext) => {
  const data = readBody(ctx)
  xssData(data)
  const [err, res] = await MEMBER.editMember(data)
  if (res) ctx.body = new ResModel(res, '编辑成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.delete('/member', async (ctx: HttpContext) => {
  const id = queryString(ctx.query.id)
  const [err, res] = await MEMBER.delMember({ id })
  if (res) ctx.body = new ResModel(null, '删除成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// --- 资产管理 ---
router.get('/list', async (ctx: HttpContext) => {
  const params = ctx.query
  const [err, res] = await ASSET.getAssetList(asInput(params))
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 资产列表（含变化统计与分类汇总，供总览页面使用）
router.get('/list-stats', async (ctx: HttpContext) => {
  const billId = queryString(ctx.query.billId)
  const memberId = queryString(ctx.query.memberId)
  const [err, res] = await ASSET.getAssetListWithStats({ billId, memberId })
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.post('/', async (ctx: HttpContext) => {
  const data = readBody(ctx)
  xssData(data)
  const [err, res] = await ASSET.addAsset(data)
  if (res) ctx.body = new ResModel(res, '创建成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.put('/', async (ctx: HttpContext) => {
  const data = readBody(ctx)
  xssData(data)
  const [err, res] = await ASSET.editAsset(data)
  if (res) ctx.body = new ResModel(res, '编辑成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.delete('/', async (ctx: HttpContext) => {
  const id = queryString(ctx.query.id)
  const [err, res] = await ASSET.delAsset({ id })
  if (res) ctx.body = new ResModel(null, '删除成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// --- 资产流水/盘点 ---
router.post('/record', async (ctx: HttpContext) => {
  const data = readBody(ctx)
  xssData(data)
  const [err, res] = await RECORD.addAssetRecord(data)
  if (res) ctx.body = new ResModel(res, '盘点成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.get('/records', async (ctx: HttpContext) => {
  const params = ctx.query
  const [err, res] = await RECORD.getAssetRecords(asInput(params))
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.put('/record', async (ctx: HttpContext) => {
  const data = readBody(ctx)
  xssData(data)
  const [err, res] = await RECORD.editAssetRecord(data)
  if (res) ctx.body = new ResModel(res, '编辑成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.delete('/record', async (ctx: HttpContext) => {
  const id = queryString(ctx.query.id)
  const [err, res] = await RECORD.delAssetRecord({ id })
  if (res) ctx.body = new ResModel(null, '删除成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// --- 统计分析 ---
router.get('/overview', async (ctx: HttpContext) => {
  const billId = queryString(ctx.query.billId)
  const memberId = queryString(ctx.query.memberId)
  const [err, res] = await STATISTICS.getAssetOverview({ billId, memberId })
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.get('/sankey', async (ctx: HttpContext) => {
  const billId = queryString(ctx.query.billId)
  const memberId = queryString(ctx.query.memberId)
  const [err, res] = await STATISTICS.getSankeyData({ billId, memberId })
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.get('/four-money', async (ctx: HttpContext) => {
  const billId = queryString(ctx.query.billId)
  const memberId = queryString(ctx.query.memberId)
  const [err, res] = await STATISTICS.getFourMoneySummary({ billId, memberId })
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.get('/monthly-report', async (ctx: HttpContext) => {
  const billId = queryString(ctx.query.billId)
  const year = queryString(ctx.query.year)
  const memberId = queryString(ctx.query.memberId)
  const [err, res] = await STATISTICS.getMonthlyReport({ billId, year: year || new Date().getFullYear(), memberId })
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

export default router
