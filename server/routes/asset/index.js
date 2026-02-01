const koaRouter = require('koa-router')
const { ResModel } = require('../../model/resModel')
const { xssData } = require('../../utils/xss')
const ASSET = require('./controller')
const VERSION = require('../../config/version')

const router = koaRouter({ prefix: `/api/${VERSION}/asset` })

// --- 成员管理 ---
router.get('/members', async (ctx) => {
  const billId = ctx.query.billId
  const [err, res] = await ASSET.getMemberList({ billId })
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.post('/member', async (ctx) => {
  const data = ctx.request.body
  xssData(data)
  const [err, res] = await ASSET.addMember(data)
  if (res) ctx.body = new ResModel(res, '创建成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.put('/member', async (ctx) => {
  const data = ctx.request.body
  xssData(data)
  const [err, res] = await ASSET.editMember(data)
  if (res) ctx.body = new ResModel(res, '编辑成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.delete('/member', async (ctx) => {
  const { id } = ctx.query
  const [err, res] = await ASSET.delMember({ id })
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
  const [err, res] = await ASSET.addAssetRecord(data)
  if (res) ctx.body = new ResModel(res, '盘点成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.get('/records', async (ctx) => {
  const params = ctx.query
  const [err, res] = await ASSET.getAssetRecords(params)
  if (res) ctx.body = new ResModel(res, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.put('/record', async (ctx) => {
  const data = ctx.request.body
  xssData(data)
  const [err, res] = await ASSET.editAssetRecord(data)
  if (res) ctx.body = new ResModel(res, '编辑成功')
  else ctx.body = new ResModel(null, err, 'error')
})

router.delete('/record', async (ctx) => {
  const { id } = ctx.query
  const [err, res] = await ASSET.delAssetRecord({ id })
  if (res) ctx.body = new ResModel(null, '删除成功')
  else ctx.body = new ResModel(null, err, 'error')
})

module.exports = router
