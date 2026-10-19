import 'koa'

declare module 'koa' {
  interface Request {
    body?: any
    files?: any
  }

  interface Context {
    session?: any
  }
}
