import { asInput, queryString, readBody, type Row, type HttpContext } from '../../types/domain'
import type { Next } from 'koa'
import KoaRouter from 'koa-router'
import dayjs from 'dayjs'
import { ResModel } from '../../model/resModel'
import { xssData } from '../../utils/xss'
import * as Transaction from './controller'
import VERSION from '../../config/version'

const router = new KoaRouter({ prefix: `/api/${VERSION}/transaction` })

// 交易明细(可根据周/月/年进行查询)
router.post('/list', async (ctx: HttpContext, next: Next) => {
  const data: Row = { ...readBody(ctx) }
  xssData(data)
  const { pageIndex, pageSize, type, billId } = data
  if (!billId) {
    ctx.body = new ResModel(null, '账本id不能为空', 'error')
    return
  }
  // 页码小于1的统一按第一页开始，前端页码从1开始
  const pageIndexNum = Number(pageIndex)
  const pageSizeNum = Number(pageSize)
  data.pageIndex = !Number.isFinite(pageIndexNum) || pageIndexNum < 1 ? 0 : pageIndexNum - 1
  // 每页条数最少10条
  if (!Number.isFinite(pageSizeNum) || pageSizeNum < 10) {
    data.pageSize = 10
  }
  // 交易类型非收入（2）时，一律处理为支出（1）
  if (type != 2) {
    data.type = 1
  }
  if (!data.rangeMoney) data.rangeMoney = 0
  // 列表附加 images 时用于判断账本成员，勿与筛选条件里的 userId 混淆
  data.viewerUserId = queryString(ctx.header.userid)

  const [err, res] = await Transaction.getList(data, ctx)
  if (res) ctx.body = new ResModel(res, '查找成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 上传一张记账照片（未挂接）
router.post('/image', async (ctx: HttpContext) => {
  const userId = queryString(ctx.header.userid)
  const billId = readBody(ctx) && readBody(ctx).billId
  const file = ctx.request.files && ctx.request.files.file
  if (!userId) {
    ctx.body = new ResModel(null, 'userId不能为空', 'error')
    return
  }
  if (!billId) {
    ctx.body = new ResModel(null, '未找到账本', 'error')
    return
  }
  if (!file) {
    ctx.body = new ResModel(null, '照片没有保存成功', 'error')
    return
  }
  const [err, res] = await Transaction.uploadTransactionImage({ file, billId, userId })
  if (res) ctx.body = new ResModel(res, '上传成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 按签名打开照片（不走登录头，供小程序/电脑端图片组件直接访问）
router.get('/image/file', async (ctx: HttpContext) => {
  const { id, exp, sig } = ctx.query
  const [err, res] = await Transaction.openTransactionImage({ id, exp, sig })
  if (!res) {
    ctx.status = 403
    ctx.body = new ResModel(null, err || '无权查看', 'error')
    return
  }
  ctx.set('Content-Type', res.contentType || 'application/octet-stream')
  ctx.set('Cache-Control', 'private, max-age=600')
  ctx.body = res.buffer
})

// 新增交易
router.post('/', async (ctx: HttpContext, next: Next) => {
  const data = readBody(ctx)
  const userId = queryString(ctx.header.userid)
  data.userId = userId
  xssData(data)
  const { date, money, type, billId } = data
  if (!billId) ctx.body = new ResModel(null, '账本id不能为空', 'error')
  else if (!userId) ctx.body = new ResModel(null, 'userId不能为空', 'error')
  else if (!date) ctx.body = new ResModel(null, '记账时间不能为空', 'error')
  else if (!money) ctx.body = new ResModel(null, '金额不能为空', 'error')
  else if (!type) ctx.body = new ResModel(null, '类型不能为空', 'error')
  else {
    const [err, res] = await Transaction.addTransaction(data)
    if (res) ctx.body = new ResModel(null, '新增成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

// 批量新增交易
router.post('/batch', async (ctx: HttpContext, next: Next) => {
  const { list } = readBody(ctx)
  const userId = queryString(ctx.header.userid)
  if (!userId) {
    ctx.body = new ResModel(null, 'userId不能为空', 'error')
    return
  }
  if (!Array.isArray(list) || list.length === 0) {
    ctx.body = new ResModel(null, '批量数据不能为空', 'error')
    return
  }
  const billId = list[0].billId
  if (!billId) {
    ctx.body = new ResModel(null, '账本id不能为空', 'error')
    return
  }
  list.forEach((item) => {
    item.userId = userId
    xssData(item)
  })
  const [err, res] = await Transaction.batchAddTransaction(list)
  if (res) ctx.body = new ResModel(res, '批量新增成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 编辑交易
router.put('/', async (ctx: HttpContext, next: Next) => {
  const data = readBody(ctx)
  const userId = queryString(ctx.header.userid)
  data.userId = userId
  xssData(data)
  const { date, money, type, id, billId } = data
  if (!id) ctx.body = new ResModel(null, 'id不能为空', 'error')
  else if (!userId) ctx.body = new ResModel(null, 'userId不能为空', 'error')
  else if (!billId) ctx.body = new ResModel(null, '账本id不能为空', 'error')
  else if (!date) ctx.body = new ResModel(null, '记账时间不能为空', 'error')
  else if (!money) ctx.body = new ResModel(null, '金额不能为空', 'error')
  else if (!type) ctx.body = new ResModel(null, '类型不能为空', 'error')
  else {
    const [err, res] = await Transaction.editTransaction(data)
    if (res) ctx.body = new ResModel(null, '编辑成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

// 删除交易
router.delete('/', async (ctx: HttpContext, next: Next) => {
  const data = ctx.request.query
  xssData(data)
  const id = queryString(data.id)
  if (!id) ctx.body = new ResModel(null, 'id不能为空', 'error')
  else {
    const [err, res] = await Transaction.deleteTransaction(asInput({ ...data, operatorId: queryString(ctx.header.userid) }))
    if (res) ctx.body = new ResModel(null, '删除成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

// 查询本月收支概况
router.get('/currentMonthCost', async (ctx: HttpContext, next: Next) => {
  const userId = queryString(ctx.header.userid)
  const billId = queryString(ctx.query.billId)
  const currentDate = new Date()
  const beginDate = dayjs(currentDate).startOf('month').valueOf()
  if (!billId) ctx.body = new ResModel(null, '账本id不能为空', 'error')
  else if (!userId) ctx.body = new ResModel(null, 'userId不能为空', 'error')
  else {
    const params: Row = {
      beginDate,
      endDate: currentDate.getTime(),
      billId: billId,
      reimbursement: 0
    }
    const [err, res] = await Transaction.getCurrentMonthCost(params, userId)
    if (res) ctx.body = new ResModel(res, '查找成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

// 导出交易明细
router.post('/export', async (ctx: HttpContext, next: Next) => {
  const data = readBody(ctx)
  xssData(data)
  const { type, billId } = data
  if (!billId) ctx.body = new ResModel(null, '账本id不能为空', 'error')
  else if (!type) ctx.body = new ResModel(null, '类型不能为空', 'error')
  else {
    const buffer = await Transaction.exportData(data)
    // 设置content-type请求头
    ctx.set('Content-Type', 'application/vnd.openxmlformats')
    // 将buffer返回给前端
    ctx.body = buffer
  }
})

// 导入交易明细
router.post('/const', async (ctx: HttpContext, next: Next) => {
  const file = ctx.request.files && ctx.request.files.file // 获取上传文件
  const billId = readBody(ctx).billId || ''
  const userId = queryString(ctx.header.userid) || ''

  const filePath = file && file.filepath
  if (!filePath) {
    ctx.body = new ResModel(null, '导入失败', 'error')
    return
  }
  const [err, res] = await Transaction.getExcelObjs(filePath, billId, userId)
  if (res) ctx.body = new ResModel(res, '查找成功')
  else ctx.body = new ResModel(null, err, 'error')
})

export default router
