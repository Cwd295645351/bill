import { getBaseURL } from '../config/env'
import { ensureLogin } from '../utils/auth'
import { request } from '../utils/request'
import { getUser, isExpired } from '../utils/storage'
import { showTip } from '../utils/tip'
import type { ApiBody } from '../utils/request'

const V = '/api/v1'

function authHeader() {
  const user = getUser()
  if (!user) return {}
  return {
    Authorization: `bearer ${user.accessToken}`,
    userId: user.userId,
    nickName: encodeURIComponent(user.nickName || '')
  }
}

export function getLoginConfig() {
  return request<{ publicKey: string }>({ url: `${V}/common/login_config`, auth: false, silent: true })
}

export function fetchCaptcha() {
  return request<{
    captchaId: string
    backgroundImage: string
    puzzleImage: string
    y: number
    width: number
    height: number
    puzzleSize: number
    targetX: number
    tolerance: number
    expiresIn: number
  }>({ url: `${V}/common/captcha`, auth: false, silent: true })
}

export function wxBind(data: { bindTicket: string; username: string; password: string; captchaId: string; captchaX: number }) {
  return request({ url: `${V}/common/wxBind`, method: 'POST', data, auth: false, silent: true })
}

export function wxRegister(data: {
  bindTicket: string
  username: string
  password: string
  nickName?: string
  captchaId: string
  captchaX: number
}) {
  return request<{
    needBind?: boolean
    accessToken?: string
    refreshToken?: string
    expiresIn?: number
    userInfo?: Record<string, unknown>
    accountCreated?: boolean
    username?: string
  }>({ url: `${V}/common/wxRegister`, method: 'POST', data, auth: false, silent: true })
}

export function getBillList() {
  return request<any[]>({ url: `${V}/bill/list` })
}

export function createBill(name: string) {
  return request({ url: `${V}/bill`, method: 'POST', data: { name } })
}

export function deleteBill(id: string) {
  return request({ url: `${V}/bill`, method: 'DELETE', data: { id } })
}

export function getBillDetail(id: string) {
  return request({ url: `${V}/bill`, data: { id } })
}

export function inviteBill(id: string) {
  return request<string>({ url: `${V}/bill/invite`, method: 'POST', data: { id }, silent: true })
}

export function joinBill(code: string) {
  return request({ url: `${V}/bill/join`, method: 'POST', data: { code }, silent: true })
}

export function getRecordList(data: any) {
  return request<{ total: number; datas: any[] }>({ url: `${V}/transaction/list`, method: 'POST', data })
}

export function addTransaction(data: any) {
  return request({ url: `${V}/transaction`, method: 'POST', data })
}

/** 上传一张记账照片，返回未挂接的照片 id */
export async function uploadTransactionImage(billId: string, filePath: string): Promise<ApiBody<{ id: string }>> {
  if (isExpired()) {
    const status = await ensureLogin()
    if (status !== 'ok') {
      showTip('登录已失效')
      return { retCode: 401, message: '登录已失效', data: null as any }
    }
  }
  const url = `${getBaseURL()}${V}/transaction/image`
  return new Promise((resolve) => {
    wx.uploadFile({
      url,
      filePath,
      name: 'file',
      formData: { billId },
      header: authHeader(),
      success: (res) => {
        let body: ApiBody<{ id: string }>
        try {
          body = typeof res.data === 'string' ? JSON.parse(res.data) : (res.data as any)
        } catch (e) {
          body = { retCode: -1, message: '照片没有保存成功', data: null as any }
        }
        if (!body || body.retCode == null) {
          body = { retCode: -1, message: '照片没有保存成功', data: null as any }
        }
        if (body.retCode !== 0) showTip(body.message || '照片没有保存成功')
        resolve(body)
      },
      fail: () => {
        showTip('网络异常')
        resolve({ retCode: -1, message: '网络异常', data: null as any })
      }
    })
  })
}

export function editTransaction(data: any) {
  return request({ url: `${V}/transaction`, method: 'PUT', data })
}

export function deleteTransaction(id: string) {
  return request({ url: `${V}/transaction`, method: 'DELETE', data: { id } })
}

export function getBudget(billId: string, year: number) {
  return request({ url: `${V}/budget/list`, data: { billId, date: year }, silent: true })
}

export function budgetAdd(data: { billId: string; date: number; costTypeId: string; money: number }) {
  return request({ url: `${V}/budget`, method: 'POST', data, silent: true })
}

export function budgetEdit(data: { id: string; billId: string; date: number; money: number }) {
  return request({ url: `${V}/budget`, method: 'PUT', data, silent: true })
}

export function budgetDelete(params: { id: string; billId: string; date: number }) {
  return request({ url: `${V}/budget`, method: 'DELETE', data: params, silent: true })
}

export function getPlanList(billId: string) {
  return request<{ count: number; details: any[] }>({
    url: `${V}/plan/list`,
    data: { billId },
    silent: true
  })
}

export function planAdd(data: { billId: string; title: string; context: string; priority: number }) {
  return request({ url: `${V}/plan`, method: 'POST', data, silent: true })
}

export function planEdit(data: {
  id: string
  billId: string
  title: string
  context: string
  priority: number
}) {
  return request({ url: `${V}/plan`, method: 'PUT', data, silent: true })
}

export function planDelete(params: { id: string; billId: string }) {
  return request({ url: `${V}/plan`, method: 'DELETE', data: params, silent: true })
}

export function getMonthCost(billId: string) {
  return request<{ totalCost: number }>({ url: `${V}/transaction/currentMonthCost`, data: { billId }, silent: true })
}

