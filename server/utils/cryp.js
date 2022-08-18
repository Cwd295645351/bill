import crypto from 'crypto'

// 定时更新密钥，存到数据库中
export const createPublicKey = () => {
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
  return { publicKey, privateKey }
}

// 根据密钥解密
export const decrypt = (value) => {
    // 从数据库获取密钥（此处先写死，用于调试，后续接入数据库时修改）
  const privateKey =
    '-----BEGIN RSA PRIVATE KEY-----\nMIIBOwIBAAJBAL9FpCebYmJT0cThQcCCRJFGcKVhThPJsWP2kRi+pqSCue4+7oCy\nLrq7bEVRUoPhP0IDpJMHNHVUeetIGaU0Aa8CAwEAAQJACqWVvZ6om1CPHKZtQon9\nxxhkrM/9yJwxg5719KqoHAASL4wQhtyjBEENq0NOFecdnAlZ6y3HcBqFfi1gO9S8\nAQIhAOg8OanEeztiIlFrY/HMiCx6IgJI3PIqyP30RSalZvKpAiEA0thRnTtKd8ZY\n+E2CDhrpq0Lm1H+FBc7mCfNxGIdP4JcCIEaXb+uzxsWxOb9IBnRMeKQUZ9wL6+VM\nrhXLt21c36MpAiEAjQgvB0oKlLVy+5v0u3SbCnh0qH0nwGvViaBx7ONNtb8CIQCV\ndY1ph0zZsac3sKjjvjSTqfXxo9rJOnEmHRJBPGil8g==\n-----END RSA PRIVATE KEY-----\n'
  const decryptoData = crypto
    .privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      },
      Buffer.from(value.toString('base64'), 'base64')
    )
    .toString()
  return decryptoData
}
