/** 拼照片、头像查看地址用的协议和主机，由路由从请求里取出 */
export type ViewOrigin = { proto: string; host: string }

/** 只取协议和主机，服务层不接收整个请求 */
export function viewOriginOf(ctx: {
  request: { protocol?: string; host?: string; header: { [key: string]: unknown } }
}): ViewOrigin {
  const header = ctx.request.header
  const proto = header['x-forwarded-proto'] || ctx.request.protocol || 'https'
  const host = header['x-forwarded-host'] || ctx.request.host
  return { proto: String(proto), host: host == null ? '' : String(host) }
}
