import { QueryTypes, type Sequelize } from 'sequelize'

/**
 * sequelize.sync() 不会给已有的 assets 加列。
 * 补上币种，并把四笔钱改为可空。可重复执行。
 * 不清理历史上仍带着四笔钱的负债。
 */
const ensureAssetSchema = async (db: Sequelize) => {
  const columns = await db.query("SHOW COLUMNS FROM assets LIKE 'currency'", { type: QueryTypes.SELECT })
  const list = Array.isArray(columns) ? columns : []
  if (!list.length) {
    await db.query("ALTER TABLE assets ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'CNY'")
  }
  await db.query('ALTER TABLE assets MODIFY COLUMN four_money_type VARCHAR(32) NULL')

  const channelColumns = await db.query("SHOW COLUMNS FROM assets LIKE 'channel'", { type: QueryTypes.SELECT })
  if (!(Array.isArray(channelColumns) && channelColumns.length)) {
    await db.query('ALTER TABLE assets ADD COLUMN channel VARCHAR(64) NULL')
  }

  const cycleColumns = await db.query("SHOW COLUMNS FROM assets LIKE 'turnaround_cycle'", { type: QueryTypes.SELECT })
  const cycleColumn = Array.isArray(cycleColumns) ? cycleColumns[0] as { Type?: string } : undefined
  if (!cycleColumn) {
    await db.query("ALTER TABLE assets ADD COLUMN turnaround_cycle VARCHAR(16) NOT NULL DEFAULT 'T+0'")
  } else {
    const match = /varchar\((\d+)\)/i.exec(cycleColumn.Type || '')
    if (!match || Number(match[1]) < 16) {
      await db.query("ALTER TABLE assets MODIFY COLUMN turnaround_cycle VARCHAR(16) NOT NULL DEFAULT 'T+0'")
    }
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS \`bill_overview_rule_years\` (
      \`id\` CHAR(36) NOT NULL,
      \`bill_id\` CHAR(36) NOT NULL,
      \`rule_id\` CHAR(36) NOT NULL,
      \`year\` INT NOT NULL,
      \`quantity\` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
      \`belong_user_id\` CHAR(36) NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`idx_rule_year_unique\` (\`rule_id\`, \`year\`),
      KEY \`idx_rule_years_bill_year\` (\`bill_id\`, \`year\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
}

export { ensureAssetSchema }
