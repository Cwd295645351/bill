const crypto = require('crypto')
const { KEYUTIL, KJUR, b64tohex } = require('jsrsasign')
const { xssData } = require('../../utils/xss')
const jwt = require('jsonwebtoken')
const { Encryption, User } = require('../../database/index')

const { genPassword } = require('../../utils/cryp')

// 获取登录配置
const getLoginConfig = async () => {
  try {
    const res = await Encryption.findAll({ attributes: ['publicKey'], limit: 1 })
    return [null, res[0]]
  } catch (err) {
    console.error(err)
    return [err, null]
  }
}

// 更新密钥
const updateEncryptionKey = async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 512,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs1',
      format: 'pem'
    }
  })
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

module.exports = { getLoginConfig, updateEncryptionKey, login, createJwt }
