/**
 * 登录态以 JWT 为准，覆盖客户端传入的 userid，避免持有令牌后伪造身份。
 * 业务路由仍读取 ctx.header.userid，因此这里集中改写即可。
 */
const applyJwtUser = (ctx) => {
  const userId = ctx.state && ctx.state.user && ctx.state.user.userId
  if (userId) ctx.header.userid = String(userId)
}

module.exports = { applyJwtUser }
