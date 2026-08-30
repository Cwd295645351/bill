const koaRouter = require('koa-router')
const { ResModel } = require('../../model/resModel')
const { parseBatch } = require('./controller')
const VERSION = require('../../config/version')

const router = koaRouter({ prefix: `/api/${VERSION}/ai` })

const MAX_TEXT_LENGTH = 20000
const MAX_LINE_COUNT = 100
const MAX_LINE_LENGTH = 500
const MAX_COST_TYPE_COUNT = 200
const MAX_COST_TYPE_LENGTH = 100

/** 批量解析支出记录 */
router.post('/parse-batch', async (ctx) => {
  const { text, costTypes } = ctx.request.body || {}

  if (typeof text !== 'string' || !text.trim()) {
    ctx.body = new ResModel(null, '解析内容不能为空', 'error')
    return
  }
  if (text.length > MAX_TEXT_LENGTH) {
    ctx.body = new ResModel(null, `解析内容不能超过 ${MAX_TEXT_LENGTH} 个字符`, 'error')
    return
  }
  if (!Array.isArray(costTypes) || costTypes.length === 0) {
    ctx.body = new ResModel(null, '支出类型不能为空', 'error')
    return
  }
  if (costTypes.length > MAX_COST_TYPE_COUNT) {
    ctx.body = new ResModel(null, `支出类型不能超过 ${MAX_COST_TYPE_COUNT} 项`, 'error')
    return
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length > MAX_LINE_COUNT) {
    ctx.body = new ResModel(null, `每次最多解析 ${MAX_LINE_COUNT} 条记录`, 'error')
    return
  }
  if (lines.some((line) => line.length > MAX_LINE_LENGTH)) {
    ctx.body = new ResModel(null, `每条记录不能超过 ${MAX_LINE_LENGTH} 个字符`, 'error')
    return
  }

  const normalizedCostTypes = costTypes
    .filter((item) => item && !item.hidden && item.id !== undefined && typeof item.name === 'string')
    .map((item) => ({ id: String(item.id), name: item.name.trim() }))
    .filter((item) => item.name)
  if (normalizedCostTypes.length === 0) {
    ctx.body = new ResModel(null, '没有可用的支出类型', 'error')
    return
  }
  if (normalizedCostTypes.some((item) => String(item.id).length > MAX_COST_TYPE_LENGTH || item.name.length > MAX_COST_TYPE_LENGTH)) {
    ctx.body = new ResModel(null, `支出类型 ID 和名称不能超过 ${MAX_COST_TYPE_LENGTH} 个字符`, 'error')
    return
  }

  const [err, result] = await parseBatch(lines, normalizedCostTypes)
  if (result) {
    ctx.body = new ResModel(result, '批量解析成功')
  } else {
    ctx.body = new ResModel(null, err, 'error')
  }
})

module.exports = router
