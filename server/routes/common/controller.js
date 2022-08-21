import crypto from 'crypto'
import xss from 'xss'
import Encryption from '../../database/modules/Encryption'
import User from '../../database/modules/User'

import { genPassword } from '../../utils/cryp'

// 获取登录配置
export const getLoginConfig = async () => {
  try {
    const res = await Encryption.find({}, { publicKey: 1, _id: 0 })
    return [null, res[0]]
  } catch (err) {
    console.error(err)
    return [err, null]
  }
}

// 更新密钥
export const updateEncryptionKey = async () => {
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

export const login = async (username, password) => {
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
    username = xss(username)
    password = xss(genPassword(decryptoPassword)) // 对密码进行加密
    const res = await User.findOne({
      username: username,
      password: password
    })
    if (res) {
      return [null, true]
    } else {
      return ['账号密码不匹配', null]
    }
  } catch (err) {
    console.error(err)
    return [err, null]
  }
}