export function getMobileOverview(billId: string, beginDate: string, endDate: string, cumulativeIncome?: boolean) {
  return request({
    url: `${V}/overview/mobile`,
    data: {
      billId,
      beginDate,
      endDate,
      ...(cumulativeIncome ? { cumulativeIncome: 'true' } : {})
    },
    silent: true
  })
}

export function getMobileRecords(data: {
  billId: string
  beginDate: string
  endDate: string
  costTypeId: string
  memberId?: string
}) {
  return request({ url: `${V}/overview/mobile/records`, data, silent: true })
}

export function getBalance(billId: string, beginDate: number, endDate: number) {
  return request<{ totalCost: number; totalIncomes: number; investCost: number }>({
    url: `${V}/overview/balance`,
    data: { billId, beginDate, endDate },
    silent: true
  })
}


export function updateProfile(nickName: string) {
  return request({ url: `${V}/common/profile`, method: 'PUT', data: { nickName } })
}

export function changePassword(oldPassword: string, newPassword: string) {
  return request({ url: `${V}/common/password`, method: 'PUT', data: { oldPassword, newPassword } })
}

/** 上传头像，返回富化用户信息 */
export async function uploadAvatar(filePath: string): Promise<ApiBody<any>> {
  if (isExpired()) {
    const status = await ensureLogin()
    if (status !== 'ok') {
      showTip('登录已失效')
      return { retCode: 401, message: '登录已失效', data: null as any }
    }
  }
  const url = `${getBaseURL()}${V}/common/avatar`
  return new Promise((resolve) => {
    wx.uploadFile({
      url,
      filePath,
      name: 'file',
      header: authHeader(),
      success: (res) => {
        let body: ApiBody<any>
        try {
          body = typeof res.data === 'string' ? JSON.parse(res.data) : (res.data as any)
        } catch (e) {
          body = { retCode: -1, message: '头像没有保存成功', data: null as any }
        }
        if (!body || body.retCode == null) {
          body = { retCode: -1, message: '头像没有保存成功', data: null as any }
        }
        if (body.retCode !== 0) showTip(body.message || '头像没有保存成功')
        resolve(body)
      },
      fail: () => {
        showTip('网络异常')
        resolve({ retCode: -1, message: '网络异常', data: null as any })
      }
    })
  })
}

export function quitBill(billId: string, userId: string) {
  return request({ url: `${V}/bill/quit`, method: 'POST', data: { id: billId, userId } })
}

const A = `${V}/asset`

export function getAssetMembers(billId: string) {
  return request<any[]>({ url: `${A}/members`, data: { billId } })
}

export function getAssetListStats(billId: string, memberId?: string) {
  return request<any>({ url: `${A}/list-stats`, data: { billId, memberId: memberId || '' } })
}

export function getAssetOverview(billId: string, memberId?: string, asOf?: string) {
  return request<any>({ url: `${A}/overview`, data: { billId, memberId: memberId || '', asOf: asOf || '' } })
}

export function addAssetMember(billId: string, name: string) {
  return request({ url: `${A}/member`, method: 'POST', data: { billId, name } })
}

export function editAssetMember(id: string, name: string) {
  return request({ url: `${A}/member`, method: 'PUT', data: { id, name } })
}

export function hideAssetMember(id: string) {
  return request({ url: `${A}/member`, method: 'DELETE', data: { id } })
}

export function saveAsset(data: Record<string, unknown>, editing: boolean) {
  return request({ url: A, method: editing ? 'PUT' : 'POST', data })
}

export function deleteAsset(id: string) {
  return request({ url: A, method: 'DELETE', data: { id } })
}

export function getAssetRecords(assetId: string, page: number) {
  return request<any>({ url: `${A}/records`, data: { assetId, page, pageSize: 10 } })
}

export function saveAssetRecord(data: Record<string, unknown>, editing: boolean) {
  return request({ url: `${A}/record`, method: editing ? 'PUT' : 'POST', data })
}

export function deleteAssetRecord(id: string) {
  return request({ url: `${A}/record`, method: 'DELETE', data: { id } })
}

export function getAssetRate(billId: string) {
  return request<any>({ url: `${A}/exchange-rate`, data: { billId } })
}

export function saveAssetRate(billId: string, hkdRate: string, usdRate: string) {
  return request({ url: `${A}/exchange-rate`, method: 'PUT', data: { billId, hkdRate, usdRate } })
}

export function getFourMoney(billId: string, memberId?: string) {
  return request<any>({ url: `${A}/four-money`, data: { billId, memberId: memberId || '' } })
}

export function getMonthlyReport(billId: string, year: number, memberId?: string) {
  return request<any>({ url: `${A}/monthly-report`, data: { billId, year, memberId: memberId || '' } })
}

export function getAssetTrend(data: Record<string, unknown>) {
  return request<any>({ url: `${A}/trend`, data })
}

export function getAssetLedger(billId: string, year: number, memberId?: string) {
  return request<any>({ url: `${A}/ledger`, method: 'POST', data: { billId, year, memberId: memberId || undefined } })
}

export function getRetirePlan(data: Record<string, unknown>) {
  const query: Record<string, string | number> = {}
  Object.keys(data).forEach((key) => {
    const value = data[key]
    if (value === undefined || value === null || value === '') return
    query[key] = value as string | number
  })
  return request<any>({ url: `${A}/retire-plan`, data: query })
}

export function saveRetirePlan(data: Record<string, unknown>) {
  return request({ url: `${A}/retire-plan`, method: 'PUT', data })
}
