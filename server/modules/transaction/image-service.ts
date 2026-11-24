import type { Row } from '../../types/domain'
import type { ViewOrigin } from '../../http/view-origin'
import { readBillRole } from '../access'
import fs from 'fs'
import crypto from 'crypto'
import OSS from 'ali-oss'
import { v4 as uuidv4 } from 'uuid'
import { Op, type Transaction as DbTransaction } from 'sequelize'
import { sequelize, TransactionImage, Transaction } from '../../database'
import VERSION from '../../config/version'

/** 单张上限 10MB，与入口 koa-body 的 maxFileSize 一致 */
const MAX_IMAGE_SIZE = 10485760
/** 查看地址有效期：2 小时 */
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
  // 定长比较，避免签名逐字节提前返回而泄露差异
  return crypto.timingSafeEqual(a, b)
}

/** 生成指向本服务的短期查看地址，不含 object_key 与对象存储密钥 */
const buildViewUrl = (origin: ViewOrigin, imageId: string) => {
  const exp = Math.floor(Date.now() / 1000) + VIEW_URL_TTL_SEC
  const sig = signViewParams(imageId, exp)
  return `${origin.proto}://${origin.host}/api/${VERSION}/transaction/image/file?id=${encodeURIComponent(
    imageId
  )}&exp=${exp}&sig=${encodeURIComponent(sig)}`
}

/** 校验调用者是否为该账本成员 */
const assertBillMember = async (billId: string | null | undefined, userId: string | null | undefined) => {
  const role = await readBillRole(userId, billId)
  return role.kind === 'member'
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
  // 非成员与账本不存在统一成同一提示，避免暴露账本是否存在
  const isMember = await assertBillMember(billId, userId)
  if (!isMember) return ['未找到账本', null]
  if (!file || !file.filepath) return ['照片没有保存成功', null]

  let buf
  try {
    buf = fs.readFileSync(file.filepath)
  } catch (e: unknown) {
    console.error('读取上传照片失败', e)
    return ['照片没有保存成功', null]
  }

  // 以实际读到的字节数为准，不信上传组件填的 file.size
  if (!buf.length) return ['无法当作照片打开', null]
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
  // 私有桶路径含账本，避免不同账本的对象键撞在一起
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
      // 先落未挂接行，保存记账时再写入 transactionId；接口只返回 id
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
 * 将照片挂到一笔记账上（替换规则）。
 * 不传 imageIds 表示调用方未请求改照片，本函数不应被调用。
 * 最多四次数据库往返：查出待挂行、查出当前可见行、批量隐藏被换下的、一条 CASE 写回顺序。
 * 返回被换下照片的 objectKey，由调用方在事务提交成功后再删对象存储。
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
  sequelizeTx?: DbTransaction | null
}) => {
  if (!Array.isArray(imageIds)) {
    throw new Error('imageIds 必须是数组')
  }
  if (imageIds.length > 9) {
    throw new Error('一笔最多附 9 张照片')
  }

  const ids = imageIds.map((id) => String(id))
  // 去重校验：不允许重复 id
  const unique = new Set(ids)
  if (unique.size !== ids.length) {
    throw new Error('照片列表无效')
  }

  // 一次查出待挂照片，在内存里校验归属
  if (ids.length) {
    const rows = await TransactionImage.findAll({
      where: { id: { [Op.in]: ids } },
      transaction: sequelizeTx
    })
    // 主键不会重复，条数对不上就是有 id 不存在
    if (rows.length !== ids.length) throw new Error('照片列表无效')
    const byId = new Map(
      rows.map((row: { id?: string; billId?: string; userId?: string; viewable?: boolean; transactionId?: string | null }) => [String(row.id), row])
    )
    for (const id of ids) {
      const row = byId.get(id) as { billId?: string; userId?: string; viewable?: boolean; transactionId?: string | null } | undefined
      if (!row) throw new Error('照片列表无效')
      if (String(row.billId) !== String(billId)) throw new Error('照片列表无效')
      if (String(row.userId) !== String(userId)) throw new Error('照片列表无效')
      if (!row.viewable) throw new Error('照片列表无效')
      // 已挂到别的记账则拒绝；挂到当前这笔可以（编辑时保留原图）
      if (row.transactionId && String(row.transactionId) !== String(transactionId)) {
        throw new Error('照片列表无效')
      }
    }
  }

  // 这笔账上目前可见的照片；不在本次列表里的就是要换下的
  const current = await TransactionImage.findAll({
    where: { transactionId, viewable: true },
    transaction: sequelizeTx
  })
  const dropped = current.filter((row: { id?: string }) => !unique.has(String(row.id)))
  // 被换下的一次标为不可见；对象删除放在事务提交后，避免回滚后文件已删
  if (dropped.length) {
    await TransactionImage.update(
      { viewable: false },
      {
        where: { id: { [Op.in]: dropped.map((row: { id?: string }) => row.id) } },
        transaction: sequelizeTx
      }
    )
  }

  // 顺序就是数组下标。下标是这里生成的整数，可以写进 SQL；id 走参数绑定
  if (ids.length) {
    const replacements: Record<string, string | number | null | undefined> = { transactionId }
    const whens = ids.map((id, index) => {
      replacements[`id${index}`] = id
      return `WHEN :id${index} THEN ${index}`
    })
    await sequelize.query(
      `UPDATE transaction_images
       SET transaction_id = :transactionId, viewable = 1, sort = CASE id ${whens.join(' ')} END
       WHERE id IN (${ids.map((_, index) => `:id${index}`).join(', ')})`,
      { replacements, transaction: sequelizeTx }
    )
  }

  return dropped.map((row: { objectKey?: string }) => row.objectKey)
}

/** 整笔记账删除后：标记不可查看并返回待删 objectKey */
const markImagesUnviewableByTransaction = async (transactionId: string | null | undefined, sequelizeTx?: unknown) => {
  const rows = await TransactionImage.findAll({
    where: { transactionId, viewable: true },
    transaction: sequelizeTx
  })
  if (!rows.length) return []
  await TransactionImage.update({ viewable: false }, { where: { transactionId, viewable: true }, transaction: sequelizeTx })
  return rows.map((r: { objectKey?: string }) => r.objectKey)
}

/** 为列表中的记账附加 images 字段 */
const attachImagesToList = async (
  datas: Row[] | null | undefined,
  { billId, userId, origin }: { billId?: string | null; userId?: string | null; origin: ViewOrigin }
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
      viewUrl: buildViewUrl(origin, plain.id || '')
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
  // 未挂到记账，或已标不可见的照片，不能靠签名地址打开
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

export {
  MAX_IMAGE_SIZE,
  uploadImage,
  attachImages,
  markImagesUnviewableByTransaction,
  attachImagesToList,
  getImageFile,
  tryDeleteObject,
  assertBillMember,
  detectImageType,
  buildViewUrl
}
