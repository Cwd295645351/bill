/**
 * MongoDB -> MySQL 一次性迁移脚本
 *
 * 使用方式：
 * 1) 确保 MySQL 已创建数据库，并配置好 server/config/db.js 的 MYSQL_CONF
 * 2) 确保 MongoDB 旧库可访问（server/config/db.js 的 MONGODB_CONF）
 * 3) 执行：pnpm -C server run migrate
 *
 * 说明：
 * - MySQL 使用 Sequelize 定义的表结构（server/database/models/index.js）
 * - 主键全部使用 UUID（由 Sequelize 默认生成）。
 *   当前项目接口普遍用 id 作为字符串主键，迁移后以 MySQL UUID 为准。
 */

// mongodb@7 依赖 globalThis.crypto，Node 18 需手动挂载 webcrypto
const nodeCrypto = require('crypto')
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = nodeCrypto.webcrypto
}

const { MongoClient } = require('mongodb')
const CONF = require('../config/db')
const { toTimestamp } = require('../utils/dateUtil')
const { sequelize } = require('../database/index')
const initModels = require('../database/models')

const models = initModels(sequelize)

const toStr = (v) => (v === undefined || v === null ? '' : String(v))

/** MongoDB 部分字段可能是对象而非数组，统一转为数组 */
const asArray = (val) => {
  if (val == null) return []
  if (Array.isArray(val)) return val
  if (typeof val === 'object') return Object.values(val)
  return []
}

const toBool = (v) => Boolean(v)

const toNumber = (v, def = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

const connectMongo = async () => {
  const url = `mongodb://${CONF.MONGODB_CONF.host}:${CONF.MONGODB_CONF.port}`
  const client = new MongoClient(url)
  await client.connect()
  return client
}

/** 按候选名解析 MongoDB 集合（Mongoose 默认复数/小写，如 transactions、assetrecords） */
const resolveCollection = async (db, candidates) => {
  const existing = (await db.listCollections().toArray()).map((c) => c.name)
  const lowerMap = new Map(existing.map((n) => [n.toLowerCase(), n]))
  for (const name of candidates) {
    if (existing.includes(name)) return db.collection(name)
    const hit = lowerMap.get(name.toLowerCase())
    if (hit) return db.collection(hit)
  }
  return db.collection(candidates[0])
}

/** 分批 bulkCreate，避免单次插入过多 */
const bulkCreateInBatches = async (model, rows, options, batchSize = 500) => {
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize)
    // eslint-disable-next-line no-await-in-loop
    await model.bulkCreate(chunk, options)
  }
}

const clearMySQL = async (tx) => {
  // 先清空所有表（按依赖关系倒序）
  const order = [
    'bill_budget_details',
    'bill_budgets',
    'bill_plan_buys',
    'bill_pay_methods',
    'bill_income_types',
    'bill_cost_types',
    'bill_users',
    'bills',
    'asset_records',
    'assets',
    'members',
    'transactions',
    'encryptions',
    'users'
  ]

  for (const table of order) {
    // TRUNCATE 在部分环境需要额外权限，这里用 DELETE
    // 表名固定写死，不接受外部输入，避免注入风险
    // eslint-disable-next-line no-await-in-loop
    await sequelize.query(`DELETE FROM ${table}`, { transaction: tx })
  }
}

const migrateUsers = async (db, tx, idMaps) => {
  const col = db.collection('users')
  const docs = await col.find({}).toArray()
  if (!docs.length) return

  const inserted = await models.User.bulkCreate(
    docs.map((d) => ({
      username: toStr(d.username),
      password: toStr(d.password),
      nickName: toStr(d.nickName),
      avatarUrl: toStr(d.avatarUrl || ''),
      incomes: toNumber(d.incomes, 0),
      expenses: toNumber(d.expenses, 0),
      isDel: toBool(d.isDel)
    })),
    { transaction: tx, returning: true }
  )
  docs.forEach((d, idx) => idMaps.user.set(toStr(d._id), inserted[idx].id))
}

const migrateEncryptions = async (db, tx) => {
  const col = db.collection('encryptions')
  const docs = await col.find({}).toArray()
  if (!docs.length) return

  await models.Encryption.bulkCreate(
    docs.map((d) => ({
      privateKey: toStr(d.privateKey),
      publicKey: toStr(d.publicKey)
    })),
    { transaction: tx }
  )
}

