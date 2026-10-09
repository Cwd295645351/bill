/** 数据库与 Redis 连接。账号密码只从环境变量读取，禁止写回本文件。 */

const required = (name) => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`缺少环境变量 ${name}，请在 server/.env 中配置（参考 .env.example）`)
  }
  return value
}

const MYSQL_CONF = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  username: required('MYSQL_USER'),
  password: required('MYSQL_PASSWORD'),
  database: process.env.MYSQL_DATABASE || 'bill',
  dialect: 'mysql',
  logging: false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
}

const REDIS_CONF = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379)
}

module.exports = {
  MYSQL_CONF,
  REDIS_CONF
}
