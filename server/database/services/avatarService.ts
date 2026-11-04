import type { HttpContext } from '../../types/domain'
import fs from 'fs'
import crypto from 'crypto'
import OSS from 'ali-oss'
import { v4 as uuidv4 } from 'uuid'
import { User } from '../index'
import VERSION from '../../config/version'

const MAX_IMAGE_SIZE = 10485760
const VIEW_URL_TTL_SEC = 7 * 24 * 60 * 60
const ALLOWED_CONTENT_TYPES: Record<string, boolean> = {
  'image/jpeg': true,
  'image/png': true,
  'image/gif': true,
  'image/webp': true
}

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
  if (!region || !bucket || !accessKeyId || !accessKeySecret) return null
  return { region, bucket, accessKeyId, accessKeySecret }
}

const getUrlSecret = () => process.env.OSS_URL_SECRET || ''

const createOssClient = () => {
  const conf = getOssConfig()
  if (!conf) return null
  return new OSS({ ...conf, secure: true })
}

const signViewParams = (userId: string, exp: string | number) => {
  const secret = getUrlSecret()
  if (!secret) return ''
  return crypto.createHmac('sha256', secret).update(`avatar.${userId}.${exp}`).digest('hex')
}

const verifyViewSignature = (userId: string, exp: string | number, sig: string) => {
  if (!userId || !exp || !sig) return false
  const expected = signViewParams(userId, String(exp))
  if (!expected) return false
  const a = Buffer.from(String(sig))
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/** 生成指向本服务的头像短期查看地址 */
const buildAvatarViewUrl = (ctx: HttpContext | null | undefined, userId: string) => {
  if (!ctx || !userId) return ''
  const exp = Math.floor(Date.now() / 1000) + VIEW_URL_TTL_SEC
  const sig = signViewParams(userId, exp)
  if (!sig) return ''
  const proto = ctx.request.header['x-forwarded-proto'] || ctx.request.protocol || 'https'
  const host = ctx.request.header['x-forwarded-host'] || ctx.request.host
  return `${proto}://${host}/api/${VERSION}/common/avatar/file?userId=${encodeURIComponent(
    userId
  )}&exp=${exp}&sig=${encodeURIComponent(sig)}`
}

const isAvatarObjectKey = (value: string | null | undefined) =>
  !!value && (value.startsWith('avatars/') || value.startsWith('avatar-images/'))

/** 将 DB 中的 objectKey / 旧 URL 转为客户端可展示地址 */
const resolveAvatarUrl = (
  avatarUrl: string | null | undefined,
  userId: string | null | undefined,
  ctx?: HttpContext | null
) => {
  const raw = String(avatarUrl || '')
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (isAvatarObjectKey(raw) && userId) return buildAvatarViewUrl(ctx, String(userId))
  return raw
}

const tryDeleteObject = async (objectKey: string | null | undefined) => {
  if (!objectKey || !isAvatarObjectKey(objectKey)) return
  const client = createOssClient()
  if (!client) return
  try {
    await client.delete(objectKey)
  } catch (e: unknown) {
    console.error('删除头像 OSS 对象失败', objectKey, e)
  }
}

/**
 * 上传头像到私有桶并写入 users.avatar_url（存 objectKey）
 * @returns {[string|null, objectKey|null]}
 */
const uploadAvatar = async ({
  file,
  userId
}: {
  file?: { filepath?: string; size?: number } | null
  userId?: string | null
}): Promise<[string | null, string | null]> => {
  if (!userId) return ['请先登录', null]
  if (!file || !file.filepath) return ['头像没有保存成功', null]
  const size = Number(file.size || 0)
  if (!size || size > MAX_IMAGE_SIZE) return ['单张照片不能超过 10MB', null]

  let buf: Buffer
  try {
    buf = fs.readFileSync(file.filepath)
  } catch (e: unknown) {
    console.error('读取上传头像失败', e)
    return ['头像没有保存成功', null]
  }

  if (buf.length > MAX_IMAGE_SIZE) return ['单张照片不能超过 10MB', null]
  const contentType = detectImageType(buf)
  if (!contentType || !ALLOWED_CONTENT_TYPES[contentType]) {
    return ['无法当作照片打开', null]
  }

  const client = createOssClient()
  if (!client) {
    console.error('OSS 配置缺失')
    return ['头像没有保存成功', null]
  }

  const id = uuidv4()
  const ext = contentType === 'image/jpeg' ? 'jpg' : contentType.split('/')[1]
  const objectKey = `avatars/${userId}/${id}.${ext}`

  try {
    await client.put(objectKey, buf, {
      headers: { 'Content-Type': contentType }
    })
  } catch (e: unknown) {
    console.error('OSS 上传头像失败', e)
    return ['头像没有保存成功', null]
  } finally {
    try {
      fs.unlinkSync(file.filepath)
    } catch (_: unknown) {
      /* ignore */
    }
  }

  try {
    const user = await User.findOne({ where: { id: userId, isDel: false }, attributes: ['id', 'avatarUrl'] })
    if (!user) {
      await tryDeleteObject(objectKey)
      return ['用户不存在', null]
    }
    const oldKey = user.avatarUrl
    await User.update({ avatarUrl: objectKey }, { where: { id: userId, isDel: false } })
    if (oldKey && oldKey !== objectKey) await tryDeleteObject(oldKey)
    return [null, objectKey]
  } catch (e: unknown) {
    console.error('写入头像失败', e)
    await tryDeleteObject(objectKey)
    return ['头像没有保存成功', null]
  }
}

/**
 * 按签名打开头像字节
 */
const getAvatarFile = async ({
  userId,
  exp,
  sig
}: {
  userId?: string | string[]
  exp?: string | string[]
  sig?: string | string[]
}): Promise<[string | null, { contentType?: string; buffer: Buffer } | null]> => {
  const userIdText = Array.isArray(userId) ? userId[0] || '' : userId || ''
  const expText = Array.isArray(exp) ? exp[0] || '' : exp || ''
  const sigText = Array.isArray(sig) ? sig[0] || '' : sig || ''
  const now = Math.floor(Date.now() / 1000)
  const expNum = Number(expText)
  if (!Number.isFinite(expNum) || expNum < now) return ['无权查看', null]
  if (!verifyViewSignature(userIdText, expText, sigText)) return ['无权查看', null]

  const user = await User.findOne({
    where: { id: userIdText, isDel: false },
    attributes: ['avatarUrl']
  })
  const objectKey = user?.avatarUrl || ''
  if (!isAvatarObjectKey(objectKey)) return ['无权查看', null]

  const client = createOssClient()
  if (!client) return ['无权查看', null]

  try {
    const result = await client.get(objectKey)
    const buffer = Buffer.isBuffer(result.content) ? result.content : Buffer.from(result.content)
    const ext = objectKey.split('.').pop()?.toLowerCase()
    const contentType =
      ext === 'png'
        ? 'image/png'
        : ext === 'gif'
          ? 'image/gif'
          : ext === 'webp'
            ? 'image/webp'
            : 'image/jpeg'
    return [null, { contentType, buffer }]
  } catch (e: unknown) {
    console.error('读取 OSS 头像失败', e)
    return ['无权查看', null]
  }
}

export {
  MAX_IMAGE_SIZE,
  uploadAvatar,
  getAvatarFile,
  buildAvatarViewUrl,
  resolveAvatarUrl,
  isAvatarObjectKey
}