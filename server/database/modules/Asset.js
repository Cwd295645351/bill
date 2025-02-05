/**
 * 资产表
 */

const mongoose = require('../index')

const assetSchema = mongoose.Schema({
    billId: { type: String, required: true }, // 所属账本
    // 家庭成员
    users: [
        {
            userId: { type: String, required: true },
            userName: { type: String, required: true }
        }
    ],
    // 资产类型
    assetTypes: [
        {
            id: { type: String, required: true },
            name: { type: String, required: true },
            isDebt: { type: Boolean, required: true, default: false }, // 是否负债
            sort: { type: Number, required: true }
        }
    ],
    isDel: { type: Boolean, required: true, default: false } // 是否删除
})


const Asset = mongoose.model('asset', assetSchema)

module.exports = Asset