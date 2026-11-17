import type { Row, WhereBag } from '../../types/domain'
import { Transaction, User } from '../../database/index'
import { billExists, listMembers } from '../bill'
import { loadTypeLists } from '../catalog'
import { requireMember } from '../access'
import { uploadImage, attachImages, markImagesUnviewableByTransaction, attachImagesToList, getImageFile, tryDeleteObject, assertBillMember } from './image-service'
import { loadOrderedMembers, resolveBelongUsers, buildBelongWhere, toBelongResponse } from './belong-users'
import { Op } from 'sequelize'
import dayjs from 'dayjs'
import { toTimestamp, yearFromTimestamp, formatDate } from '../../utils/dateUtil'
import { createXlsx } from '../../utils/xlsx'
import xlsx from 'node-xlsx'
import fs from 'fs'


// 解析 excel 文件
export const getExcelObjs = async (filePath: string, billId: string, userId: string) => {
  const member = await requireMember(userId, billId)
  if (!member.ok) return ['不是该账本成员', null]
  if (!(await billExists(billId))) return ['未找到账本', null]
  const [types, users] = await Promise.all([loadTypeLists(billId), listMembers(billId)])
  const workbook = xlsx.parse(filePath)
  const xlsxData = workbook[0].data
  xlsxData.shift()

  const insertData = xlsxData.map((item) => {
    const cells = item as (string | number | null | undefined)[]
    const obj: Row = {
      billId: billId,
      userId: userId,
      date: toTimestamp(cells[0] ?? null),
      type: 1,
      costTypeId: '',
      costTypeName: cells[1] == null ? '' : String(cells[1]),
      reimbursement: 0,
      belongUserId: '',
      belongUserName: cells[2] == null ? '' : String(cells[2]),
      money: typeof cells[3] === 'number' || typeof cells[3] === 'string' ? cells[3] : '',
      remark: cells[4] == null ? '' : String(cells[4]),
      isDel: false
    }
    const costType = types.costTypes.find((ite: Row) => ite.name === obj.costTypeName)!
    obj.costTypeId = costType.id
    const belongUser = users.find((ite: Row) => ite.name === obj.belongUserName)
    if (belongUser) obj.belongUserId = belongUser.id
    const user = users.find((ite: Row) => ite.name === (cells[5] == null ? '' : String(cells[5])))
    if (user) obj.userId = user.id
    return obj
  })
  const res = await Transaction.bulkCreate(insertData)
  fs.unlinkSync(filePath) // 删除文件
  if (res) return [null, '导入成功']
  return ['导出失败', null]
}

