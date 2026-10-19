import type { Row } from '../../types/domain'
import type { HttpContext } from '../../types/domain'
import fs from 'fs'
import crypto from 'crypto'
import OSS from 'ali-oss'
import { v4 as uuidv4 } from 'uuid'
import { Op } from 'sequelize'
import { TransactionImage, Transaction, BillUser } from '../index'
import VERSION from '../../config/version'

const MAX_IMAGE_SIZE = 10485760
const VIEW_URL_TTL_SEC = 2 * 60 * 60
const ALLOWED_CONTENT_TYPES: Record<string, boolean> = {
  'image/jpeg': true,
  'image/png': true,
  'image/gif': true,
  'image/webp': true
}

/** 根据文件头识别图片类型，不信任扩展名 */
const detectImageType = (buf: Buffer | null | undefined) => {
  if (!buf || buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif'
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'image/webp'
  }
  return null
}

const getOssConfig = () => {
  const region = process.env.OSS_REGION
  const bucket = process.env.OSS_BUCKET
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET
  if (!region || !bucket || !accessKeyId || !accessKeySecret) {
    return null
  }
  return { region, bucket, accessKeyId, accessKeySecret }
}

const getUrlSecret = () => process.env.OSS_URL_SECRET || ''

const createOssClient = () => {
  const conf = getOssConfig()
  if (!conf) return null
  // 强制 HTTPS；默认 http/80 在部分网络下会 socket hang up
  return new OSS({ ...conf, secure: true })
}

/** 对 id 与 exp 做 HMAC 签名，供短期查看地址使用 */
const signViewParams = (id: string, exp: string | number) => {
  const secret = getUrlSecret()
  if (!secret) return ''
  return crypto.createHmac('sha256', secret).update(`${id}.${exp}`).digest('hex')
}

