/**
 * 资产记录表
 */
const mongoose = require('../index')
const dayjs = require('dayjs')

const assetRecordSchema = mongoose.Schema({
    assetId: { type: String, required: true }, // 所属家庭资产 id
    userId: { type: String, required: true }, // 所属家庭成员 id
    userName: { type: String, required: true }, // 所属家庭成员名称
    assetTypeId: { type: String, required: true }, // 资产类型 id
    assetTypeName: { type: String, required: true }, // 资产类型名称
    name: { type: String, required: true }, // 资产名称
    isDebt: { type: Boolean, required: true, default: false }, // 是否负债
    remark: { type: String, required: true }, // 备注
    // 最近更新时间
    lastUpdatedDate: {
        type: Date,
        required: true,
        get: (v) => {
            return v ? dayjs(v).format('YYYY-MM-DD') : ''
        },
        default: Date.now
    },
    lastUpdatedMoney: { type: Number, required: true, default: 0 }, // 最近更新金额
    // 资产更新记录
    updateRecords: [
        {
            // 更新日期
            date: {
                type: Date,
                required: true,
                get: (v) => {
                    return v ? dayjs(v).format('YYYY-MM-DD') : ''
                },
                default: Date.now
            },
            money: { type: Number, required: true, default: 0 }, // 金额
        }
    ],
    sort: { type: Number, required: true }, // 排序
    isDel: { type: Boolean, required: true, default: false } // 是否删除

})


assetSchema.set('toJSON', { getters: true })
const AssetRecord = mongoose.model('assetRecord', assetRecordSchema)

module.exports = AssetRecord
