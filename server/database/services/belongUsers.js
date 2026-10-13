/**
 * 记账归属人名单的存取、校验与筛选。
 * 数据库仍用 belong_user_id / belong_user_name 两列：
 * 「全部」存 '' / '全部'，单人存 id / 名字，多人存按 bill_users.id 升序的逗号拼接 id 和「、」拼接名字。
 * 接口上统一用 belongUserIds: string[]。
 */
const { Op } = require('sequelize')

/** 延迟加载数据库模块：纯计算的 overviewSettlement 也引用本文件，不能因此连库 */
const db = () => require('../index')

const BELONG_ID_SEPARATOR = ','
const BELONG_NAME_SEPARATOR = '、'
const MAX_BELONG_ID_LENGTH = 1024
const MAX_BELONG_NAME_LENGTH = 2048
const PUBLIC_BELONG_NAME = '全部'
const OUTDATED_CLIENT_MESSAGE = '当前版本过旧，请更新后再记账'

const hasOwn = (data, key) => Object.prototype.hasOwnProperty.call(data || {}, key)

/** 空归属视为「全部」 */
const isPublicBelong = (belongUserId) => belongUserId == null || belongUserId === ''

/** 归属多名成员时，id 串里含分隔符 */
const isMultiBelong = (belongUserId) => typeof belongUserId === 'string' && belongUserId.includes(BELONG_ID_SEPARATOR)

/**
 * 把数据库里的归属人 id 串拆成名单。
 * @param {string|null|undefined} belongUserId
 * @returns {string[]} 「全部」为空数组
 */
const splitBelongIds = (belongUserId) => (isPublicBelong(belongUserId) ? [] : String(belongUserId).split(BELONG_ID_SEPARATOR))

/**
 * 读取账本成员，顺序固定为 bill_users.id 升序，与概览结算一致。
 * @param {string} billId
 * @returns {Promise<Array<{userId: string, userName: string}>>}
 */
const loadOrderedMembers = async (billId) => {
  const rows = await db().BillUser.findAll({ where: { billId }, order: [['id', 'ASC']] })
  return rows.map((row) => ({ userId: row.userId, userName: row.userName }))
}

/**
 * 校验请求里的归属人名单，并换算成要写入数据库的两列。
 * @param {object} data 请求体，读取 belongUserIds；只带旧字段 belongUserId 时视为旧客户端
 * @param {number|string} type 收支类型，2 为收入
 * @param {Array<{userId: string, userName: string}>} members 账本成员，已按 bill_users.id 升序
 * @returns {[string|null, {belongUserId: string, belongUserName: string}|null]} 失败时第一项为提示文案
 */
const resolveBelongUsers = (data, type, members) => {
  if (!hasOwn(data, 'belongUserIds') && hasOwn(data, 'belongUserId')) return [OUTDATED_CLIENT_MESSAGE, null]
  const ids = data ? data.belongUserIds : undefined
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || id === '')) return ['归属人列表无效', null]
  if (new Set(ids).size !== ids.length) return ['归属人不能重复', null]

  const picked = new Set(ids)
  const memberIds = new Set(members.map((member) => member.userId))
  if (ids.some((id) => !memberIds.has(id))) return ['归属人不是该账本成员', null]
  if (Number(type) === 2 && ids.length !== 1) return ['收入只能选一名归属人', null]

  if (!ids.length) return [null, { belongUserId: '', belongUserName: PUBLIC_BELONG_NAME }]
  const ordered = members.filter((member) => picked.has(member.userId))
  const belongUserId = ordered.map((member) => member.userId).join(BELONG_ID_SEPARATOR)
  const belongUserName = ordered.map((member) => member.userName).join(BELONG_NAME_SEPARATOR)
  if (belongUserId.length > MAX_BELONG_ID_LENGTH || belongUserName.length > MAX_BELONG_NAME_LENGTH) {
    return ['归属人过多', null]
  }
  return [null, { belongUserId, belongUserName }]
}

/**
 * 按归属人筛选的条件。成员 id 用 FIND_IN_SET 匹配，单人和多人都能命中；'' 表示归属「全部」的记账。
 * @param {string[]|undefined} belongUserIds 空或缺省表示不限归属人
 * @returns {object|null} 不限归属人时返回 null
 */
const buildBelongWhere = (belongUserIds) => {
  if (!Array.isArray(belongUserIds) || !belongUserIds.length) return null
  const { sequelize } = db()
  const conditions = []
  belongUserIds.forEach((id) => {
    if (id === '' || id == null) {
      conditions.push({ belongUserId: '' })
    } else {
      conditions.push(sequelize.where(sequelize.fn('FIND_IN_SET', String(id), sequelize.col('belong_user_id')), Op.gt, 0))
    }
  })
  return { [Op.or]: conditions }
}

/**
 * 接口响应里把 belongUserId 换成 belongUserIds。
 * @param {object} row 普通对象
 * @returns {object} 新对象，不含 belongUserId
 */
const toBelongResponse = (row) => {
  const { belongUserId, ...rest } = row
  return { ...rest, belongUserIds: splitBelongIds(belongUserId) }
}

module.exports = {
  BELONG_ID_SEPARATOR,
  BELONG_NAME_SEPARATOR,
  PUBLIC_BELONG_NAME,
  OUTDATED_CLIENT_MESSAGE,
  isPublicBelong,
  isMultiBelong,
  splitBelongIds,
  loadOrderedMembers,
  resolveBelongUsers,
  buildBelongWhere,
  toBelongResponse
}
