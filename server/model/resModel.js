class ResModel {
  constructor(data, message, type = 'success') {
    this.data = data
    this.message = message
    this.retCode = type === 'success' ? 0 : 1
  }
}

module.exports = { ResModel }
