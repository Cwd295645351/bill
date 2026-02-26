const koaRouter = require('koa-router')
const { ResModel } = require('../../model/resModel')
const { xssData } = require('../../utils/xss')
const MEMBER = require('./memberController')
const ASSET = require('./assetController')
const RECORD = require('./recordController')
const STATISTICS = require('./statisticsController')
const VERSION = require('../../config/version')

const router = koaRouter({ prefix: `/api/${VERSION}/asset` })

// --- 成员管理 ---
router.get('/members', async (ctx) => {
  const billId = ctx.query.billId
  const [err, res] = await MEMBER.getMemberList({ billId })
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.post('/member', async (ctx) => {
  const data = ctx.request.body
  xssData(data)
  const [err, res] = await MEMBER.addMember(data)
  if (res) ctx.body = new ResModel(res, '创建成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.put('/member', async (ctx) => {
  const data = ctx.request.body
  xssData(data)
  const [err, res] = await MEMBER.editMember(data)
  if (res) ctx.body = new ResModel(res, '编辑成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.delete('/member', async (ctx) => {
  const { id } = ctx.query
  const [err, res] = await MEMBER.delMember({ id })
  if (res) ctx.body = new ResModel(null, '删除成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// --- 资产管理 ---
router.get('/list', async (ctx) => {
  const params = ctx.query
  const [err, res] = await ASSET.getAssetList(params)
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 资产列表（含变化统计与分类汇总，供总览页面使用）
router.get('/list-stats', async (ctx) => {
  const { billId, memberId } = ctx.query
  const [err, res] = await ASSET.getAssetListWithStats({ billId, memberId })
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.post('/', async (ctx) => {
  const data = ctx.request.body
  xssData(data)
  const [err, res] = await ASSET.addAsset(data)
  if (res) ctx.body = new ResModel(res, '创建成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.put('/', async (ctx) => {
  const data = ctx.request.body
  xssData(data)
  const [err, res] = await ASSET.editAsset(data)
  if (res) ctx.body = new ResModel(res, '编辑成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.delete('/', async (ctx) => {
  const { id } = ctx.query
  const [err, res] = await ASSET.delAsset({ id })
  if (res) ctx.body = new ResModel(null, '删除成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// --- 资产流水/盘点 ---
router.post('/record', async (ctx) => {
  const data = ctx.request.body
  xssData(data)
  const [err, res] = await RECORD.addAssetRecord(data)
  if (res) ctx.body = new ResModel(res, '盘点成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.get('/records', async (ctx) => {
  const params = ctx.query
  const [err, res] = await RECORD.getAssetRecords(params)
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.put('/record', async (ctx) => {
  const data = ctx.request.body
  xssData(data)
  const [err, res] = await RECORD.editAssetRecord(data)
  if (res) ctx.body = new ResModel(res, '编辑成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.delete('/record', async (ctx) => {
  const { id } = ctx.query
  const [err, res] = await RECORD.delAssetRecord({ id })
  if (res) ctx.body = new ResModel(null, '删除成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// --- 统计分析 ---
router.get('/overview', async (ctx) => {
  const { billId, memberId } = ctx.query
  const [err, res] = await STATISTICS.getAssetOverview({ billId, memberId })
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.get('/sankey', async (ctx) => {
  const { billId, memberId } = ctx.query
  const [err, res] = await STATISTICS.getSankeyData({ billId, memberId })
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.get('/four-money', async (ctx) => {
  const { billId, memberId } = ctx.query
  const [err, res] = await STATISTICS.getFourMoneySummary({ billId, memberId })
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.get('/monthly-report', async (ctx) => {
  const { billId, year, memberId } = ctx.query
  const [err, res] = await STATISTICS.getMonthlyReport({ billId, year: year || new Date().getFullYear(), memberId })
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

module.exports = router
