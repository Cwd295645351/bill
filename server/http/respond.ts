import type { Context } from 'koa'
import type { Outcome } from './outcome'
import { ResModel } from './res-model'

/** 把服务返回值写成现有的 retCode / message / data */
export function respond(ctx: Context, outcome: Outcome, successMessage = '操作成功') {
  if (outcome.ok) {
    ctx.body = new ResModel(outcome.data, successMessage)
    return
  }
  ctx.body = new ResModel(null, outcome.message, 'error')
}
