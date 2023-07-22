const xss = require('xss')
const xssData = (data) => {
  if (typeof data === 'string') {
    return xss(data)
  } else if (typeof data === 'number' || typeof data === 'boolean') {
    return data
  } else if (typeof data === 'object' && data !== null) {
    for (let key in data) {
      data[key] = xssData(data[key])
    }
    return data
  }
}

module.exports = { xssData }
