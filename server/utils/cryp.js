const crypto = require('crypto')

// md5加密
const md5 = (content) => {
  let md5 = crypto.createHash('md5')
  return md5.update(content).digest('hex')
}

// 对密码进行加密
const genPassword = (password) => {
  // 密钥
  const SECRET_KEY = '15641#!#0.SAFAasd'
  const str = `password=${password}&key=${SECRET_KEY}`
  return md5(str)
}

// 对称加密
const encode = (src) => {
  const key = 'chenyd-bill-keys'
  const iv = 'chenyd--bill--iv'
  let sign = ''
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv) // createCipher在10.0.0已被废弃
  sign += cipher.update(src, 'utf8', 'hex')
  sign += cipher.final('hex')
  return sign
}

// 对称解密
const decode = (src) => {
  const key = 'chenyd-bill-keys'
  const iv = 'chenyd--bill--iv'
  let sign = ''
  const cipher = crypto.createDecipheriv('aes-128-cbc', key, iv)
  sign += cipher.update(src, 'hex', 'utf8')
  sign += cipher.final('utf8')
  return sign
}

module.exports = { genPassword, encode, decode }
