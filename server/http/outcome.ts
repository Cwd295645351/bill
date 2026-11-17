/** 服务返回值：成功携带数据，失败携带中文说明。服务不得写响应体。 */
export type Outcome<T = unknown> = { ok: true; data: T } | { ok: false; message: string }

export function ok<T>(data: T): Outcome<T> {
  return { ok: true, data }
}

export function fail(message: string): Outcome<never> {
  return { ok: false, message }
}

/** 把现有的 [错误说明, 数据] 转成服务返回值 */
export function fromTuple<T>(tuple: [string | null | undefined, T]): Outcome<T> {
  const [message, data] = tuple
  if (message) return fail(message)
  return ok(data)
}
