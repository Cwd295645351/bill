const koaRouter = require('koa-router')
const { ResModel } = require('../../model/resModel')
const { xssData } = require('../../utils/xss')
const dayjs = require('dayjs')
const Transaction = require('./controller')
const VERSION = require('../../config/version')

const router = koaRouter({ prefix: `/api/${VERSION}/transaction` })

// 交易明细(可根据周/月/年进行查询)
router.get('/list', async (ctx, next) => {
  const data = ctx.query
  const { beginDate, endDate, pageIndex, pageSize, type, billId } = data
  const dateReg = /^\d{4}-\d{2}-\d{2}$/gi
  if (!billId) {
    ctx.body = new ResModel(null, '账本id不能为空', 'error')
    return
  }
  if (beginDate) {
    if (!beginDate.match(dateReg)) {
      ctx.body = new ResModel(null, '开始时间不规范', 'error')
      return
    }
    data.beginDate = new Date(beginDate + ' 00:00:00')
  }
  if (endDate) {
    if (!endDate.match(dateReg)) {
      ctx.body = new ErrorModel(null, '结束时间不规范', 'error')
      return
    }
    data.endDate = new Date(endDate + ' 23:59:59')
  }
  // 页码小于1的统一按第一页开始，前端页码从1开始
  data.pageIndex = pageIndex < 1 ? 0 : pageIndex - 1
  // 每页条数最少10条
  if (pageSize < 10) {
    data.pageSize = 10
  }
  // 交易类型非收入（2）时，一律处理为支出（1）
  if (type != 2) {
    data.type = 1
  }
  if (!data.rangeMoney) data.rangeMoney = 0

  const [err, res] = await Transaction.getList(data)
  if (res) ctx.body = new ResModel(res, '查找成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 新增交易
router.post('/', async (ctx, next) => {
  const data = ctx.request.body
  const userId = ctx.header.userid
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

// 编辑交易
router.put('/', async (ctx, next) => {
  const data = ctx.request.body
  const userId = ctx.header.userid
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
router.delete('/', async (ctx, next) => {
  const data = ctx.request.query
  xssData(data)
  const { id } = data
  if (!id) ctx.body = new ResModel(null, 'id不能为空', 'error')
  else {
    const [err, res] = await Transaction.deleteTransaction(data)
    if (res) ctx.body = new ResModel(null, '删除成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

// 查询本月收支概况
router.get('/currentMonthCost', async (ctx, next) => {
  const userId = ctx.header.userid
  const billId = ctx.query.billId
  const currentDate = new Date()
  const beginDate = dayjs(currentDate).startOf('month').toDate()
  if (!billId) ctx.body = new ResModel(null, '账本id不能为空', 'error')
  else if (!userId) ctx.body = new ResModel(null, 'userId不能为空', 'error')
  else {
    const params = {
      beginDate: beginDate,
      endDate: currentDate,
      billId: billId,
      reimbursement: 0
    }
    const [err, res] = await Transaction.getCurrentMonthCost(params, userId)
    if (res) ctx.body = new ResModel(res, '查找成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

// 导出交易明细
router.post('/export', async (ctx, next) => {
  const data = ctx.request.body
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
router.post('/const', async (ctx, next) => {
  const file = ctx.request.files.file // 获取上传文件
  const billId = ctx.request.body.billId
  const userId = ctx.header.userid

  const filePath = file.filepath
  const [err, res] = await Transaction.getExcelObjs(filePath, billId, userId)
  if (res) ctx.body = new ResModel(res, '查找成功')
  else ctx.body = new ResModel(null, err, 'error')
})

module.exports = router
