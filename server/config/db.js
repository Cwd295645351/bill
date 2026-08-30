const MYSQL_CONF = {
  host: '127.0.0.1',
  port: 3306,
  username: 'root',
  password: '123456',
  database: 'bill',
  dialect: 'mysql',
  logging: false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
}

/** 仅数据迁移脚本使用 */
const MONGODB_CONF = {
  host: '127.0.0.1',
  port: 27017,
  dbName: 'bill'
}

const REDIS_CONF = {
  host: '127.0.0.1',
  port: 6379
}

module.exports = {
  MYSQL_CONF,
  MONGODB_CONF,
  REDIS_CONF
}
