import type { Row } from '../../types/domain'
import dayjs from 'dayjs'
import { Op } from 'sequelize'
import { AssetRecord } from '../index'
import { getLatestSnapshotsBefore } from './assetRecordService'
import { toCny, type Rates } from './assetFx'

/** 月末汇总：与月历同月口径 */
export type MonthEndTotals = {
  yearMonth: string
  liquid: number | null
  invest: number | null
  fixed: number | null
  receivable: number | null
  /** 非负负债合计；趋势 all 投影时再取负 */
  liability: number | null
  assetsSum: number | null
  net: number | null
  /** 中文类别 → 该月最后盘点日 YYYY-MM-DD，供月历 lastUpdate */
  lastUpdate: Record<string, string>
}

const TYPE_LABEL: Record<string, string> = {
  living: '流动资金',
  longterm: '投资理财',
  steady: '固定资产',
  receivable: '应收款'
}

const LABEL_TO_FIELD: Record<string, keyof Pick<MonthEndTotals, 'liquid' | 'invest' | 'fixed' | 'receivable'>> = {
  流动资金: 'liquid',
  投资理财: 'invest',
  固定资产: 'fixed',
  应收款: 'receivable'
}

const round2 = (value: number) => Math.round(value * 100) / 100

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export const isYearMonth = (value: unknown): value is string =>
  typeof value === 'string' && MONTH_RE.test(value)

/** 生成闭区间月列表（含端点） */
export const listYearMonths = (startMonth: string, endMonth: string): string[] => {
  const out: string[] = []
  let cursor = dayjs(`${startMonth}-01`).startOf('month')
  const end = dayjs(`${endMonth}-01`).startOf('month')
  while (cursor.isBefore(end) || cursor.isSame(end, 'month')) {
    out.push(cursor.format('YYYY-MM'))
    cursor = cursor.add(1, 'month')
  }
  return out
}

export const monthEndTimestamp = (yearMonth: string) =>
  dayjs(`${yearMonth}-01`).endOf('month').valueOf()

/**
 * 一次加载截止时刻及之前的全部未删盘点，按资产分组且按 date 升序。
 * 供长窗在内存里按 cutoff 切片，避免每月一次 SQL。
 */
export const loadSnapshotPool = async (
  assetIds: string[],
  maxTimestamp: number
): Promise<Map<string, Row[]>> => {
  const pool = new Map<string, Row[]>()
  if (!assetIds.length) return pool
  const rows = await AssetRecord.findAll({
    where: {
      assetId: { [Op.in]: assetIds },
      isDel: false,
      date: { [Op.lte]: maxTimestamp }
    },
    attributes: ['assetId', 'amount', 'date'],
    order: [['date', 'ASC']],
    raw: true
  })
  for (const row of rows as Row[]) {
    const id = String(row.assetId || '')
    if (!id) continue
    const list = pool.get(id) || []
    list.push(row)
    pool.set(id, list)
  }
  return pool
}

/** 从池中取每个资产在 cutoff 及之前的最近一条 */
export const latestFromPool = (pool: Map<string, Row[]>, maxTimestamp: number): Row[] => {
  const latest: Row[] = []
  pool.forEach((rows, assetId) => {
    let chosen: Row | null = null
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      const ts = Number(rows[i].date)
      if (Number.isFinite(ts) && ts <= maxTimestamp) {
        chosen = rows[i]
        break
      }
    }
    if (chosen) latest.push({ ...chosen, assetId })
  })
  return latest
}

/** 把快照列表汇总成月末分类合计 */
export const summarizeMonthEnd = (
  yearMonth: string,
  assets: Row[],
  snaps: Row[],
  rates: Rates
): MonthEndTotals => {
  const sums: Record<string, number> = {}
  const seen: Record<string, boolean> = {}
  const lastByKey: Record<string, string> = {}
  let assetSum = 0
  let debtSum = 0
  let seenAsset = false
  let seenDebt = false

  const touch = (key: string, dateStr: string) => {
    if (!lastByKey[key] || dateStr > lastByKey[key]) lastByKey[key] = dateStr
  }

  snaps.forEach((snap) => {
    const asset = assets.find((item) => item.id === snap.assetId)
    if (!asset) return
    const amount = toCny(snap.amount, asset.currency, rates)
    const dateStr = dayjs(Number(snap.date)).format('YYYY-MM-DD')
    if (asset.isDebt) {
      debtSum += amount
      seenDebt = true
      touch('总负债', dateStr)
      touch('总净资产', dateStr)
      return
    }
    const label = TYPE_LABEL[String(asset.type || '')]
    if (label) {
      sums[label] = (sums[label] || 0) + amount
      seen[label] = true
      touch(label, dateStr)
    }
    assetSum += amount
    seenAsset = true
    touch('总资产', dateStr)
    touch('总净资产', dateStr)
  })

  const cell = (label: string): number | null => (seen[label] ? round2(sums[label] || 0) : null)

  return {
    yearMonth,
    liquid: cell('流动资金'),
    invest: cell('投资理财'),
    fixed: cell('固定资产'),
    receivable: cell('应收款'),
    liability: seenDebt ? round2(debtSum) : null,
    assetsSum: seenAsset ? round2(assetSum) : null,
    net: seenAsset || seenDebt ? round2(assetSum - debtSum) : null,
    lastUpdate: lastByKey
  }
}

export type BuildMonthEndInput = {
  yearMonth: string
  assets: Row[]
  rates: Rates
  /** 若提供则走内存切片；否则对该月 end 打一次 getLatestSnapshotsBefore */
  pool?: Map<string, Row[]>
  assetIds?: string[]
}

export const buildMonthEndTotals = async (input: BuildMonthEndInput): Promise<MonthEndTotals> => {
  const cutoff = monthEndTimestamp(input.yearMonth)
  const assetIds =
    input.assetIds ||
    input.assets.map((a) => a.id).filter((id: string | undefined): id is string => Boolean(id))
  const snaps = input.pool
    ? latestFromPool(input.pool, cutoff)
    : assetIds.length
      ? await getLatestSnapshotsBefore(assetIds, cutoff)
      : []
  return summarizeMonthEnd(input.yearMonth, input.assets, snaps, input.rates)
}

export { LABEL_TO_FIELD, TYPE_LABEL, round2 }
