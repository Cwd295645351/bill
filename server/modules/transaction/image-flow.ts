import { uploadImage, getImageFile } from './image-service'
import { readBillRole } from '../access'


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
  const role = await readBillRole(userId, billId)
  if (role.kind !== 'member') return ['未找到账本', null]
  return uploadImage({ file, billId, userId })
}

// 按签名打开照片
export const openTransactionImage = async (query: {
  id?: string | string[]
  exp?: string | string[]
  sig?: string | string[]
}) => getImageFile(query)
