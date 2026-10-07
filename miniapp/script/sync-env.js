/**
 * 读取 miniapp/.env 的 MINIAPP_BASE_URL，生成不提交的 env.local.ts。
 * 小程序没有 Node 的 process.env，只能在编译前把本地环境变量写进源码。
 */
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const envFile = path.join(root, '.env')
const target = path.join(root, 'miniprogram', 'config', 'env.local.ts')

const readBaseURL = () => {
  if (!fs.existsSync(envFile)) return ''
  const text = fs.readFileSync(envFile, 'utf8')
  const line = text.split(/\r?\n/).find((row) => /^\s*MINIAPP_BASE_URL\s*=/.test(row))
  if (!line) return ''
  let value = line.slice(line.indexOf('=') + 1).trim()
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1)
  }
  return value.replace(/\/+$/, '')
}

const baseURL = readBaseURL()
const escaped = baseURL.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
const content = `/** 由 miniapp/.env 的 MINIAPP_BASE_URL 生成，已忽略提交，不要写入仓库 */\nexport const PROD_BASE_URL = '${escaped}'\n`

fs.writeFileSync(target, content)
if (!baseURL) {
  console.warn('未读取到 MINIAPP_BASE_URL。请复制 miniapp/.env.example 为 miniapp/.env 后重新执行 npm run sync-env')
} else {
  console.log('已生成 miniprogram/config/env.local.ts')
}
