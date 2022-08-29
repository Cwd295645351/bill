import Koa from 'koa'
import json from 'koa-json'
import onerror from 'koa-onerror'
import logger from 'koa-logger'
import koaStatic from 'koa-static'

// 第三方依赖
import koaBody from 'koa-body' // 接口数据处理
import path from 'path'
import fs from 'fs'
import morgan from 'koa-morgan' // 日志处理
import session from 'koa-generic-session' // session
import redisStore from 'koa-redis' // redis
import cors from 'koa2-cors' // 跨域处理
import koajwt from 'koa-jwt' // jwt权限管理

import CONF from './config/db'

// 路由
import common from './routes/common/index'
import bill from './routes/bill/index'

const app = new Koa()

// error handler
onerror(app)

// middlewares
app.use(json())
app.use(logger())
app.use(koaStatic(__dirname + '/public'))

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
			path: "/",
			httpOnly: true,
			maxAge:  24 * 60 * 60 * 1000 // 过期时间24小时
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
    allowHeaders: ['Content-Type', 'Authorization', 'Accept'], //设置服务器支持的所有头信息字段
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
      throw err
    }
  })
})

// jwt验证
const SECRET_KEY = 'admin_jwt_token'
app.use(
  koajwt({
    secret: SECRET_KEY
  }).unless({
    path: [/\/api\/common\/login/, /\api\/common\/getLoginConfig/]
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
        const fileFormat = file.name.split('.')
        let savePath = `${Date.now()}.${fileFormat[fileFormat.length - 1]}`
        file.path = `public/upload/${savePath}`
      }
    }
  })
)

// routes
app.use(common.routes(), common.allowedMethods())
app.use(bill.routes(), bill.allowedMethods())

// error-handling
app.on('error', (err, ctx) => {
  console.error('server error', err, ctx)
})

export default app
