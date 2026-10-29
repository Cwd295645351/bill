import { KEYUTIL, KJUR, hextob64 } from 'jsrsasign'

/** RSA encrypt password with PC-compatible jsrsasign Cipher.encrypt + hextob64 */
export function encryptPassword(password: string, publicKeyPem: string): string {
  const pub: any = KEYUTIL.getKey(publicKeyPem)
  const encryptData = KJUR.crypto.Cipher.encrypt(password, pub, 'RSA')
  return hextob64(encryptData)
}
