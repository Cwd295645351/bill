import mongoose from '../index'

// 用户
const UserSchema = mongoose.Schema({
  username: { type: String, required: true }, // 用户名
  password: { type: String, required: true }, // 密码
  nickName: { type: String, required: true }, // 用户昵称
  avatarUrl: { type: String, required: false, defualt: '' }, // 用户头像
  incomes: { type: Number, required: true }, // 总收入
  expenses: { type: Number, required: true, defualt: 0 }, // 总支出
  isDel: { type: Boolean, required: true, default: false } // 是否删除
})

const User = mongoose.model('users', UserSchema)

export default User
