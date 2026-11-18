/** 东八区自然日 yyyy-MM-dd */
const shanghaiDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

/** 近 N 个东八区自然日的起止（含今天），返回 UTC Date 与日键列表（旧→新） */
const shanghaiRange = (days: 7 | 30) => {
  const keys: string[] = []
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  const todayKey = shanghaiDateKey()
  // 从今天往前推 days-1 天
  const probe = new Date()
  for (let i = 0; i < days + 2; i++) {
    const key = formatter
      .formatToParts(new Date(probe.getTime() - i * 24 * 3600 * 1000))
      .reduce((acc, p) => {
        if (p.type !== 'literal') acc[p.type] = p.value
        return acc
      }, {} as Record<string, string>)
    const dateKey = `${key.year}-${key.month}-${key.day}`
    if (!keys.includes(dateKey)) keys.push(dateKey)
    if (keys.length >= days) break
  }
  keys.reverse()
  // 窗口起点：第一天东八区 0 点对应的 UTC 近似（用该日正午反向不够稳，改用固定偏移）
  const startKey = keys[0] || todayKey
  const endKey = keys[keys.length - 1] || todayKey
  const startAt = new Date(`${startKey}T00:00:00+08:00`)
  const endAt = new Date(`${endKey}T23:59:59.999+08:00`)
  return { days, keys, startAt, endAt, startKey, endKey }
}

/** 记账日毫秒 → 东八区 yyyy-MM-dd */
const shanghaiKeyFromTimestamp = (ts: number) => shanghaiDateKey(new Date(ts))

export { shanghaiDateKey, shanghaiRange, shanghaiKeyFromTimestamp }
