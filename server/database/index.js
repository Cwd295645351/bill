const { Sequelize } = require('sequelize')
const { MYSQL_CONF } = require('../config/db')

const sequelize = new Sequelize(
  MYSQL_CONF.database,
  MYSQL_CONF.username,
  MYSQL_CONF.password,
  {
    host: MYSQL_CONF.host,
    port: MYSQL_CONF.port,
    dialect: MYSQL_CONF.dialect,
    logging: MYSQL_CONF.logging,
    pool: MYSQL_CONF.pool,
    define: {
      timestamps: false,
      underscored: true
    }
  }
)

const initModels = require('./models')

const models = initModels(sequelize)

/** 若数据库不存在则自动创建（适用于全新安装的 MySQL） */
const ensureDatabase = async () => {
  const bootstrap = new Sequelize('', MYSQL_CONF.username, MYSQL_CONF.password, {
    host: MYSQL_CONF.host,
    port: MYSQL_CONF.port,
    dialect: MYSQL_CONF.dialect,
    logging: false
  })
  const dbName = MYSQL_CONF.database
  await bootstrap.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  )
  await bootstrap.close()
}

const connectDB = async () => {
  try {
    await ensureDatabase()
    await sequelize.authenticate()
    await sequelize.sync()
    console.log('MySQL connect success')
  } catch (err) {
    console.error('MySQL connect failed:', err)
    throw err
  }
}

module.exports = {
  sequelize,
  connectDB,
  ...models
}
