

/**
 * 根据类型返回对应色值
 * @param {string} type -类型
 * @returns {string} 色值
 */

function typeColor(type = 'default') {
  let color = ''
  switch (type) {
    case 'default':
      color = '#999'
      break
    case 'primary':
      color = '#1e80ff'
      break
    case 'success':
      color = '#67C23A'
      break
    case 'warning':
      color = '#ffb800'
      break
    case 'danger':
      color = '#F56C6C'
      break
  }
  return color
}

//格式化输出
/*
    console.log支持的格式标志有:
    %s       占位符
    %d 或 %i    整数
    %f       浮点数
    %o%O     object对象
    %c       css样式
*/
/**
 * 根据输出内容生成对应的格式化标志字符串
 * @param {Array} textArr - 自定义输出内容数组
 * @returns {string} 对应的格式化内容
 */
function typeFormatStr(textArr) {
  let str = ''
  textArr.forEach((item) => {
    const type = typeof item
    switch (type) {
      case 'number':
        str += `%f`
        break
      case 'object':
        str += `%o`
        break
      case 'string':
        str += `%s`
        break
      default:
        str += `%s`
        break
    }
    str += ' '
  })
  return str.slice(0, -1)
}

/**
 * @param {string} type - 类型
 * @param {Array} textArr - 日志内容
 */
const colorful = (type, textArr) => {
  const str = typeFormatStr(textArr)
  console.log(`%c${str}`, `background-color: ${typeColor(type)};color: #fff;padding: 2px 10px;font-weight: bold; border-radius: 4px;`, ...textArr)
}


const log = function (...rest) {
  colorful('default', rest)
}

log.default = function (...rest) {
  colorful('default', rest)
}

log.primary = function (...rest) {
  colorful('primary', rest)
}

log.success = function (...rest) {
  colorful('success', rest)
}

log.warning = function (...rest) {
  colorful('warning', rest)
}

log.danger = function (...rest) {
  colorful('danger', rest)
}

export { log }
