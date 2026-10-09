/** 从环境变量读取签名与加密材料。缺失或长度不对时直接失败，避免回退到写死的密钥。 */
let cached = null

const required = (name) => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`缺少环境变量 ${name}，请在 server/.env 中配置（参考 .env.example）`)
  }
  return value
}

const loadSecrets = () => {
  if (cached) return cached
  const aesKey = required('AES_KEY')
  const aesIv = required('AES_IV')
  if (Buffer.byteLength(aesKey) !== 16 || Buffer.byteLength(aesIv) !== 16) {
    throw new Error('AES_KEY 与 AES_IV 必须各为 16 字节（aes-128-cbc）')
  }
  cached = {
    jwtSecret: required('JWT_SECRET'),
    passwordSalt: required('PASSWORD_SALT'),
    aesKey,
    aesIv
  }
  return cached
}

module.exports = { loadSecrets }
