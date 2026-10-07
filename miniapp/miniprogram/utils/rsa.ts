/**
 * 与 H5 一致：用登录配置里的公钥做 RSA 加密，再转成 base64 密文。
 * jsrsasign 体积较大，只在绑定页引用。
 */
export function encryptPassword(publicKey: string, password: string): string {
  const jsr = require('jsrsasign')
  const pub = jsr.KEYUTIL.getKey(publicKey)
  const hex = jsr.KJUR.crypto.Cipher.encrypt(password, pub, 'RSA')
  return jsr.hextob64(hex)
}
