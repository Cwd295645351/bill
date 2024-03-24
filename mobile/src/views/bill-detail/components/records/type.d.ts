
/** 收支项 */
export interface RecordItem {
    /** 归属人 id */
    belongUserId: string
    /** 归属人名称 */
    belongUserName: string
    /** 账本id */
    billId: string
    /** 支出类型 id */
    costTypeId: string
    /** 支出类型名称 */
    costTypeName: string
    /** 收入类型 id */
    incomesTypeId: string
    /** 收入类型名称 */
    incomesTypeName: string
    /** 日期 */
    date: string
    /** id */
    id: string
    /** 是否删除 */
    isDel: boolean
    /** 金额 */
    money: number
    /** 报销进度 0=不用报销，1=待报销，2=已提交，3=已报销 */
    reimbursement: number
    /** 内容 */
    remark: string
    /** 收支类型：1-支出；2收入 */
    type: number
    _id: string
}