const crypto = require('crypto')

/** 生成登录用 RSA 密钥对（与历史接口保持一致） */
const generateRsaKeyPair = () => {
  return crypto.generateKeyPairSync('rsa', {
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
}

/**
 * 确保 encryptions 表中至少有一条可用密钥。
 * 全新部署 sync 后该表为空，若不自动生成，login_config / 登录都会失败。
 */
const ensureEncryptionKey = async (Encryption) => {
  const exist = await Encryption.findOne()
  if (exist?.publicKey && exist?.privateKey) return exist

  const { publicKey, privateKey } = generateRsaKeyPair()
  if (exist) {
    await Encryption.update({ publicKey, privateKey }, { where: { id: exist.id } })
    exist.publicKey = publicKey
    exist.privateKey = privateKey
    return exist
  }

  const created = await Encryption.create({ publicKey, privateKey })
  console.log('Encryption key pair initialized')
  return created
}

module.exports = { generateRsaKeyPair, ensureEncryptionKey }
