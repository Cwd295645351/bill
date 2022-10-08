import koaRouter from 'koa-router'
import * as Transaction from './controller'
import { ResModel } from '../../model/resModel'

const router = koaRouter({ prefix: '/api/transaction' })
const dateReg = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/gi

// 交易明细(可根据周/月/年进行查询)
router.get('/list', async (ctx, next) => {
  const data = ctx.request.body
  const { beginDate, endDate, pageIndex, pageSize, type } = data
  if (beginDate != '' && beginDate != undefined) {
    if (dateReg.test(beginDate) == false) {
      ctx.body = new ResModel(null, '开始时间不规范', 'error')
      return
    }
    data.beginDate = new Date(beginDate)
  }
  if (endDate != '' && endDate != undefined) {
    if (dateReg.test(endDate) == false) {
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
  if (type !== 2) {
    data.type = 1
  }

  const [err, res] = await Transaction.getList(data)
  if (res) ctx.body = new ResModel(null, '查找成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 新增交易
router.post('/add', async (ctx, next) => {
  const data = ctx.request.body
  const userId = ctx.header.userid
  const { date, money, type, billId } = data
  data.userId = userId
  xssData(data)
  if (!billId) ctx.body = new ResModel(null, '账本id不能为空', 'error')
  if (!userId) ctx.body = new ResModel(null, 'userId不能为空', 'error')
  if (!date) ctx.body = new ResModel(null, '记账时间不能为空', 'error')
  if (!money) ctx.body = new ResModel(null, '金额不能为空', 'error')
  if (!type) ctx.body = new ResModel(null, '类型不能为空', 'error')

  const [err, res] = await Transaction.addTransaction(data)
  if (res) ctx.body = new ResModel(null, '新增成功')
  else ctx.body = new ResModel(null, err, 'error')
  ctx.body = {
    data: '新增成功'
  }
})

// 编辑交易
router.post('/edit', async (ctx, next) => {
  ctx.body = {
    data: '编辑成功'
  }
})

// 删除交易
router.post('/delete', async (ctx, next) => {
  ctx.body = {
    data: '删除成功'
  }
})

export default router
