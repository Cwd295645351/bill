import path from 'path'

/**
 * 源码直接运行时，根目录是 server/。
 * 编译到 dist/ 之后，根目录仍是 server/，不能落到 dist/。
 */
export const resolveServerRoot = (dirname: string): string => {
  const parts = path.normalize(dirname).split(path.sep)
  const distAt = parts.lastIndexOf('dist')
  if (distAt >= 0) return parts.slice(0, distAt).join(path.sep)
  if (path.basename(dirname) === 'server') return dirname
  return path.resolve(dirname, '..')
}
