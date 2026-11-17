/** 只读取登录凭证中的用户编号，不读请求头 */
export function currentUserId(ctx: { state?: { user?: { userId?: string } } }): string {
  const userId = ctx.state && ctx.state.user && ctx.state.user.userId
  return userId ? String(userId) : ''
}
