import { DataTypes } from 'sequelize'
import { decimalMoney, defineId, type DefineModel } from './helpers'

/** 账号、微信绑定、加密密钥 */
export function defineAuthModels(defineModel: DefineModel) {
  const User = defineModel(
      'users',
      {
        id: defineId,
        username: { type: DataTypes.STRING(64), allowNull: false },
        password: { type: DataTypes.STRING(255), allowNull: false },
        nickName: { type: DataTypes.STRING(64), allowNull: false, field: 'nick_name' },
        avatarUrl: { type: DataTypes.STRING(512), allowNull: true, defaultValue: '', field: 'avatar_url' },
        incomes: decimalMoney('incomes'),
        expenses: decimalMoney('expenses'),
        isDel: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_del' },
        createdAt: { type: DataTypes.DATE, allowNull: true, field: 'created_at' }
      },
      { tableName: 'users' }
    )

  // 微信小程序 openid 与账号一对一绑定，不可解绑（换绑需管理员改库）
  const UserWechat = defineModel(
      'user_wechats',
      {
        id: defineId,
        userId: { type: DataTypes.CHAR(36), allowNull: false, unique: true, field: 'user_id' },
        openid: { type: DataTypes.STRING(64), allowNull: false, unique: true },
        unionid: { type: DataTypes.STRING(64), allowNull: true, defaultValue: '' },
        createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' }
      },
      { tableName: 'user_wechats' }
    )

  const Encryption = defineModel(
      'encryptions',
      {
        id: defineId,
        privateKey: { type: DataTypes.TEXT, allowNull: false, field: 'private_key' },
        publicKey: { type: DataTypes.TEXT, allowNull: false, field: 'public_key' }
      },
      { tableName: 'encryptions' }
    )


  return { User, UserWechat, Encryption }
}
