import path from 'path'
import dotenv from 'dotenv'
import { resolveServerRoot } from './serverRoot'

/** 必须在读取密钥和数据库配置之前执行 */
dotenv.config({
  path: path.join(resolveServerRoot(__dirname), '.env'),
  quiet: true
})
