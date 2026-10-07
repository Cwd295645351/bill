const redisStore = require('koa-redis')
const { v4: uuidv4 } = require('uuid')
const { REDIS_CONF } = require('../config/db')

// 与 session 共用同一个 koa-redis 实例，避免再开一条连接
const store = redisStore({
  all: `${REDIS_CONF.host}:${REDIS_CONF.port}`
})

const client = store.client

const BIND_PREFIX = 'bill:wxbind:'
const BIND_TTL = 300

/** 签发绑定临时凭证，5 分钟内有效，值为 openid */
const createBindTicket = async (openid) => {
  const ticket = uuidv4()
  await client.set(`${BIND_PREFIX}${ticket}`, openid, 'EX', BIND_TTL)
  return ticket
}

/** 读取凭证对应的 openid，不删除 */
const peekBindTicket = async (ticket) => {
  if (!ticket) return null
  const openid = await client.get(`${BIND_PREFIX}${ticket}`)
  return openid || null
}

/** 取出并删除凭证，防止重复绑定 */
const consumeBindTicket = async (ticket) => {
  if (!ticket) return null
  const key = `${BIND_PREFIX}${ticket}`
  const openid = await client.get(key)
  if (openid) await client.del(key)
  return openid || null
}

module.exports = {
  store,
  client,
  createBindTicket,
  peekBindTicket,
  consumeBindTicket
}
