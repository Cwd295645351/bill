class ResModel {
  data: unknown
  message: unknown
  retCode: number

  constructor(data: unknown, message: unknown = '', type = 'success') {
    this.data = data
    this.message = message
    this.retCode = type === 'success' ? 0 : 1
  }
}

export { ResModel }
