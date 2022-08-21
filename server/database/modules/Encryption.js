import mongoose from '../index'

const EncryptionSchema = mongoose.Schema({
  privateKey: { type: String, required: true }, // 私钥
  publicKey: { type: String, required: true } // 公钥
})

const Encryption = mongoose.model('encryptions', EncryptionSchema)

export default Encryption
