import koaRouter from 'koa-router'
import { createPublicKey, decrypt } from '../utils/cryp'

const router = koaRouter({ prefix: '/api/common' })

router.post('/login', async (ctx, next) => {
  decrypt('NtNw6cfOgYazY6ioKlDhpPLzsYN2H6YhB0dEgdo8SeS5rYTbMmzOUkLv9dscHzpBQ9bGf5vTdxRx+q6Bz0JxIw==')
  const data = ctx.request.body
  ctx.body = {
    data: data,
    title: 'koa2 json'
  }
})

router.get('/getLoginConfig', async (ctx, next) => {
  const { publicKey } = createPublicKey()
  ctx.body = {
    publicKey
  }
})
export default router
