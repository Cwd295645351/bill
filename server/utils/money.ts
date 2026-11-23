/** 金额保留两位小数（返回 number） */
export const fixMoney = (value: number | string | null | undefined) => Number(Number(value).toFixed(2))
