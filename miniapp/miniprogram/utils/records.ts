import { formatDayLabel, weekLabel } from './date'

export interface RecordImage {
  id: string
  sort: number
  viewUrl: string
}

export interface RecordItem {
  id: string
  billId: string
  date: number
  type: number
  money: number
  remark: string
  /** 归属人 id 列表：「全部」为空数组，多人按账本成员顺序 */
  belongUserIds: string[]
  belongUserName: string
  costTypeId: string
  costTypeName: string
  incomesTypeId: string
  incomesTypeName: string
  reimbursement: number
  userId?: string
  category?: string
  moneyText?: string
  mine?: boolean
  belongBg?: string
  /** 列表接口附加的照片；groupRecords 必须保留原对象上的该字段 */
  images?: RecordImage[]
}

export interface DayGroup {
  date: string
  week: string
  cost: string
  incomes: string
  arr: RecordItem[]
}

function moneyText(n: number) {
  return Number(n || 0).toFixed(2)
}

/** 与电脑端账本明细同一套色板，按成员顺序循环 */
const BELONG_PALETTE = ['#fff3e0', '#e3f2fd', '#e8f5e9', '#fce4ec', '#f3e5f5', '#e0f7fa', '#fff8e1', '#fbe9e7']

/** 多人归属的固定底色，与电脑端一致 */
const MULTI_BELONG_BG = '#ede7f6'

/** 归属人卡片底色。「全部」或未指定归属人返回空串，沿用白底；多人用固定底色 */
export function belongBackground(belongUserIds: string[] = [], belongUserName: string, users: { id: string }[] = []): string {
  if (!belongUserIds.length || belongUserName === '全部') return ''
  if (belongUserIds.length > 1) return MULTI_BELONG_BG
  const belongUserId = belongUserIds[0]
  const index = users.findIndex((user) => String(user.id) === String(belongUserId))
  let slot = index
  if (slot < 0) {
    slot = 0
    const key = String(belongUserId)
    for (let i = 0; i < key.length; i++) slot = (slot * 31 + key.charCodeAt(i)) >>> 0
  }
  return BELONG_PALETTE[slot % BELONG_PALETTE.length]
}

/** 按日期分组，组头给出当日收入、支出合计。传入当前用户后标记本人记账 */
export function groupRecords(list: RecordItem[], userId?: string, users: { id: string }[] = []): DayGroup[] {
  const map: Record<string, DayGroup & { costNum: number; incomesNum: number }> = {}
  const order: string[] = []
  list.forEach((item) => {
    const key = formatDayLabel(item.date)
    if (!map[key]) {
      map[key] = {
        date: key,
        week: weekLabel(item.date),
        cost: '0.00',
        incomes: '0.00',
        costNum: 0,
        incomesNum: 0,
        arr: []
      }
      order.push(key)
    }
    const row = map[key]
    item.category = item.type === 1 ? item.costTypeName || '未分类' : item.incomesTypeName || '未分类'
    item.moneyText = moneyText(item.money)
    item.mine = !!userId && String(item.userId) === String(userId)
    item.belongBg = belongBackground(item.belongUserIds, item.belongUserName, users)
    row.arr.push(item)
    if (item.type === 1) row.costNum += Number(item.money || 0)
    else row.incomesNum += Number(item.money || 0)
  })
  return order.map((key) => {
    const row = map[key]
    return {
      date: row.date,
      week: row.week,
      cost: moneyText(row.costNum),
      incomes: moneyText(row.incomesNum),
      arr: row.arr
    }
  })
}

/** 金额键盘输入：最多两位小数，整数部分连小数点不超过 10 位 */
export function applyAmountKey(current: string, key: string): string {
  let next = current || ''
  if (key === 'del') return next.slice(0, -1)
  if (key === '.') {
    if (next.indexOf('.') >= 0) return next
    return (next || '0') + '.'
  }
  if (next === '0') next = key
  else next += key
  const dot = next.indexOf('.')
  if (dot >= 0 && next.length - dot - 1 > 2) return current || ''
  if (next.replace('.', '').length > 10) return current || ''
  return next
}
