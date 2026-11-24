import { QueryTypes, type Sequelize } from 'sequelize'

type BudgetRow = {
  id: string
  bill_id: string
  date: number
  total_budget: number | string
}

type DetailRow = {
  id: string
  budget_id: string
  cost_type_id: string
  budget: number | string
}

const round2 = (value: number) => Number(value.toFixed(2))

const moneyOf = (value: number | string) => round2(Number(value) || 0)

/**
 * 模型里不声明唯一索引，避免 sequelize.sync() 在清重复前抢先 ALTER 失败。
 * 先丢掉非法年份脏数据，再合并可安全去重的行，冲突则阻止启动，最后幂等创建唯一索引。
 */
const ensureBudgetSchema = async (db: Sequelize) => {
  const hasIndex = async (table: string, name: string) => {
    const rows = await db.query(`SHOW INDEX FROM \`${table}\` WHERE Key_name = :name`, {
      replacements: { name },
      type: QueryTypes.SELECT
    })
    return Array.isArray(rows) && rows.length > 0
  }

  // 旧逻辑曾写出 date=0 等非法年份；预算年份只允许 1971-9999
  await db.query(
    `DELETE d FROM bill_budget_details d
     INNER JOIN bill_budgets b ON b.id = d.budget_id
     WHERE b.date < 1971 OR b.date > 9999`
  )
  await db.query('DELETE FROM bill_budgets WHERE date < 1971 OR date > 9999')

  const yearDupes = (await db.query(
    `SELECT bill_id, date, COUNT(*) AS cnt
     FROM bill_budgets
     GROUP BY bill_id, date
     HAVING COUNT(*) > 1`,
    { type: QueryTypes.SELECT }
  )) as Array<{ bill_id: string; date: number; cnt: number }>

  for (const group of yearDupes) {
    const rows = (await db.query(
      `SELECT id, bill_id, date, total_budget
       FROM bill_budgets
       WHERE bill_id = :billId AND date = :year
       ORDER BY id ASC`,
      {
        replacements: { billId: group.bill_id, year: group.date },
        type: QueryTypes.SELECT
      }
    )) as BudgetRow[]
    const keep = rows[0]
    const budgets = rows.map((row) => moneyOf(row.total_budget))
    const sameBudget = budgets.every((value) => value === budgets[0])
    if (!sameBudget) {
      throw new Error(
        `预算年度重复且 totalBudget 冲突：billId=${group.bill_id}, year=${group.date}, ids=${rows
          .map((row) => `${row.id}:${moneyOf(row.total_budget)}`)
          .join(',')}`
      )
    }
    for (const drop of rows.slice(1)) {
      await db.query(`UPDATE bill_budget_details SET budget_id = :keepId WHERE budget_id = :dropId`, {
        replacements: { keepId: keep.id, dropId: drop.id }
      })
      await db.query(`DELETE FROM bill_budgets WHERE id = :id`, {
        replacements: { id: drop.id }
      })
    }
  }

  const detailDupes = (await db.query(
    `SELECT budget_id, cost_type_id, COUNT(*) AS cnt
     FROM bill_budget_details
     GROUP BY budget_id, cost_type_id
     HAVING COUNT(*) > 1`,
    { type: QueryTypes.SELECT }
  )) as Array<{ budget_id: string; cost_type_id: string; cnt: number }>

  for (const group of detailDupes) {
    const rows = (await db.query(
      `SELECT d.id, d.budget_id, d.cost_type_id, d.budget, b.bill_id, b.date
       FROM bill_budget_details d
       INNER JOIN bill_budgets b ON b.id = d.budget_id
       WHERE d.budget_id = :budgetId AND d.cost_type_id = :costTypeId
       ORDER BY d.id ASC`,
      {
        replacements: { budgetId: group.budget_id, costTypeId: group.cost_type_id },
        type: QueryTypes.SELECT
      }
    )) as Array<DetailRow & { bill_id: string; date: number }>
    const budgets = rows.map((row) => moneyOf(row.budget))
    const sameBudget = budgets.every((value) => value === budgets[0])
    if (!sameBudget) {
      throw new Error(
        `预算明细重复且 budget 冲突：billId=${rows[0]?.bill_id}, year=${rows[0]?.date}, costTypeId=${
          group.cost_type_id
        }, ids=${rows.map((row) => `${row.id}:${moneyOf(row.budget)}`).join(',')}`
      )
    }
    for (const drop of rows.slice(1)) {
      await db.query(`DELETE FROM bill_budget_details WHERE id = :id`, {
        replacements: { id: drop.id }
      })
    }
  }

  const mismatches = (await db.query(
    `SELECT b.id, b.bill_id, b.date, b.total_budget,
            COALESCE(SUM(d.budget), 0) AS detail_sum
     FROM bill_budgets b
     LEFT JOIN bill_budget_details d ON d.budget_id = b.id
     GROUP BY b.id, b.bill_id, b.date, b.total_budget
     HAVING ROUND(b.total_budget, 2) <> ROUND(COALESCE(SUM(d.budget), 0), 2)`,
    { type: QueryTypes.SELECT }
  )) as Array<{
    id: string
    bill_id: string
    date: number
    total_budget: number | string
    detail_sum: number | string
  }>
  if (mismatches.length) {
    const sample = mismatches
      .slice(0, 5)
      .map(
        (row) =>
          `billId=${row.bill_id}, year=${row.date}, budgetId=${row.id}, totalBudget=${moneyOf(
            row.total_budget
          )}, detailSum=${moneyOf(row.detail_sum)}`
      )
      .join('; ')
    throw new Error(`预算总额与明细之和不一致，已阻止创建唯一索引：${sample}`)
  }

  if (!(await hasIndex('bill_budgets', 'idx_bill_budgets_bill_date_unique'))) {
    await db.query(
      'ALTER TABLE `bill_budgets` ADD UNIQUE KEY `idx_bill_budgets_bill_date_unique` (`bill_id`, `date`)'
    )
  }
  if (!(await hasIndex('bill_budget_details', 'idx_bill_budget_details_budget_type_unique'))) {
    await db.query(
      'ALTER TABLE `bill_budget_details` ADD UNIQUE KEY `idx_bill_budget_details_budget_type_unique` (`budget_id`, `cost_type_id`)'
    )
  }
}

export { ensureBudgetSchema }
