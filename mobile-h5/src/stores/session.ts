import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface SessionUserInfo {
  id?: string
  userId: string
  nickName: string
  avatarUrl?: string
  incomes?: number
  expenses?: number
  accessToken: string
  refreshToken: string
  expiresIn?: number
}

const USER_KEY = 'userInfo'
const EXPIRES_KEY = 'expiresAt'

function readStoredUser(): SessionUserInfo | null {
  try {
    const raw = sessionStorage.getItem(USER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SessionUserInfo
  } catch {
    return null
  }
}

function readExpiresAt(): number {
  const raw = sessionStorage.getItem(EXPIRES_KEY)
  const n = Number(raw || 0)
  return Number.isFinite(n) ? n : 0
}

export const useSessionStore = defineStore('session', () => {
  const userInfo = ref<SessionUserInfo | null>(readStoredUser())
  const expiresAt = ref<number>(readExpiresAt())

  const accessToken = computed(() => userInfo.value?.accessToken || '')
  const refreshToken = computed(() => userInfo.value?.refreshToken || '')
  const isAuthenticated = computed(() => {
    if (!userInfo.value?.accessToken) return false
    if (!expiresAt.value) return true
    return Date.now() < expiresAt.value
  })

  function setSession(payload: {
    accessToken: string
    refreshToken: string
    expiresIn: number
    userInfo: Record<string, any>
  }) {
    const next: SessionUserInfo = {
      ...payload.userInfo,
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      expiresIn: payload.expiresIn,
      userId: String(payload.userInfo.id || payload.userInfo.userId || ''),
      nickName: payload.userInfo.nickName || payload.userInfo.username || '',
    }
    const exp = Date.now() + Number(payload.expiresIn || 0) * 1000
    userInfo.value = next
    expiresAt.value = exp
    sessionStorage.setItem(USER_KEY, JSON.stringify(next))
    sessionStorage.setItem(EXPIRES_KEY, String(exp))
  }

  function patchTokens(payload: {
    accessToken: string
    refreshToken: string
    expiresIn: number
    userId?: string
  }) {
    if (!userInfo.value) return
    const next = {
      ...userInfo.value,
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      expiresIn: payload.expiresIn,
      userId: payload.userId ? String(payload.userId) : userInfo.value.userId,
    }
    const exp = Date.now() + Number(payload.expiresIn || 0) * 1000
    userInfo.value = next
    expiresAt.value = exp
    sessionStorage.setItem(USER_KEY, JSON.stringify(next))
    sessionStorage.setItem(EXPIRES_KEY, String(exp))
  }

  function clearSession() {
    userInfo.value = null
    expiresAt.value = 0
    sessionStorage.removeItem(USER_KEY)
    sessionStorage.removeItem(EXPIRES_KEY)
  }

  return {
    userInfo,
    expiresAt,
    accessToken,
    refreshToken,
    isAuthenticated,
    setSession,
    patchTokens,
    clearSession,
  }
})
