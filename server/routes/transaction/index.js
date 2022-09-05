import koaRouter from 'koa-router'

const router = koaRouter({ prefix: '/api/transaction' })

// 交易明细(可根据周/月/年进行查询)
router.get('/list', async (ctx, next) => {
  ctx.body = {
    data: '获取交易明细'
  }
})

// 新增交易
router.post('/add', async (ctx, next) => {
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
