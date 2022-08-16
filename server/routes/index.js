import koaRouter from 'koa-router'
const router = koaRouter()

router.get('/string', async (ctx, next) => {
  ctx.body = 'koa2 string'
})

router.post('/json', async (ctx, next) => {
  const data = ctx.request.body
  ctx.body = {
    data: data,
    title: 'koa2 json'
  }
})

export default router
