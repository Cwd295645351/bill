const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true })
const { loadSecrets } = require('./config/secrets')
try {
  loadSecrets()
  require('./config/db')
} catch (err) {
  console.error(err.message)
  process.exit(1)
}

const Koa = require('koa')
const json = require('koa-json')
const onerror = require('koa-onerror')
const logger = require('koa-logger')

// 第三方依赖
const koaBody = require('koa-body') // 接口数据处理
const fs = require('fs')
const morgan = require('koa-morgan') // 日志处理
const session = require('koa-generic-session') // session
const cors = require('koa2-cors') // 跨域处理
const koajwt = require('koa-jwt') // jwt权限管理

const { store: redisSessionStore } = require('./utils/redis')
const { applyJwtUser } = require('./utils/jwtUser')
const { connectDB } = require('./database/index')

const VERSION = require('./config/version')

// 路由
const common = require('./routes/common/index')
const bill = require('./routes/bill/index')
const transaction = require('./routes/transaction/index')
const budget = require('./routes/budget/index')
const overview = require('./routes/overview/index')
const plan = require('./routes/plan/index')
const asset = require('./routes/asset/index')
const billtype = require('./routes/billtype/index')
const ai = require('./routes/ai/index')

const app = new Koa()

// error handler
onerror(app)

// 初始化数据库连接（失败则退出，避免服务在无数据库情况下运行）
connectDB().catch((err) => {
  console.error(err)
  process.exit(1)
})

// middlewares
app.use(json())
app.use(logger())

// logger
app.use(async (ctx, next) => {
  const start = new Date()
  await next()
  const ms = new Date() - start
  console.log(`${ctx.method} ${ctx.url} - ${ms}ms`)
})

// 配置日志
const ENV = process.env.NODE_ENV
if (ENV != 'production') {
  // 开发环境 / 测试环境
  app.use(
    morgan('dev', {
      stream: process.stdout
    })
  )
} else {
  // 线上环境
  const logFileName = path.join(__dirname, 'logs', 'access.log')
  const writeStream = fs.createWriteStream(logFileName, {
    flags: 'a'
  })
  app.use(
    morgan('combined', {
      stream: writeStream
    })
  )
}

// 配置session和cookie
app.keys = ['fasgag@!65fa']
app.use(
  session({
    // 配置 cookie
    cookie: {
      path: '/',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 过期时间24小时
    },
    store: redisSessionStore
  })
)

// 处理跨域请求
app.use(
  cors({
    origin: function (ctx) {
      return '*' //只允许所有域名的请求
    },
    maxAge: 5, //指定本次预检请求的有效期，单位为秒。
    credentials: true, //是否允许发送Cookie
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], //设置所允许的HTTP请求方法'
    allowHeaders: ['Content-Type', 'Authorization', 'Accept', 'userId', 'nickName'], //设置服务器支持的所有头信息字段
    exposeHeaders: ['WWW-Authenticate', 'Server-Authorization'] //设置获取其他自定义字段
  })
)

// 错误处理
app.use((ctx, next) => {
  return next().catch((err) => {
    if (err.status === 401) {
      ctx.headers['Content-Type'] = 'application/json'
      ctx.status = 401
      ctx.body = {
        retCode: 401,
        message: '接口鉴权失败，请重新登录'
      }
    } else {
      ctx.status = 500
      ctx.body = {
        data: err.message,
        message: '系统异常,请稍后再试'
      }
    }
  })
})

// jwt验证
app.use(
  koajwt({
    secret: loadSecrets().jwtSecret
  }).unless({
    path: [
      /\/api\/v1\/common\/login$/,
      /\/api\/v1\/common\/logout/,
      /\/api\/v1\/common\/login_config/,
      /\/api\/v1\/common\/register/,
      /\/api\/v1\/common\/wxLogin$/,
      /\/api\/v1\/common\/wxBind$/,
      // 照片查看地址靠签名放行，图片组件无法携带登录头
      /\/api\/v1\/transaction\/image\/file/
    ]
  })
)

// 以 JWT 内的 userId 覆盖请求头，阻止伪造 userid 访问他人账本
app.use(async (ctx, next) => {
  applyJwtUser(ctx)
  await next()
})

// 单张照片上限 10MB；超过时由上传接口返回「单张照片不能超过 10MB」
app.use(
  koaBody({
    multipart: true,
    formidable: {
      maxFileSize: 10485760
    },
    onError: (err, ctx) => {
      const msg = (err && err.message) || ''
      if (/maxFileSize|max file size|limit/i.test(msg)) {
        ctx.status = 200
        ctx.body = {
          retCode: 1,
          message: '单张照片不能超过 10MB',
          data: null
        }
        return
      }
      throw err
    }
  })
)

// routes
app.use(common.routes(), common.allowedMethods())
app.use(bill.routes(), bill.allowedMethods())
app.use(transaction.routes(), transaction.allowedMethods())
app.use(budget.routes(), budget.allowedMethods())
app.use(overview.routes(), budget.allowedMethods())
app.use(plan.routes(), plan.allowedMethods())
app.use(asset.routes(), asset.allowedMethods())
app.use(billtype.routes(), billtype.allowedMethods())
app.use(ai.routes(), ai.allowedMethods())

// error-handling
app.on('error', (err, ctx) => {
  console.error('server error', err, ctx)
})

module.exports = app
