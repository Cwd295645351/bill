import crypto from 'crypto'

// 密钥
const SECRET_KEY = '15641#!#0.SAFAasd'

// md5加密
const md5 = (content) => {
  let md5 = crypto.createHash('md5')
  return md5.update(content).digest('hex')
}

// 加密函数
export const genPassword = (password) => {
  const str = `password=${password}&key=${SECRET_KEY}`
  return md5(str)
}
