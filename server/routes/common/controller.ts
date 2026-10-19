import type { Row } from '../../types/domain'
import { KEYUTIL, KJUR, b64tohex } from 'jsrsasign'
import { xssData } from '../../utils/xss'
import jwt from 'jsonwebtoken'
import { Encryption, User, UserWechat } from '../../database/index'
import { generateRsaKeyPair, ensureEncryptionKey, type EncryptionStore } from '../../database/ensureEncryption'
import { code2session } from '../../utils/wechat'
import { createBindTicket, peekBindTicket, consumeBindTicket } from '../../utils/redis'

import { genPassword } from '../../utils/cryp'
import { loadSecrets } from '../../config/secrets'

const USER_ATTRS = ['id', 'nickName', 'avatarUrl', 'incomes', 'expenses']

// 获取登录配置（表为空时自动生成密钥，避免全新部署无法登录）
const getLoginConfig = async (): Promise<[string | null, { publicKey?: string } | null]> => {
  try {
    const res = await ensureEncryptionKey(Encryption as unknown as EncryptionStore)
    return [null, res as { publicKey?: string } | null]
  } catch (err: unknown) {
    console.error(err)
    return [err instanceof Error ? err.message : '获取登录配置失败', null]
  }
}

/** 仅允许环境变量指定的登录用户轮换 RSA 密钥。未配置则拒绝所有人。 */
const assertAdmin = async (userId: string | null | undefined) => {
  const adminUsername = process.env.ADMIN_USERNAME
  if (!adminUsername) return '未配置管理员，拒绝更新密钥'
  if (!userId) return '请先登录'
  const user = await User.findByPk(userId, { attributes: ['username'] })
  if (!user || user.username !== adminUsername) return '非管理员没有权限生成密钥'
  return null
}

// 更新密钥
const updateEncryptionKey = async () => {
  const { publicKey, privateKey } = generateRsaKeyPair()
  try {
    const exist = await Encryption.findOne()
    if (exist) {
      await Encryption.update({ publicKey, privateKey }, { where: { id: exist.id } })
    } else {
      await Encryption.create({ publicKey, privateKey })
    }
    return [null, true]
  } catch (err: unknown) {
    console.error(err)
    return [err, null]
  }
}

/** RSA 解密登录密码并校验账号，供密码登录与微信绑定共用 */
const verifyPassword = async (username: string, password: string) => {
  try {
    const keys = await Encryption.findAll({ attributes: ['privateKey'], limit: 1 })
    if (!keys.length || !keys[0]?.privateKey) {
      return ['登录密钥未初始化，请联系管理员', null]
    }
    // Node.js 22+ 已禁用 crypto.privateDecrypt 的 RSA_PKCS1_PADDING，改用 jsrsasign 与前端保持一致
    const privateKey = KEYUTIL.getKey(keys[0].privateKey)
    const decryptoPassword = KJUR.crypto.Cipher.decrypt(b64tohex(String(password)), privateKey, 'RSA')
    username = xssData(username)
    const hashedPassword = xssData(genPassword(decryptoPassword))
    console.log('hashedPassword', hashedPassword)
    const res = await User.findOne({
      where: { username, password: hashedPassword },
      attributes: USER_ATTRS
    })
    if (res) return [null, res]
    return ['账号密码不匹配', null]
  } catch (err: unknown) {
    console.error(err)
    return [(err instanceof Error ? err.message : '') || '登录失败', null]
  }
}

const login = async (username: string, password: string) => verifyPassword(username, password)

const findUserById = async (userId: string | null | undefined) => {
  return User.findOne({ where: { id: userId, isDel: false }, attributes: USER_ATTRS })
}

/** 小程序静默登录：已绑定直接返回用户，未绑定返回一次性 bindTicket */
const wxLogin = async (
  code: string
): Promise<[string | null, { needBind: true; bindTicket: string } | { needBind: false; user: Row } | null]> => {
  const [err, session] = await code2session(code)
  if (err || !session) return [err || '微信登录失败', null]
  const bind = await UserWechat.findOne({ where: { openid: session.openid } })
  if (!bind) {
    const bindTicket = await createBindTicket(session.openid)
    return [null, { needBind: true, bindTicket }]
  }
  const user = await findUserById(bind.userId)
  if (!user) return ['绑定的账号不存在', null]
  return [null, { needBind: false, user: user as Row }]
}

