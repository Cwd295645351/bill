/** 与小程序 applyAmountKey 一致的金额键盘输入规则 */
export function applyAmountKey(current: string, key: string): string {
  let next = current || ''
  if (key === 'del') return next.slice(0, -1)
  if (key === '.') {
    if (next.indexOf('.') >= 0) return next
    return (next || '0') + '.'
  }
  if (next === '0') next = key
  else next += key
  const dot = next.indexOf('.')
  if (dot >= 0 && next.length - dot - 1 > 2) return current || ''
  if (next.replace('.', '').length > 10) return current || ''
  return next
}
