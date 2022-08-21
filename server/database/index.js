import mongoose from 'mongoose'
import CONF from '../config/db'

const url = `mongodb://${CONF.MONGODB_CONF.host}:${CONF.MONGODB_CONF.port}`
const dbName = CONF.MONGODB_CONF.dbName


// 链接数据库
mongoose.connect(`${url}/${dbName}`)

//  获取连接对象
const db = mongoose.connection

// 发生错误
db.on('error', (err) => {
  console.error(err)
})

// 连接成功
db.once('open', () => {
  console.log('mongoose connect success')
})

export default mongoose