const verifyViewSignature = (id: string, exp: string | number, sig: string) => {
  if (!id || !exp || !sig) return false
  const expected = signViewParams(id, String(exp))
  if (!expected) return false
  const a = Buffer.from(String(sig))
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/** 生成指向本服务的短期查看地址，不含 object_key 与对象存储密钥 */
const buildViewUrl = (ctx: HttpContext, imageId: string) => {
  const exp = Math.floor(Date.now() / 1000) + VIEW_URL_TTL_SEC
  const sig = signViewParams(imageId, exp)
  const proto = ctx.request.header['x-forwarded-proto'] || ctx.request.protocol || 'https'
  const host = ctx.request.header['x-forwarded-host'] || ctx.request.host
  return `${proto}://${host}/api/${VERSION}/transaction/image/file?id=${encodeURIComponent(
    imageId
  )}&exp=${exp}&sig=${encodeURIComponent(sig)}`
}

/** 校验调用者是否为该账本成员 */
const assertBillMember = async (billId: string | null | undefined, userId: string | null | undefined) => {
  if (!billId || !userId) return false
  const link = await BillUser.findOne({ where: { billId, userId } })
  return !!link
}

/**
 * 上传一张照片到私有桶，写入未挂接行
 * @returns {[string|null, {id:string}|null]}
 */
const uploadImage = async ({
  file,
  billId,
  userId
}: {
  file?: { filepath?: string; size?: number } | null
  billId?: string | null
  userId?: string | null
}) => {
  if (!file || !file.filepath) return ['照片没有保存成功', null]
  const size = Number(file.size || 0)
  if (!size || size > MAX_IMAGE_SIZE) return ['单张照片不能超过 10MB', null]

  let buf
  try {
    buf = fs.readFileSync(file.filepath)
  } catch (e: unknown) {
    console.error('读取上传照片失败', e)
    return ['照片没有保存成功', null]
  }

  if (buf.length > MAX_IMAGE_SIZE) return ['单张照片不能超过 10MB', null]
  const contentType = detectImageType(buf)
  if (!contentType || !ALLOWED_CONTENT_TYPES[contentType]) {
    return ['无法当作照片打开', null]
  }

  const client = createOssClient()
  if (!client) {
    console.error('OSS 配置缺失')
    return ['照片没有保存成功', null]
  }

  const id = uuidv4()
  const ext = contentType === 'image/jpeg' ? 'jpg' : contentType.split('/')[1]
  const objectKey = `transaction-images/${billId}/${id}.${ext}`

  try {
    await client.put(objectKey, buf, {
      headers: { 'Content-Type': contentType }
    })
  } catch (e: unknown) {
    console.error('OSS 上传失败', e)
    return ['照片没有保存成功', null]
  }

  try {
    await TransactionImage.create({
      id,
      billId,
      transactionId: null,
      userId,
      objectKey,
      sort: 0,
      size: buf.length,
      contentType,
      viewable: true,
      createdAt: new Date()
    })
  } catch (e: unknown) {
    console.error('写入 transaction_images 失败', e)
    try {
      await client.delete(objectKey)
    } catch (delErr: unknown) {
      console.error('回滚删除 OSS 对象失败', delErr)
    }
    return ['照片没有保存成功', null]
  } finally {
    try {
      fs.unlinkSync(file.filepath)
    } catch (_: unknown) {
      /* 临时文件清理失败可忽略 */
    }
  }

  return [null, { id }]
}

/** 尽力删除对象存储中的文件，失败只记日志 */
const tryDeleteObject = async (objectKey: string | null | undefined) => {
  if (!objectKey) return
  const client = createOssClient()
  if (!client) return
  try {
    await client.delete(objectKey)
  } catch (e: unknown) {
    console.error('删除 OSS 对象失败', objectKey, e)
  }
}

/**
 * 将照片挂到一笔记账上（替换规则）
 * 不传 imageIds 表示调用方未请求改照片，本函数不应被调用
 */
const attachImages = async ({
  transactionId,
  billId,
  userId,
  imageIds,
  sequelizeTx
}: {
  transactionId?: string | null
  billId?: string | null
  userId?: string | null
  imageIds?: unknown
  sequelizeTx?: unknown
}) => {
  if (!Array.isArray(imageIds)) {
    throw new Error('imageIds 必须是数组')
  }
  if (imageIds.length > 9) {
    throw new Error('一笔最多附 9 张照片')
  }

  // 去重校验：不允许重复 id
  const unique = new Set(imageIds)
  if (unique.size !== imageIds.length) {
    throw new Error('照片列表无效')
  }

  for (let i = 0; i < imageIds.length; i++) {
    const imageId = imageIds[i]
    const row = await TransactionImage.findOne({
      where: { id: imageId },
      transaction: sequelizeTx
    })
    if (!row) throw new Error('照片列表无效')
    if (String(row.billId) !== String(billId)) throw new Error('照片列表无效')
    if (String(row.userId) !== String(userId)) throw new Error('照片列表无效')
    if (!row.viewable) throw new Error('照片列表无效')
    // 已挂到别的记账则拒绝；挂到当前这笔可以（编辑时保留原图）
    if (row.transactionId && String(row.transactionId) !== String(transactionId)) {
      throw new Error('照片列表无效')
    }
  }

  const current = await TransactionImage.findAll({
    where: { transactionId, viewable: true },
    transaction: sequelizeTx
  })
  const keepSet = new Set(imageIds)
  for (const row of current) {
    if (!keepSet.has(row.id)) {
      await row.update({ viewable: false }, { transaction: sequelizeTx })
      // 对象删除放在事务提交后由调用方触发，避免事务回滚后文件已删
    }
  }

  for (let i = 0; i < imageIds.length; i++) {
    await TransactionImage.update(
      { transactionId, sort: i, viewable: true },
      { where: { id: imageIds[i] }, transaction: sequelizeTx }
    )
  }

  return current.filter((row: { id?: string }) => !keepSet.has(row.id)).map((row: { objectKey?: string }) => row.objectKey)
}

/** 整笔记账删除后：标记不可查看并返回待删 objectKey */
const markImagesUnviewableByTransaction = async (transactionId: string | null | undefined, sequelizeTx?: unknown) => {
  const rows = await TransactionImage.findAll({
    where: { transactionId, viewable: true },
    transaction: sequelizeTx
  })
  if (!rows.length) return []
  await TransactionImage.update(
    { viewable: false },
    { where: { transactionId, viewable: true }, transaction: sequelizeTx }
  )
  return rows.map((r: { objectKey?: string }) => r.objectKey)
}

/** 为列表中的记账附加 images 字段 */
const attachImagesToList = async (
  datas: Row[] | null | undefined,
  { billId, userId, ctx }: { billId?: string | null; userId?: string | null; ctx: HttpContext }
) => {
  const list = (datas || []).map((row) => {
    const plain = row && row.get ? row.get({ plain: true }) : { ...row }
    plain.images = []
    return plain
  })

  if (!list.length || !billId || !userId) return list

  const isMember = await assertBillMember(billId, userId)
  if (!isMember) return list

  const ids = list.map((item) => item.id).filter((id): id is string => !!id)
  if (!ids.length) return list

  const images = await TransactionImage.findAll({
    where: {
      transactionId: { [Op.in]: ids },
      viewable: true
    },
    order: [
      ['sort', 'ASC'],
      ['created_at', 'ASC']
    ]
  })

  const byTx = new Map<string, { id?: string; sort?: number; viewUrl: string }[]>()
  for (const img of images) {
    const plain = img.get({ plain: true })
    const txId = plain.transactionId || ''
    const arr = byTx.get(txId) || []
    arr.push({
      id: plain.id,
      sort: plain.sort,
      viewUrl: buildViewUrl(ctx, plain.id || '')
    })
    byTx.set(txId, arr)
  }

  for (const item of list) {
    item.images = byTx.get(item.id || '') || []
  }
  return list
}

/**
 * 按签名打开照片字节
 * @returns {[string|null, {contentType:string, buffer:Buffer}|null]}
 */
const getImageFile = async ({
  id,
  exp,
  sig
}: {
  id?: string | string[]
  exp?: string | string[]
  sig?: string | string[]
}): Promise<[string | null, { contentType?: string; buffer: Buffer } | null]> => {
  const idText = Array.isArray(id) ? id[0] || '' : id || ''
  const expText = Array.isArray(exp) ? exp[0] || '' : exp || ''
  const sigText = Array.isArray(sig) ? sig[0] || '' : sig || ''
  const now = Math.floor(Date.now() / 1000)
  const expNum = Number(expText)
  if (!Number.isFinite(expNum) || expNum < now) return ['无权查看', null]
  if (!verifyViewSignature(idText, expText, sigText)) return ['无权查看', null]

  const row = await TransactionImage.findOne({ where: { id: idText } })
  if (!row || !row.viewable || !row.transactionId) return ['无权查看', null]

  const tx = await Transaction.findOne({
    where: { id: row.transactionId, isDel: false }
  })
  if (!tx) return ['无权查看', null]

  const client = createOssClient()
  if (!client) return ['无权查看', null]

  try {
    const result = await client.get(row.objectKey)
    const buffer = Buffer.isBuffer(result.content) ? result.content : Buffer.from(result.content)
    return [null, { contentType: row.contentType, buffer }]
  } catch (e: unknown) {
    console.error('读取 OSS 照片失败', e)
    return ['无权查看', null]
  }
}

export { MAX_IMAGE_SIZE, uploadImage, attachImages, markImagesUnviewableByTransaction, attachImagesToList, getImageFile, tryDeleteObject, assertBillMember, detectImageType, buildViewUrl }
