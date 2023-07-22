const crypto = require('crypto')
const { xssData } = require('../../utils/xss')
const jwt = require('jsonwebtoken')
const Encryption = require('../../database/modules/Encryption')
const User = require('../../database/modules/User')

const { genPassword } = require('../../utils/cryp')

// 获取登录配置
const getLoginConfig = async () => {
  try {
    const res = await Encryption.find({}, { publicKey: 1, _id: 0 })
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
    const res = await Encryption.findOneAndUpdate(
      {},
      {
        publicKey,
        privateKey
      }
    )
    if (res) {
      return [null, true]
    } else {
      return ['更新失败', null]
    }
  } catch (err) {
    console.error(err)
    return [err, null]
  }
}

const login = async (username, password) => {
  try {
    const keys = await Encryption.find({}, { privateKey: 1, _id: 0 })
    const decryptoPassword = crypto
      .privateDecrypt(
        {
          key: keys[0].privateKey,
          padding: crypto.constants.RSA_PKCS1_PADDING
        },
        Buffer.from(password.toString('base64'), 'base64')
      )
      .toString()
    username = xssData(username)
    password = xssData(genPassword(decryptoPassword)) // 对密码进行加密
    const res = await User.findOne(
      {
        username: username,
        password: password
      },
      {
        nickName: 1,
        avatarUrl: 1,
        incomes: 1,
        expenses: 1
      }
    )
    if (res) {
      return [null, res]
    } else {
      return ['账号密码不匹配', null]
    }
  } catch (err) {
    console.error(err)
    return [err, null]
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
