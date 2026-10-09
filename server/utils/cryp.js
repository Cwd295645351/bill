const crypto = require('crypto')
const { loadSecrets } = require('../config/secrets')

// md5加密
const md5 = (content) => {
  let md5 = crypto.createHash('md5')
  return md5.update(content).digest('hex')
}

// 对密码进行加密
const genPassword = (password) => {
  const { passwordSalt } = loadSecrets()
  const str = `password=${password}&key=${passwordSalt}`
  return md5(str)
}

// 对称加密
const encode = (src) => {
  const { aesKey, aesIv } = loadSecrets()
  let sign = ''
  const cipher = crypto.createCipheriv('aes-128-cbc', aesKey, aesIv) // createCipher在10.0.0已被废弃
  sign += cipher.update(src, 'utf8', 'hex')
  sign += cipher.final('hex')
  return sign
}

// 对称解密
const decode = (src) => {
  const { aesKey, aesIv } = loadSecrets()
  let sign = ''
  const cipher = crypto.createDecipheriv('aes-128-cbc', aesKey, aesIv)
  sign += cipher.update(src, 'hex', 'utf8')
  sign += cipher.final('utf8')
  return sign
}

module.exports = { genPassword, encode, decode }
