/** 当前表单状态：login=登录；register=注册；forget=忘记密码  */
export type Status = 'login' | 'register' | 'forget'

/** 登录信息 */
export interface FormInfo {
  /** 用户名 */
  username: string
  /** 密码 */
  password: string
}
