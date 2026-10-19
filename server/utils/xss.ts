import xss from 'xss'

/**
 * 按原规则清洗字符串。对象就地遍历每个字段，返回值与入参是同一个类型。
 */
const xssData = <T>(data: T): T => {
  if (typeof data === 'string') return xss(data) as T
  if (typeof data === 'number' || typeof data === 'boolean' || data == null) return data
  if (typeof data === 'object') {
    const record = data as Record<string, unknown>
    for (const key in record) {
      record[key] = xssData(record[key])
    }
  }
  return data
}

export { xssData }