/**
 * 用账号密码把当前微信绑定到已有用户。
 * openid 已绑定则直接登录；账号已绑定其他微信则拒绝。
 */
const wxBind = async ({
  bindTicket,
  username,
  password
}: {
  bindTicket?: string | null
  username?: string | null
  password?: string | null
}) => {
  const pendingOpenid = await peekBindTicket(bindTicket || '')
  if (!pendingOpenid) return ['绑定凭证无效或已过期，请重新进入小程序', null]

  const existed = await UserWechat.findOne({ where: { openid: pendingOpenid } })
  if (existed) {
    const boundUser = await findUserById(existed.userId)
    if (!boundUser) return ['绑定的账号不存在', null]
    await consumeBindTicket(bindTicket || '')
    return [null, boundUser]
  }

  if (!username || !password) return ['账号密码不匹配', null]
  const [err, user] = await verifyPassword(username, password)
  if (err) return [err, null]

  const byUser = await UserWechat.findOne({ where: { userId: user.id } })
  if (byUser) return ['该账号已绑定其他微信，请联系管理员', null]

  const openid = await consumeBindTicket(bindTicket || '')
  if (!openid) return ['绑定凭证无效或已过期，请重新进入小程序', null]

  try {
    await UserWechat.create({ userId: user.id, openid, unionid: '' })
  } catch (e: unknown) {
    console.error(e)
    const again = await UserWechat.findOne({ where: { openid } })
    if (again && again.userId === user.id) return [null, user]
    return ['该账号已绑定其他微信，请联系管理员', null]
  }
  return [null, user]
}

// 生成jwt授权
const createJwt = (data: { userId?: string | null }) => {
  const EXPIRES_TIME = 24 * 60 * 60 // 有效时间
  const accessToken = jwt.sign(data, loadSecrets().jwtSecret, { expiresIn: EXPIRES_TIME })
  // refresh token
  const refreshToken = accessToken.slice(accessToken.lastIndexOf('.') + 1)

  return { accessToken, refreshToken, EXPIRES_TIME }
}

/** 注册 */
const register = async (username: string, password: string, nickName: string) => {
  try {
    const keys = await Encryption.findAll({ attributes: ['privateKey'], limit: 1 })
    if (!keys.length || !keys[0]?.privateKey) {
      return ['登录密钥未初始化，请联系管理员', null]
    }
    const privateKey = KEYUTIL.getKey(keys[0].privateKey)
    const decryptoPassword = KJUR.crypto.Cipher.decrypt(b64tohex(String(password)), privateKey, 'RSA')

    username = xssData(username)
    nickName = xssData(nickName || username)

    // 密码强度校验（解密后的明文校验）
    if (decryptoPassword.length < 8) {
      return ['密码至少需要8位', null]
    }
    if (!/[a-z]/.test(decryptoPassword)) {
      return ['密码必须包含小写字母', null]
    }
    if (!/[A-Z]/.test(decryptoPassword)) {
      return ['密码必须包含大写字母', null]
    }
    if (!/\d/.test(decryptoPassword)) {
      return ['密码必须包含数字', null]
    }

    // 检查用户名是否已存在
    const exist = await User.findOne({ where: { username } })
    if (exist) {
      return ['用户名已存在', null]
    }

    const hashedPassword = xssData(genPassword(decryptoPassword))
    const res = await User.create({
      username,
      password: hashedPassword,
      nickName
    })
    return [null, { id: res.id, username: res.username, nickName: res.nickName }]
  } catch (err: unknown) {
    console.error(err)
    return [(err instanceof Error ? err.message : '') || '注册失败', null]
  }
}

export { getLoginConfig, updateEncryptionKey, assertAdmin, login, register, createJwt, verifyPassword, wxLogin, wxBind }
