import koaRouter from 'koa-router'
import { decrypt } from '../../utils/cryp'
import { ResModel } from '../../model/resModel'

import { getLoginConfig, updateEncryptionKey, login } from './controller'

const router = koaRouter({ prefix: '/api/common' })

const MANAGER = { username: 'admin', password: '123456' }

const character_reg = /^\w{3,20}/

// 登录
router.post('/login', async (ctx, next) => {
//   decrypt('NtNw6cfOgYazY6ioKlDhpPLzsYN2H6YhB0dEgdo8SeS5rYTbMmzOUkLv9dscHzpBQ9bGf5vTdxRx+q6Bz0JxIw==')
  const data = ctx.request.body
  const username = data.username
  const password = data.password
  if (username === null || username === undefined || !character_reg.test(username)) {
    ctx.body = new ResModel(null, '用户名不符合规范', 'error')
    return
  }
  if (password === null || password === undefined || !character_reg.test(password)) {
    ctx.body = new ResModel(null, '密码不符合规范', 'error')
    return
  }
  const [err, res] = await login(username, password)
  if (res) ctx.body = new ResModel(null, '登录成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 获取登录配置
router.get('/getLoginConfig', async (ctx, next) => {
  const [err, res] = await getLoginConfig()
  if (res) ctx.body = new ResModel({ publicKey: res.publicKey }, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 生成密钥
router.post('/createEncryption', async (ctx, next) => {
  const data = ctx.request.body
  if (data.username !== MANAGER.username || data.password !== MANAGER.password) {
    ctx.body = new ResModel(null, '非管理员没有权限生成密钥', 'error')
  } else {
    const [err, res] = await updateEncryptionKey()
    if (res) ctx.body = new ResModel(null, '更新密钥成功')
    else ctx.body = new ResModel(null, err, 'error')
  }
})
export default router
