import './config/loadEnv'
import path from 'path'
import fs from 'fs'
import Koa from 'koa'
import json from 'koa-json'
import onerror from 'koa-onerror'
import logger from 'koa-logger'
import koaBody from 'koa-body'
import morgan from 'koa-morgan'
import session from 'koa-generic-session'
import cors from 'koa2-cors'
import koajwt from 'koa-jwt'
import { createRequire } from 'module'
import type { Context, Next } from 'koa'
import type Router from 'koa-router'
import { loadSecrets } from './config/secrets'
import { resolveServerRoot } from './config/serverRoot'

/**
 * 本地模块放到环境变量就绪之后再加载。
 * 静态 import 会在读 .env 之前执行，数据库配置会误报缺少口令。
 */
const nodeRequire = createRequire(__filename)

const loadDefault = <T>(id: string): T => {
  const loaded = nodeRequire(id) as T & { default?: T }
  return loaded.default ?? loaded
}

try {
  loadSecrets()
  nodeRequire('./config/db')
} catch (err: unknown) {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
}

const { store: redisSessionStore } = nodeRequire('./utils/redis') as typeof import('./utils/redis')
const { applyJwtUser } = nodeRequire('./utils/jwtUser') as typeof import('./utils/jwtUser')
const { connectDB } = nodeRequire('./database/index') as typeof import('./database/index')
const common = loadDefault<Router>('./routes/common/index')
const bill = loadDefault<Router>('./routes/bill/index')
const transaction = loadDefault<Router>('./routes/transaction/index')
const budget = loadDefault<Router>('./routes/budget/index')
const overview = loadDefault<Router>('./routes/overview/index')
const plan = loadDefault<Router>('./routes/plan/index')
const asset = loadDefault<Router>('./routes/asset/index')
const billtype = loadDefault<Router>('./routes/billtype/index')
const ai = loadDefault<Router>('./routes/ai/index')

const app = new Koa()
const serverRoot = resolveServerRoot(__dirname)

// error handler
onerror(app)

// 初始化数据库连接（失败则退出，避免服务在无数据库情况下运行）
connectDB().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})

// middlewares
app.use(json())
app.use(logger())

// logger
app.use(async (ctx: Context, next: Next) => {
  const start = new Date()
  await next()
  const ms = Number(new Date()) - Number(start)
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
  const logFileName = path.join(serverRoot, 'logs', 'access.log')
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
    origin: function (ctx: Context) {
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
app.use((ctx: Context, next: Next) => {
  return next().catch((err: { status?: number; message?: string }) => {
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
app.use(async (ctx: Context, next: Next) => {
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
    onError: (err: { message?: string }, ctx: Context) => {
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

// 原先把 routes() 和 allowedMethods() 一起传给 use，Koa 只注册第一个
const mount = (router: Router, allowed = router.allowedMethods()) => {
  app.use(router.routes())
  void allowed
}

mount(common)
mount(bill)
mount(transaction)
mount(budget)
mount(overview, budget.allowedMethods())
mount(plan)
mount(asset)
mount(billtype)
mount(ai)

// error-handling
app.on('error', (err: Error, ctx: Context) => {
  console.error('server error', err, ctx)
})

export default app
