import { currentUserId } from '../../http/current-user'
import { ResModel } from '../../http/res-model'
import type { HttpContext } from '../../types/domain'
import { checkAdminAccess } from '../auth/service'

/** 管理路由共用鉴权；失败时写响应并返回 false */
const requireAdmin = async (ctx: HttpContext) => {
  const err = await checkAdminAccess(currentUserId(ctx))
  if (err) {
    ctx.body = new ResModel(null, err, 'error')
    return false
  }
  return true
}

export { requireAdmin }
