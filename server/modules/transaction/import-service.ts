import type { Row } from '../../types/domain'
import { Transaction, User, sequelize } from '../../database/index'
import { billExists, listMembers } from '../bill'
import { loadTypeLists } from '../catalog'
import { requireMember } from '../access'
import { lockBill, loadBudgets, saveBudget } from '../budget'
import { readBookDate, readPositiveMoney, shiftBudgetSpend } from '../budget/spend'
import { yearFromTimestamp } from '../../utils/dateUtil'
import xlsx from 'node-xlsx'
import fs from 'fs'

const cellText = (value: string | number | null | undefined) => (value == null ? '' : String(value).trim())

const removeUpload = (filePath: string) => {
  try {
    fs.unlinkSync(filePath)
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') console.error(err)
  }
}

// 解析 excel 文件
export const getExcelObjs = async (filePath: string, billId: string, userId: string) => {
  try {
    const member = await requireMember(userId, billId)
    if (!member.ok) return ['不是该账本成员', null]
    if (!(await billExists(billId))) return ['未找到账本', null]
    const [types, users] = await Promise.all([loadTypeLists(billId), listMembers(billId)])
    const workbook = xlsx.parse(filePath)
    const sheet = workbook[0]
    if (!sheet) return ['导入失败', null]
    const xlsxData = sheet.data
    xlsxData.shift()

    const insertData: Row[] = []
    for (let index = 0; index < xlsxData.length; index++) {
      const cells = (xlsxData[index] || []) as (string | number | null | undefined)[]
      if (cells.every((cell) => cellText(cell) === '')) continue
      const costTypeName = cellText(cells[1])
      const costType = types.costTypes.find((ite: Row) => ite.name === costTypeName)
      if (!costType?.id) return [`第 ${index + 2} 行支出类型不存在`, null]
      const [dateErr, dateTs] = readBookDate(cells[0])
      if (dateErr || dateTs == null) return [`第 ${index + 2} 行${dateErr}`, null]
      const [moneyErr, money] = readPositiveMoney(cells[3])
      if (moneyErr || money == null) return [`第 ${index + 2} 行${moneyErr}`, null]
      const obj: Row = {
        billId: billId,
        userId: userId,
        date: dateTs,
        type: 1,
        costTypeId: costType.id,
        costTypeName,
        reimbursement: 0,
        belongUserId: '',
        belongUserName: cellText(cells[2]),
        money,
        remark: cellText(cells[4]),
        isDel: false
      }
      const belongUser = users.find((ite: Row) => ite.name === obj.belongUserName)
      if (belongUser) obj.belongUserId = belongUser.id
      const user = users.find((ite: Row) => ite.name === cellText(cells[5]))
      if (user) obj.userId = user.id
      insertData.push(obj)
    }
    if (!insertData.length) return ['没有可导入的数据', null]
    const tx = await sequelize.transaction()
    try {
      const locked = await lockBill(billId, tx)
      if (!locked) {
        await tx.rollback()
        return ['未找到账本', null]
      }
      const res = await Transaction.bulkCreate(insertData, { transaction: tx })
      if (!res) {
        await tx.rollback()
        return ['导入失败', null]
      }
      const budgets = await loadBudgets(billId, tx)
      const expenses = new Map<string, number>()
      insertData.forEach((row) => {
        shiftBudgetSpend(budgets, yearFromTimestamp(row.date as number), row.costTypeId, Number(row.money))
        const key = String(row.userId || '')
        if (!key) return
        expenses.set(key, (expenses.get(key) || 0) + Number(row.money))
      })
      await saveBudget(billId, budgets, tx)
      for (const [id, amount] of expenses) {
        await User.increment({ expenses: amount }, { where: { id }, transaction: tx })
      }
      await tx.commit()
      return [null, '导入成功']
    } catch (err: unknown) {
      await tx.rollback()
      console.error(err)
      return ['导入失败', null]
    }
  } catch (err: unknown) {
    console.error(err)
    return ['导入失败', null]
  } finally {
    removeUpload(filePath)
  }
}
