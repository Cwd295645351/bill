import { v4 as uuidv4 } from 'uuid'
import { client } from './redis'

const CAPTCHA_PREFIX = 'bill:captcha:'
const CAPTCHA_TTL = 120
const WIDTH = 300
const HEIGHT = 150
const PUZZLE = 42
/** 允许的像素误差 */
const TOLERANCE = 6

const COLORS = ['#5b8ff9', '#5ad8a6', '#5d7092', '#f6bd16', '#e8684a', '#6dc8ec', '#9270ca', '#ff9d4d']

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)]
}

function svgToDataUrl(svg: string) {
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')
}

/** 画布背景 + 缺口阴影 */
function buildBackground(x: number, y: number, c1: string, c2: string) {
  const size = PUZZLE
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <circle cx="60" cy="40" r="28" fill="rgba(255,255,255,0.18)"/>
  <circle cx="220" cy="110" r="36" fill="rgba(0,0,0,0.12)"/>
  <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="6" fill="rgba(0,0,0,0.35)"/>
  <rect x="${x + 2}" y="${y + 2}" width="${size - 4}" height="${size - 4}" rx="5" fill="rgba(255,255,255,0.12)"/>
</svg>`
}

/** 可拖动的拼图块 */
function buildPuzzle(c1: string, c2: string) {
  const size = PUZZLE
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="p" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="6" fill="url(#p)" stroke="rgba(255,255,255,0.7)" stroke-width="2"/>
</svg>`
}

export type CaptchaChallenge = {
  captchaId: string
  backgroundImage: string
  puzzleImage: string
  y: number
  width: number
  height: number
  puzzleSize: number
  /** 缺口横坐标；供前端即时校验，服务端仍以 Redis 为准 */
  targetX: number
  /** 与服务端 consumeCaptcha 相同的像素容差 */
  tolerance: number
  expiresIn: number
}

/** 生成滑块题并存 Redis（值为缺口横坐标） */
export async function createCaptcha(): Promise<CaptchaChallenge> {
  const maxX = WIDTH - PUZZLE - 12
  const x = randInt(48, maxX)
  const y = randInt(12, HEIGHT - PUZZLE - 12)
  const c1 = pick(COLORS)
  let c2 = pick(COLORS)
  if (c2 === c1) c2 = pick(COLORS)
  const captchaId = uuidv4()
  await client.set(`${CAPTCHA_PREFIX}${captchaId}`, String(x), 'EX', CAPTCHA_TTL)
  return {
    captchaId,
    backgroundImage: svgToDataUrl(buildBackground(x, y, c1, c2)),
    puzzleImage: svgToDataUrl(buildPuzzle(c1, c2)),
    y,
    width: WIDTH,
    height: HEIGHT,
    puzzleSize: PUZZLE,
    targetX: x,
    tolerance: TOLERANCE,
    expiresIn: CAPTCHA_TTL
  }
}

/**
 * 一次性校验滑块。成功或失败都会删除 key。
 * @returns 错误文案；null 表示通过
 */
export async function consumeCaptcha(
  captchaId: unknown,
  captchaX: unknown
): Promise<string | null> {
  if (captchaId == null || captchaId === '' || typeof captchaId !== 'string') {
    return '请完成滑块验证'
  }
  const xNum = typeof captchaX === 'number' ? captchaX : Number(captchaX)
  if (!Number.isFinite(xNum)) {
    return '请完成滑块验证'
  }
  const key = `${CAPTCHA_PREFIX}${captchaId}`
  const stored = await client.get(key)
  if (stored == null) {
    return '滑块验证失败或已过期'
  }
  await client.del(key)
  const target = Number(stored)
  if (!Number.isFinite(target) || Math.abs(xNum - target) > TOLERANCE) {
    return '滑块验证失败或已过期'
  }
  return null
}
