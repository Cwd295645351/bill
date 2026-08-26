const { KEYUTIL, KJUR, b64tohex } = require('jsrsasign')
const { xssData } = require('../../utils/xss')
const jwt = require('jsonwebtoken')
const { Encryption, User } = require('../../database/index')
const { generateRsaKeyPair, ensureEncryptionKey } = require('../../database/ensureEncryption')

const { genPassword } = require('../../utils/cryp')

// 获取登录配置（表为空时自动生成密钥，避免全新部署无法登录）
const getLoginConfig = async () => {
  try {
    const res = await ensureEncryptionKey(Encryption)
    return [null, res]
  } catch (err) {
    console.error(err)
    return [err, null]
  }
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
  } catch (err) {
    console.error(err)
    return [err, null]
  }
}

const login = async (username, password) => {
  try {
    const keys = await Encryption.findAll({ attributes: ['privateKey'], limit: 1 })
    if (!keys.length || !keys[0]?.privateKey) {
      return ['登录密钥未初始化，请联系管理员', null]
    }
    // Node.js 22+ 已禁用 crypto.privateDecrypt 的 RSA_PKCS1_PADDING，改用 jsrsasign 与前端保持一致
    const privateKey = KEYUTIL.getKey(keys[0].privateKey)
    const decryptoPassword = KJUR.crypto.Cipher.decrypt(b64tohex(String(password)), privateKey, 'RSA')
    username = xssData(username)
    password = xssData(genPassword(decryptoPassword)) // 对密码进行加密
    const res = await User.findOne({
      where: { username: username, password: password },
      attributes: ['id', 'nickName', 'avatarUrl', 'incomes', 'expenses']
    })
    if (res) {
      return [null, res]
    } else {
      return ['账号密码不匹配', null]
    }
  } catch (err) {
    console.error(err)
    return [err?.message || '登录失败', null]
  }
}

// 生成jwt授权
const createJwt = (data) => {
  const SECRET_KEY = 'admin_jwt_token'
  const EXPIRES_TIME = 24 * 60 * 60 // 有效时间
  // jwt生成token
  const accessToken = jwt.sign(data, SECRET_KEY, { expiresIn: EXPIRES_TIME })
  // refresh token
  const refreshToken = accessToken.slice(accessToken.lastIndexOf('.') + 1)

  return { accessToken, refreshToken, EXPIRES_TIME }
}

/** 注册 */
const register = async (username, password, nickName) => {
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
  } catch (err) {
    console.error(err)
    return [err?.message || '注册失败', null]
  }
}

module.exports = { getLoginConfig, updateEncryptionKey, login, register, createJwt }
