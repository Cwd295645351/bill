import { QueryTypes, type Sequelize } from 'sequelize'
import * as InitData from './initDatas'

/**
 * sequelize.sync() 不会给已有 users/bills 加列，也不会删列。
 * 补 created_at、去掉已无用的 plan_buy_count、建审计表与默认类型表，空表时用 initDatas 灌种子。可重复执行。
 */
const ensureAdminSchema = async (db: Sequelize) => {
  const addNullableCreatedAt = async (table: string) => {
    const columns = await db.query(`SHOW COLUMNS FROM \`${table}\` LIKE 'created_at'`, {
      type: QueryTypes.SELECT
    })
    if (!(Array.isArray(columns) && columns.length)) {
      await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`created_at\` DATETIME NULL`)
    }
  }

  await addNullableCreatedAt('users')
  await addNullableCreatedAt('bills')

  const planBuyCount = await db.query(`SHOW COLUMNS FROM \`bills\` LIKE 'plan_buy_count'`, {
    type: QueryTypes.SELECT
  })
  if (Array.isArray(planBuyCount) && planBuyCount.length) {
    await db.query('ALTER TABLE `bills` DROP COLUMN `plan_buy_count`')
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS \`ai_call_audits\` (
      \`id\` CHAR(36) NOT NULL,
      \`user_id\` CHAR(36) NOT NULL,
      \`bill_id\` CHAR(36) NOT NULL,
      \`capability\` VARCHAR(64) NOT NULL,
      \`upstream_requested\` TINYINT(1) NOT NULL,
      \`outcome\` VARCHAR(16) NOT NULL,
      \`error_category\` VARCHAR(64) NOT NULL,
      \`duration_ms\` INT NOT NULL,
      \`prompt_tokens\` INT NULL,
      \`completion_tokens\` INT NULL,
      \`total_tokens\` INT NULL,
      \`daily_count\` INT NULL,
      \`created_at\` DATETIME NOT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`idx_ai_call_audits_created_at\` (\`created_at\`),
      KEY \`idx_ai_call_audits_user_created\` (\`user_id\`, \`created_at\`),
      KEY \`idx_ai_call_audits_bill_created\` (\`bill_id\`, \`created_at\`),
      KEY \`idx_ai_call_audits_outcome_created\` (\`outcome\`, \`created_at\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS \`catalog_defaults\` (
      \`kind\` VARCHAR(16) NOT NULL,
      \`id\` VARCHAR(32) NOT NULL,
      \`name\` VARCHAR(64) NOT NULL,
      \`is_del\` TINYINT(1) NOT NULL DEFAULT 0,
      PRIMARY KEY (\`kind\`, \`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)

  const countRows = await db.query('SELECT COUNT(*) AS c FROM `catalog_defaults`', {
    type: QueryTypes.SELECT
  })
  const count = Number((countRows[0] as { c?: number | string } | undefined)?.c || 0)
  if (count === 0) {
    const rows: Array<{ kind: string; id: string; name: string; is_del: number }> = []
    for (const item of InitData.costTypes) {
      rows.push({ kind: 'cost', id: String(item.id), name: String(item.name), is_del: 0 })
    }
    for (const item of InitData.incomesTypes) {
      rows.push({ kind: 'income', id: String(item.id), name: String(item.name), is_del: 0 })
    }
    for (const item of InitData.payMethods) {
      rows.push({ kind: 'pay_method', id: String(item.id), name: String(item.name), is_del: 0 })
    }
    for (const row of rows) {
      await db.query(
        'INSERT INTO `catalog_defaults` (`kind`, `id`, `name`, `is_del`) VALUES (?, ?, ?, ?)',
        { replacements: [row.kind, row.id, row.name, row.is_del] }
      )
    }
  }
}

export { ensureAdminSchema }