const migrateBills = async (db, tx, idMaps) => {
  const col = db.collection('bills')
  const docs = await col.find({}).toArray()
  if (!docs.length) return

  // bills 主表
  const billRows = docs.map((d) => ({
    name: toStr(d.name),
    creator: idMaps.user.get(toStr(d.creator)) || toStr(d.creator),
    planBuyCount: toNumber(d?.planBuy?.count, 0),
    isDel: toBool(d.isDel)
  }))

  const insertedBills = await models.Bill.bulkCreate(billRows, { transaction: tx, returning: true })

  // 建立 legacyId -> newUUID 的映射
  docs.forEach((d, idx) => {
    idMaps.bill.set(toStr(d._id), insertedBills[idx].id)
  })

  // bill_users / costTypes / incomesTypes / payMethods / planBuy / budgets
  const billUsers = []
  const costTypes = []
  const incomesTypes = []
  const payMethods = []
  const planBuys = []
  const budgets = []
  const budgetDetails = []

  docs.forEach((d) => {
    const newBillId = idMaps.bill.get(toStr(d._id))
    asArray(d.users).forEach((u) => {
      const legacyUserId = toStr(u.id)
      billUsers.push({
        billId: newBillId,
        userId: idMaps.user.get(legacyUserId) || legacyUserId,
        userName: toStr(u.name)
      })
    })
    asArray(d.costTypes).forEach((c) => {
      costTypes.push({ id: toStr(c.id), billId: newBillId, name: toStr(c.name), isDel: toBool(c.isDel) })
    })
    asArray(d.incomesTypes).forEach((c) => {
      incomesTypes.push({ id: toStr(c.id), billId: newBillId, name: toStr(c.name), isDel: toBool(c.isDel) })
    })
    asArray(d.payMethods).forEach((c) => {
      payMethods.push({ id: toStr(c.id), billId: newBillId, name: toStr(c.name), isDel: toBool(c.isDel) })
    })
    asArray(d?.planBuy?.details).forEach((p) => {
      planBuys.push({
        billId: newBillId,
        title: toStr(p.title),
        context: toStr(p.context),
        priority: toNumber(p.priority, 0),
        isBuy: toBool(p.isBuy),
        isDel: toBool(p.isDel)
      })
    })
    asArray(d.budget).forEach((b) => {
      budgets.push({
        billId: newBillId,
        date: toNumber(b.date, 0),
        totalBudget: toNumber(b.totalBudget, 0),
        currCost: toNumber(b.currCost, 0),
        _legacy: { details: asArray(b.details) }
      })
    })
  })

  if (billUsers.length) await models.BillUser.bulkCreate(billUsers, { transaction: tx })
  if (costTypes.length) await models.BillCostType.bulkCreate(costTypes, { transaction: tx })
  if (incomesTypes.length) await models.BillIncomeType.bulkCreate(incomesTypes, { transaction: tx })
  if (payMethods.length) await models.BillPayMethod.bulkCreate(payMethods, { transaction: tx })
  if (planBuys.length) await models.BillPlanBuy.bulkCreate(planBuys, { transaction: tx })

  if (budgets.length) {
    const budgetToInsert = budgets.map((b) => {
      const copy = { ...b }
      delete copy._legacy
      return copy
    })
    const insertedBudgets = await models.BillBudget.bulkCreate(budgetToInsert, { transaction: tx, returning: true })
    insertedBudgets.forEach((row, idx) => {
      const legacyDetails = budgets[idx]._legacy.details || []
      legacyDetails.forEach((d) => {
        budgetDetails.push({
          budgetId: row.id,
          costTypeId: toStr(d.costTypeId),
          costTypeName: toStr(d.costTypeName),
          budget: toNumber(d.budget, 0),
          cost: toNumber(d.cost, 0)
        })
      })
    })
  }
  if (budgetDetails.length) await models.BillBudgetDetail.bulkCreate(budgetDetails, { transaction: tx })
}

const migrateMembers = async (db, tx, idMaps) => {
  const col = db.collection('members')
  const docs = await col.find({}).toArray()
  if (!docs.length) return

  const rows = docs.map((d) => ({
    billId: idMaps.bill.get(toStr(d.billId)) || null,
    name: toStr(d.name),
    isDel: toBool(d.isDel)
  }))
  const inserted = await models.Member.bulkCreate(rows, { transaction: tx, returning: true })
  docs.forEach((d, idx) => idMaps.member.set(toStr(d._id), inserted[idx].id))
}

