/**
 * 现有模型由 sequelize.define 动态生成，属性在运行时才有。
 * 这里只提供按字段读取的形状，不改变建表。
 */
export interface AnyModel {
  [key: string]: any
}
