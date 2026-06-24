import dayjs from 'dayjs'

/** 时间戳格式化为 YYYY-MM-DD（接口返回展示用） */
export const formatDate = (ts: number | string) => {
  if (ts === '' || ts == null) return ''
  return dayjs(Number(ts)).format('YYYY-MM-DD')
}

/** 当天 00:00:00 时间戳（查询开始时间） */
export const dayStartTs = (ts: number | string) => dayjs(Number(ts)).startOf('day').valueOf()

/** 当天 23:59:59.999 时间戳（查询结束时间） */
export const dayEndTs = (ts: number | string) => dayjs(Number(ts)).endOf('day').valueOf()
