/** 登录态与本地偏好，不做离线记账 */

export interface SessionUser {
  accessToken: string
  refreshToken: string
  expiresIn: number
  userId: string
  nickName: string
  avatarUrl: string
  incomes: number
  expenses: number
}

export interface LoginPayload {
  accessToken: string
  refreshToken: string
  expiresIn: number
  userInfo: {
    id: string
    nickName?: string
    avatarUrl?: string
    incomes?: number
    expenses?: number
  }
}

export interface RecordPref {
  costTypeId: string
  costTypeName: string
  incomesTypeId: string
  incomesTypeName: string
  /** 上次的归属人名单，「全部」为空数组；缺省表示没有记住归属人 */
  belongUserIds?: string[]
  belongUserName: string
}

const USER_KEY = 'userInfo'
const EXPIRE_KEY = 'expiresAt'
const LOGOUT_KEY = 'manualLogout'
const LAST_BILL = 'lastBillId'
const LAST_PREF = 'lastRecordPref'
const DICT_PREFIX = 'billDict:'
const EDITING = 'editingRecord'
const BIND_TICKET = 'bindTicket'

export function getUser(): SessionUser | null {
  const user = wx.getStorageSync(USER_KEY)
  if (!user || !user.accessToken) return null
  return user as SessionUser
}

export function saveSession(payload: LoginPayload) {
  const info = payload.userInfo || ({} as LoginPayload['userInfo'])
  const user: SessionUser = {
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken || '',
    expiresIn: payload.expiresIn,
    userId: info.id,
    nickName: info.nickName || '',
    avatarUrl: info.avatarUrl || '',
    incomes: Number(info.incomes || 0),
    expenses: Number(info.expenses || 0)
  }
  wx.setStorageSync(USER_KEY, user)
  wx.setStorageSync(EXPIRE_KEY, Date.now() + Number(payload.expiresIn || 0) * 1000)
  wx.removeStorageSync(LOGOUT_KEY)
}

export function clearUser() {
  wx.removeStorageSync(USER_KEY)
  wx.removeStorageSync(EXPIRE_KEY)
}

/** 主动退出后不再静默登录，直到用户点击重新进入 */
export function setManualLogout() {
  clearUser()
  wx.setStorageSync(LOGOUT_KEY, '1')
}

export function clearManualLogout() {
  wx.removeStorageSync(LOGOUT_KEY)
}

export function getManualLogout() {
  return wx.getStorageSync(LOGOUT_KEY) === '1'
}

export function isExpired() {
  if (!getUser()) return true
  const at = Number(wx.getStorageSync(EXPIRE_KEY) || 0)
  return Date.now() >= at
}

export function setBindTicket(ticket: string) {
  wx.setStorageSync(BIND_TICKET, ticket)
}

export function getBindTicket(): string {
  return wx.getStorageSync(BIND_TICKET) || ''
}

export function clearBindTicket() {
  wx.removeStorageSync(BIND_TICKET)
}

export function setLastBillId(id: string) {
  wx.setStorageSync(LAST_BILL, id)
}

export function getLastBillId(): string {
  return wx.getStorageSync(LAST_BILL) || ''
}

export function setLastPref(pref: RecordPref) {
  wx.setStorageSync(LAST_PREF, pref)
}

export function getLastPref(): RecordPref | null {
  const pref = wx.getStorageSync(LAST_PREF)
  if (!pref || pref.costTypeId === undefined) return null
  if (Array.isArray(pref.belongUserIds)) return pref as RecordPref
  // 旧版本只存了单个 belongUserId：有 id 为单人，只有名字（全部）为空名单，都没有则视为未记住
  const { belongUserId, ...rest } = pref
  if (belongUserId) return { ...rest, belongUserIds: [String(belongUserId)] }
  if (pref.belongUserName) return { ...rest, belongUserIds: [] }
  return { ...rest, belongUserIds: undefined }
}

export function setBillDict(billId: string, bill: any) {
  wx.setStorageSync(DICT_PREFIX + billId, bill)
}

export function getBillDict(billId: string): any | null {
  return wx.getStorageSync(DICT_PREFIX + billId) || null
}

export function setEditingRecord(record: any) {
  wx.setStorageSync(EDITING, record)
}

export function getEditingRecord(): any | null {
  return wx.getStorageSync(EDITING) || null
}
