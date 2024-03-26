const Koa = require('koa')
const json = require('koa-json')
const onerror = require('koa-onerror')
const logger = require('koa-logger')
const koaStatic = require('koa-static')

// 第三方依赖
const koaBody = require('koa-body') // 接口数据处理
const path = require('path')
const fs = require('fs')
const morgan = require('koa-morgan') // 日志处理
const session = require('koa-generic-session') // session
const redisStore = require('koa-redis') // redis
const cors = require('koa2-cors') // 跨域处理
const koajwt = require('koa-jwt') // jwt权限管理

const CONF = require('./config/db')

const VERSION = require('./config/version')

// 路由
const common = require('./routes/common/index')
const bill = require('./routes/bill/index')
const transaction = require('./routes/transaction/index')
const budget = require('./routes/budget/index')
const overview = require('./routes/overview/index')
const plan = require('./routes/plan/index')
const pages = require('./routes/pages/index')

const app = new Koa()

// error handler
onerror(app)

// middlewares
app.use(json())
app.use(logger())
app.use(koaStatic(__dirname + '/public/pc'))
app.use(koaStatic(__dirname + '/public/mobile'))

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
    store: redisStore({
      all: `${CONF.REDIS_CONF.host}:${CONF.REDIS_CONF.port}` // redis的地址
    })
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
const SECRET_KEY = 'admin_jwt_token'
app.use(
  koajwt({
    secret: SECRET_KEY
  }).unless({
    path: [/\/api\/v1\/common\/login/, /\/api\/v1\/common\/logout/, /\api\/v1\/common\/login_config/, /\/pc/, /\/mobile/]
  })
)

// 文件上传处理
app.use(
  koaBody({
    multipart: true,
    formidable: {
      maxFileSize: 200 * 1024 * 1024, // 设置上传文件大小最大限制，默认2M
      keepExtensions: true,
      maxFields: 2 * 1024 * 1024, // 文件上传大小
      uploadDir: path.join(__dirname, 'public/upload/'),
      onFileBegin: (name, file) => {
        // 文件存储之前对文件进行重命名处理
        const fileFormat = file.originalFilename.split('.')
        let savePath = `${Date.now()}.${fileFormat[fileFormat.length - 1]}`
        file.path = `public/upload/${savePath}`
      }
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
app.use(pages.routes(), pages.allowedMethods())

// error-handling
app.on('error', (err, ctx) => {
  console.error('server error', err, ctx)
})

module.exports = app
