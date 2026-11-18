/** 用户信息 */
export interface UserInfo {
  /** token */
  accessToken: string
  /** 刷新token */
  refreshToken: string
  /** 用户id */
  userId: string
  /** 有效期 */
  expiresIn: number
  /** 昵称 */
  nickName: string
  /** 头像 */
  avatarUrl: string
  /** 总收入 */
  incomes: number
  /** 总支出 */
  expenses: number
  /** 是否运营管理员（登录下发；未配置时恒为 false） */
  isAdmin?: boolean
}

/** 刷新token返回的用户信息 */
export interface RefreshTokenInfo {
  /** token */
  accessToken: string
  /** 刷新token */
  refreshToken: string
  /** 有效期 */
  expiresIn: number
  /** 用户id */
  userId: string
}
