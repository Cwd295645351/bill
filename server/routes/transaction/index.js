import koaRouter from 'koa-router'
import * as Transaction from './controller'
import { ResModel } from '../../model/resModel'
import { xssData } from '../../utils/xss'
import dayjs from 'dayjs'

const router = koaRouter({ prefix: '/api/transaction' })

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
    data.beginDate = new Date(beginDate)
  }
  if (endDate) {
    if (!endDate.match(dateReg)) {
      ctx.body = new ErrorModel(null, '结束时间不规范', 'error')
      return
    }
    data.endDate = new Date(endDate)
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

  const [err, res] = await Transaction.getList(data)
  if (res) ctx.body = new ResModel(res, '查找成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 新增交易
router.post('/add', async (ctx, next) => {
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
router.post('/edit', async (ctx, next) => {
  const data = ctx.request.body
  const userId = ctx.header.userid
  data.userId = userId
  xssData(data)
  const { date, money, type, id, billId } = data
  if (!id) ctx.body = new ResModel(null, 'id不能为空', 'error')
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
router.post('/delete', async (ctx, next) => {
  const data = ctx.request.body
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
    console.log(params)
    const [err, res] = await Transaction.getCurrentMonthCost(params, userId)
    if (res) ctx.body = new ResModel(res, '查找成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})

export default router
