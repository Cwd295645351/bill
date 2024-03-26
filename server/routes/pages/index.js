const koaRouter = require('koa-router')
const fs = require('fs')
const path = require('path')

const router = koaRouter()

// pc 端页面
router.get('/pc', async (ctx, next) => {
  // 渲染页面
  ctx.response.type = 'html'
  const str = path.join(__dirname, '..', '..', 'public', 'pc', 'index.html')
  console.log(str)
  ctx.response.body = await fs.promises.readFile(str, 'utf8')
})

// 移动端页面
router.get('/mobile', async (ctx, next) => {
  // 渲染页面
  ctx.response.type = 'html'
  const str = path.join(__dirname, '..', '..', 'public', 'mobile', 'index.html')
  console.log(str)
  ctx.response.body = await fs.promises.readFile(str, 'utf8')
})

module.exports = router
