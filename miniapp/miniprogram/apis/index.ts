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

export function wxBind(data: { bindTicket: string; username: string; password: string }) {
  return request({ url: `${V}/common/wxBind`, method: 'POST', data, auth: false, silent: true })
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

export function getMonthCost(billId: string) {
  return request<{ totalCost: number }>({ url: `${V}/transaction/currentMonthCost`, data: { billId }, silent: true })
}

export function getBalance(billId: string, beginDate: number, endDate: number) {
  return request<{ totalCost: number; totalIncomes: number; investCost: number }>({
    url: `${V}/overview/balance`,
    data: { billId, beginDate, endDate },
    silent: true
  })
}
