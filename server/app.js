import Koa from 'koa'
import json from 'koa-json'
import onerror from 'koa-onerror'
import logger from 'koa-logger'
import koaStatic from 'koa-static'

import koaBody from 'koa-body'
import path from 'path'

import index from './routes/index'

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
app.use(index.routes(), index.allowedMethods())

// error-handling
app.on('error', (err, ctx) => {
  console.error('server error', err, ctx)
})

export default app
