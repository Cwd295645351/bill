import koaRouter from 'koa-router'
import { ResModel } from '../../model/resModel'
import { getLoginConfig, updateEncryptionKey, login, createJwt } from './controller'

const router = koaRouter({ prefix: '/api/common' })

// 登录
router.post('/login', async (ctx, next) => {
  const character_reg = /^\w{3,20}/ // 账号、密码校验规则
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
  if (res) {
    // jwt生成token
    const { accessToken, refreshToken, EXPIRES_TIME } = createJwt({ userId: res._id })
    ctx.session.userId = res._id
    ctx.session.refreshToken = refreshToken
    const retData = {
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiresIn: EXPIRES_TIME,
      userInfo: res
    }
    ctx.body = new ResModel(retData, '登录成功')
  } else ctx.body = new ResModel(null, err, 'error')
})

// 刷新token
router.post('/refreshToken', async (ctx, next) => {
  const { refreshToken } = ctx.request.body
  console.log(refreshToken)
  if (refreshToken && ctx.session.refreshToken === refreshToken) {
    // 当前用户已登录，刷新token
    // jwt生成token
    const { accessToken, refreshToken, EXPIRES_TIME } = createJwt({ userId: ctx.session.userId })
    ctx.session.refreshToken = refreshToken
    const retData = {
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiresIn: EXPIRES_TIME,
      userId: ctx.session.userId
    }

    ctx.body = new ResModel(retData, '刷新成功')
  } else {
    ctx.body = new ResModel(null, '无效参数refreshToken', 'error')
  }
})

// 获取登录配置
router.get('/getLoginConfig', async (ctx, next) => {
  const [err, res] = await getLoginConfig()
  if (res) ctx.body = new ResModel({ publicKey: res.publicKey }, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 生成密钥
router.post('/createEncryption', async (ctx, next) => {
  const MANAGER = { username: 'admin', password: '123456' } // 管理员账号
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
