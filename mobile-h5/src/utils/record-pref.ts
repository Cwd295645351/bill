/** 与小程序 lastRecordPref 对齐：记住上次支出/收入分类与归属，供新建表单默认选中 */

export interface RecordPref {
  costTypeId: string
  costTypeName: string
  incomesTypeId: string
  incomesTypeName: string
  belongUserIds?: string[]
  belongUserName: string
}

const LAST_PREF = 'lastRecordPref'

export function emptyPref(): RecordPref {
  return {
    costTypeId: '',
    costTypeName: '',
    incomesTypeId: '',
    incomesTypeName: '',
    belongUserName: '',
  }
}

export function getLastPref(): RecordPref | null {
  try {
    const raw = localStorage.getItem(LAST_PREF)
    if (!raw) return null
    const pref = JSON.parse(raw) as RecordPref
    if (!pref || pref.costTypeId === undefined) return null
    return pref
  } catch {
    return null
  }
}

export function setLastPref(pref: RecordPref) {
  try {
    localStorage.setItem(LAST_PREF, JSON.stringify(pref))
  } catch {
    /* ignore quota */
  }
}
