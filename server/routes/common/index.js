const koaRouter = require('koa-router')
const { ResModel } = require('../../model/resModel')
const { getLoginConfig, updateEncryptionKey, login, createJwt, register, wxLogin, wxBind } = require('./controller')

const VERSION = require('../../config/version')

const router = koaRouter({ prefix: `/api/${VERSION}/common` })

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
  if (password === null || password === undefined || typeof password !== 'string' || !password.length) {
    ctx.body = new ResModel(null, '密码不符合规范', 'error')
    return
  }
  const [err, res] = await login(username, password)
  if (res) {
    const userId = res.id
    const userInfo = res.toJSON()
    // jwt生成token
    const { accessToken, refreshToken, EXPIRES_TIME } = createJwt({ userId })
    ctx.session.bill_userId = userId
    ctx.session.bill_refreshToken = refreshToken
    const retData = {
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiresIn: EXPIRES_TIME,
      userInfo
    }
    ctx.body = new ResModel(retData, '登录成功')
  } else ctx.body = new ResModel(null, err, 'error')
})

/** 组装与密码登录一致的令牌响应，并写入 session 供 H5 / PC 刷新令牌 */
const writeLoginResult = (ctx, user) => {
  const userId = user.id
  const userInfo = typeof user.toJSON === 'function' ? user.toJSON() : user
  const { accessToken, refreshToken, EXPIRES_TIME } = createJwt({ userId })
  ctx.session.bill_userId = userId
  ctx.session.bill_refreshToken = refreshToken
  return {
    accessToken,
    refreshToken,
    expiresIn: EXPIRES_TIME,
    userInfo
  }
}

// 小程序静默登录
router.post('/wxLogin', async (ctx) => {
  const code = ctx.request.body && ctx.request.body.code
  if (!code || typeof code !== 'string') {
    ctx.body = new ResModel(null, 'code不能为空', 'error')
    return
  }
  const [err, res] = await wxLogin(code)
  if (!res) {
    ctx.body = new ResModel(null, err, 'error')
    return
  }
  if (res.needBind) {
    ctx.body = new ResModel({ needBind: true, bindTicket: res.bindTicket }, '需要绑定账号')
    return
  }
  ctx.body = new ResModel({ ...writeLoginResult(ctx, res.user), needBind: false }, '登录成功')
})

// 小程序首次绑定已有账号
router.post('/wxBind', async (ctx) => {
  const character_reg = /^\w{3,20}/
  const data = ctx.request.body || {}
  const { bindTicket, username, password } = data
  if (!bindTicket || typeof bindTicket !== 'string') {
    ctx.body = new ResModel(null, '绑定凭证不能为空', 'error')
    return
  }
  if (username === null || username === undefined || !character_reg.test(username)) {
    ctx.body = new ResModel(null, '用户名不符合规范', 'error')
    return
  }
  if (password === null || password === undefined || typeof password !== 'string' || !password.length) {
    ctx.body = new ResModel(null, '密码不符合规范', 'error')
    return
  }
  const [err, user] = await wxBind({ bindTicket, username, password })
  if (!user) {
    ctx.body = new ResModel(null, err, 'error')
    return
  }
  ctx.body = new ResModel({ ...writeLoginResult(ctx, user), needBind: false }, '绑定成功')
})

// 登出
router.post('/logout', async (ctx, next) => {
  if (ctx.header.userid) {
    ctx.session = null
    ctx.body = new ResModel(null, '登出成功')
  } else {
    ctx.body = new ResModel(null, '账号已登出', 'error')
  }
})

// 刷新token
router.put('/refreshToken', async (ctx, next) => {
  const { refreshToken } = ctx.request.body
  console.log(refreshToken)
  if (refreshToken && ctx.session.bill_refreshToken === refreshToken) {
    // 当前用户已登录，刷新token
    // jwt生成token
    const { accessToken, refreshToken, EXPIRES_TIME } = createJwt({ userId: ctx.header.userid })
    ctx.session.bill_refreshToken = refreshToken
    const retData = {
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiresIn: EXPIRES_TIME,
      userId: ctx.header.userid
    }

    ctx.body = new ResModel(retData, '刷新成功')
  } else {
    ctx.body = new ResModel(null, '无效参数refreshToken', 'error')
  }
})

// 注册
router.post('/register', async (ctx, next) => {
  const character_reg = /^\w{3,20}/
  const data = ctx.request.body
  const username = data.username
  const password = data.password
  const nickName = data.nickName || ''
  if (username === null || username === undefined || !character_reg.test(username)) {
    ctx.body = new ResModel(null, '用户名不符合规范', 'error')
    return
  }
  if (password === null || password === undefined || typeof password !== 'string' || !password.length) {
    ctx.body = new ResModel(null, '密码不符合规范', 'error')
    return
  }
  // 注册密码需要校验强度（明文强度校验在controller中解密后进行）
  const [err, res] = await register(username, password, nickName)
  if (res) {
    ctx.body = new ResModel(res, '注册成功')
  } else {
    ctx.body = new ResModel(null, err, 'error')
  }
})

// 获取登录配置
router.get('/login_config', async (ctx, next) => {
  const [err, res] = await getLoginConfig()
  if (res) ctx.body = new ResModel({ publicKey: res.publicKey }, '获取成功')
  else ctx.body = new ResModel(null, err, 'error')
})

// 更新密钥
router.put('/encryption', async (ctx, next) => {
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

module.exports = router
