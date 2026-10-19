/**
 * 只声明没有公开类型、且本仓库实际调用到的依赖。
 * 业务源码不得把整段规则标成 any，也不得整文件关闭检查。
 * 本文件不能有顶层 import，否则这些声明不会进入全局。
 */
declare module 'koa-json' {
  import { Middleware } from 'koa'
  function json(): Middleware
  export = json
}

declare module 'koa-onerror' {
  import Koa from 'koa'
  function onerror(app: Koa): void
  export = onerror
}

declare module 'koa-logger' {
  import { Middleware } from 'koa'
  function logger(): Middleware
  export = logger
}

declare module 'koa-morgan' {
  import { Middleware } from 'koa'
  interface Options {
    stream?: NodeJS.WritableStream
  }
  function morgan(format: string, options?: Options): Middleware
  export = morgan
}

declare module 'koa-generic-session' {
  import { Middleware } from 'koa'
  interface SessionOptions {
    cookie?: {
      path?: string
      httpOnly?: boolean
      maxAge?: number
    }
    store?: unknown
  }
  function session(options?: SessionOptions): Middleware
  export = session
}

declare module 'koa2-cors' {
  import { Context, Middleware } from 'koa'
  interface CorsOptions {
    origin?: string | ((ctx: Context) => string)
    maxAge?: number
    credentials?: boolean
    allowMethods?: string[]
    allowHeaders?: string[]
    exposeHeaders?: string[]
  }
  function cors(options?: CorsOptions): Middleware
  export = cors
}

declare module 'koa-redis' {
  interface RedisClient {
    get(key: string): Promise<string | null>
    set(key: string, value: string, mode: string, ttl: number): Promise<unknown>
    del(key: string): Promise<unknown>
  }
  interface RedisStore {
    client: RedisClient
  }
  function redisStore(options?: { all?: string }): RedisStore
  export = redisStore
}

declare module 'ali-oss' {
  interface OssOptions {
    region: string
    accessKeyId: string
    accessKeySecret: string
    bucket: string
  }
  class OSS {
    constructor(options: OssOptions & { secure?: boolean })
    put(...args: any[]): Promise<any>
    delete(...args: any[]): Promise<any>
    signatureUrl(...args: any[]): any
    get(...args: any[]): Promise<any>
  }
  export = OSS
}

declare module 'jsrsasign' {
  interface RsaKey {
    // 库返回的密钥对象，只用于解密登录口令
  }
  export function b64tohex(value: string): string
  export const KEYUTIL: {
    getKey(pem: string): RsaKey
  }
  export const KJUR: {
    crypto: {
      Cipher: {
        decrypt(hex: string, key: RsaKey, alg: string): string
      }
    }
  }
}

declare module 'node-xlsx' {
  interface Sheet {
    name: string
    data: unknown[][]
  }
  interface Xlsx {
    parse(file: Buffer | string): Sheet[]
    build(sheets: Sheet[], options?: unknown): Buffer
  }
  const xlsx: Xlsx
  export = xlsx
}

declare module 'uuid' {
  export function v4(): string
}

declare module 'xss' {
  interface XssOptions {
    whiteList?: Record<string, string[]>
    stripIgnoreTag?: boolean
    stripIgnoreTagBody?: string[]
  }
  function xss(html: string, options?: XssOptions): string
  export = xss
}
