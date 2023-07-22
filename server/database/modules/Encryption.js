const mongoose = require('../index')

// 密钥/公钥
const EncryptionSchema = mongoose.Schema({
  privateKey: { type: String, required: true }, // 私钥
  publicKey: { type: String, required: true } // 公钥
})

const Encryption = mongoose.model('encryptions', EncryptionSchema)

module.exports = Encryption
