import xlsx from 'node-xlsx'

export default (data, headerMaps, options = {}) => {
  // data为需要导出的数据,格式为[{name:"张三",age:18},{name:"李四",age:20}]
  // headerMaps 格式： [{key: 'name', name: '名称'},{ key: 'age', name: '年龄'}]
  // options为设置导出excel文件的样式,如需要设置查询node-xlsx
  let xlsxObj = [
    {
      name: 'sheet',
      data: []
    }
  ]
  const headers = []
  const keys = []
  headerMaps.forEach((item) => {
    headers.push(item.name)
    keys.push(item.key)
  })
  data.forEach((item) => {
    // 其余行为excel数据
    xlsxObj[0].data.push(keys.map((key) => item[key]))
  })
  xlsxObj[0].data.unshift(headers)
  // 返回一个buffer对象
  return xlsx.build(xlsxObj, options)
}