const migrateAssets = async (db, tx, idMaps) => {
  const col = db.collection('assets')
  const docs = await col.find({}).toArray()
  if (!docs.length) return

  const rows = docs.map((d) => ({
    name: toStr(d.name),
    billId: idMaps.bill.get(toStr(d.billId)) || null,
    memberId: idMaps.member.get(toStr(d.memberId)) || null,
    type: toStr(d.type),
    fourMoneyType: toStr(d.fourMoneyType),
    isDebt: toBool(d.isDebt),
    latestAmount: toNumber(d.latestAmount, 0),
    insuranceCategory: d.insuranceCategory ? toStr(d.insuranceCategory) : null,
    annualPremium: d.annualPremium === undefined ? 0 : toNumber(d.annualPremium, 0),
    lastUpdatedDate: d.lastUpdatedDate ? Number(d.lastUpdatedDate) : null,
    isDel: toBool(d.isDel)
  }))

  const inserted = await models.Asset.bulkCreate(rows, { transaction: tx, returning: true })
  docs.forEach((d, idx) => idMaps.asset.set(toStr(d._id), inserted[idx].id))
}

const migrateAssetRecords = async (db, tx, idMaps) => {
  const col = await resolveCollection(db, ['assetrecords', 'assetRecords'])
  const docs = await col.find({}).toArray()
  if (!docs.length) {
    console.log('asset_records: 0 条（MongoDB 无数据）')
    return
  }

  const rows = docs.map((d) => ({
    assetId: idMaps.asset.get(toStr(d.assetId)) || null,
    amount: toNumber(d.amount, 0),
    date: toNumber(d.date, Date.now()),
    isDel: toBool(d.isDel)
  }))

  await bulkCreateInBatches(models.AssetRecord, rows, { transaction: tx })
  console.log(`asset_records: ${rows.length} 条`)
}

const migrateTransactions = async (db, tx, idMaps) => {
  const col = await resolveCollection(db, ['transactions', 'transaction'])
  const docs = await col.find({}).toArray()
  if (!docs.length) {
    console.log('transactions: 0 条（MongoDB 无数据，请检查集合名是否为 transactions）')
    return
  }

  const rows = docs.map((d) => ({
    billId: idMaps.bill.get(toStr(d.billId)) || toStr(d.billId),
    userId: idMaps.user.get(toStr(d.userId)) || toStr(d.userId),
    date: toTimestamp(d.date) || 0,
    type: toNumber(d.type, 1),
    costTypeId: d.costTypeId ? toStr(d.costTypeId) : null,
    costTypeName: d.costTypeName ? toStr(d.costTypeName) : null,
    payMethodId: d.payMethodId ? toStr(d.payMethodId) : null,
    payMethodName: d.payMethodName ? toStr(d.payMethodName) : null,
    reimbursement: d.reimbursement === undefined ? null : toNumber(d.reimbursement, 0),
    incomesTypeId: d.incomesTypeId ? toStr(d.incomesTypeId) : null,
    incomesTypeName: d.incomesTypeName ? toStr(d.incomesTypeName) : null,
    belongUserId: d.belongUserId
      ? idMaps.user.get(toStr(d.belongUserId)) || toStr(d.belongUserId)
      : null,
    belongUserName: d.belongUserName ? toStr(d.belongUserName) : null,
    remark: d.remark ? toStr(d.remark) : null,
    money: toNumber(d.money, 0),
    isDel: toBool(d.isDel)
  }))

  await bulkCreateInBatches(models.Transaction, rows, { transaction: tx })
  console.log(`transactions: ${rows.length} 条`)
}

async function main() {
  const mongoClient = await connectMongo()
  const db = mongoClient.db(CONF.MONGODB_CONF.dbName)

  await sequelize.authenticate()
  // 强制按最新模型重建表（会清空 MySQL 中已有表结构）
  await sequelize.sync({ force: true })

  const idMaps = {
    user: new Map(),
    bill: new Map(),
    member: new Map(),
    asset: new Map()
  }

  const tx = await sequelize.transaction()
  try {
    await clearMySQL(tx)

    await migrateUsers(db, tx, idMaps)
    await migrateEncryptions(db, tx)
    await migrateBills(db, tx, idMaps)
    await migrateMembers(db, tx, idMaps)
    await migrateAssets(db, tx, idMaps)
    await migrateAssetRecords(db, tx, idMaps)
    await migrateTransactions(db, tx, idMaps)

    await tx.commit()
    console.log('迁移完成')
  } catch (e) {
    await tx.rollback()
    console.error('迁移失败：', e)
    process.exitCode = 1
  } finally {
    await mongoClient.close()
    await sequelize.close()
  }
}

main()
