import type { HttpContext, Row, WhereBag } from '../../types/domain'
import { Transaction, User } from '../../database/index'
import { uploadImage, attachImages, markImagesUnviewableByTransaction, attachImagesToList, getImageFile, tryDeleteObject } from './image-service'
import { requireMember } from '../access'
import { loadOrderedMembers, resolveBelongUsers, buildBelongWhere, toBelongResponse } from './belong-users'
import { Op } from 'sequelize'
import dayjs from 'dayjs'
import { toTimestamp, yearFromTimestamp, formatDate } from '../../utils/dateUtil'
import { createXlsx } from '../../utils/xlsx'
import xlsx from 'node-xlsx'
import fs from 'fs'


// 上传一张照片（未挂接）
export const uploadTransactionImage = async ({
  file,
  billId,
  userId
}: {
  file?: { filepath?: string; size?: number } | null
  billId?: string | null
  userId?: string | null
}) => {
  const member = await requireMember(userId, billId)
  if (!member.ok) return ['未找到账本', null]
  return uploadImage({ file, billId, userId })
}

// 按签名打开照片
export const openTransactionImage = async (query: {
  id?: string | string[]
  exp?: string | string[]
  sig?: string | string[]
}) => getImageFile(query)
