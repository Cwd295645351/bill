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

const REDIS_CONF = {
  host: '127.0.0.1',
  port: 6379
}

module.exports = {
  MYSQL_CONF,
  REDIS_CONF
}
