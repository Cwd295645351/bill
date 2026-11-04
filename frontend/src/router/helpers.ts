/** PC 路由辅助：鉴权判断、安全回跳、账本页路径 */

export type BillTab = 'record' | 'overview' | 'budget' | 'plan' | 'asset'

const BILL_TABS: BillTab[] = ['record', 'overview', 'budget', 'plan', 'asset']

/** 是否已登录（以 accessToken 为准） */
export function isAuthenticated(userInfo: { accessToken?: string } | null | undefined): boolean {
  return Boolean(userInfo && userInfo.accessToken)
}

/**
 * 仅允许站内相对路径回跳，拒绝 //、协议 URL、空值。
 * Vue Router fullPath 不含 base（如 /pc），此处保持原样。
 */
export function sanitizeRedirect(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (!value.startsWith('/')) return null
  if (value.startsWith('//')) return null
  if (value.includes('://')) return null
  if (value === '/login' || value.startsWith('/login?')) return null
  return value
}

/** 账本内页路径 */
export function billTabPath(billId: string, tab: BillTab): string {
  return `/layout/bill/${encodeURIComponent(billId)}/${tab}`
}

export function isBillTab(value: string): value is BillTab {
  return (BILL_TABS as string[]).includes(value)
}
