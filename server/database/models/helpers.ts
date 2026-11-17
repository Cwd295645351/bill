import { DataTypes, Sequelize } from 'sequelize'
import { v4 as uuidv4 } from 'uuid'
import type { AnyModel } from '../../types/model'

export const defineId = {
  type: DataTypes.CHAR(36),
  primaryKey: true,
  defaultValue: () => uuidv4()
}

/** Sequelize 属性 getter/setter 上的 this */
export interface ModelField {
  getDataValue(key: string): unknown
  setDataValue(key: string, value: unknown): void
}

/** 金额字段：数据库存 DECIMAL，Sequelize 默认读成 string，通过 getter 转为 number */
export function decimalMoney(attrName: string, options: Record<string, unknown> = {}) {
  return {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0,
    ...options,
    get(this: ModelField) {
      const v = this.getDataValue(attrName)
      if (v == null) return v
      return Number(v)
    }
  }
}

export type DefineModel = (name: string, attributes: object, options?: object) => AnyModel

export function createDefineModel(sequelize: Sequelize): DefineModel {
  return (name, attributes, options) => sequelize.define(name, attributes as never, options) as AnyModel
}
