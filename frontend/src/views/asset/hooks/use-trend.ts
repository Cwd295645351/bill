import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import dayjs, { type Dayjs } from 'dayjs'
import * as echarts from 'echarts'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import { getMonthlyReport } from '../api'
import { formatMoney, roundMoney } from '../shared'
import type { MonthlyReport } from '../type'

export type TrendRange = 'thisYear' | 'y1' | 'y3' | 'y5' | 'custom'
export type TrendMetric = 'all' | 'net'

const STACK = [
  { key: '流动资金', color: '#409eff' },
  { key: '投资理财', color: '#fac858' },
  { key: '固定资产', color: '#91cc75' },
  { key: '负债', color: '#f74f4f' },
  { key: '应收款', color: '#73c0de' },
]

/** 用各年的月历拼出趋势。不另开趋势接口 */
export const useTrend = (memberId: Ref<string>) => {
  const { billId } = storeToRefs(useBillStore())
  const range = ref<TrendRange>('thisYear')
  const metric = ref<TrendMetric>('all')
  const start = ref(dayjs().startOf('year').format('YYYY-MM'))
  const end = ref(dayjs().format('YYYY-MM'))
  const error = ref('')
  const legend = ref<{ name: string; color: string; last: number | null; change: number | null }[]>([])
  const host = ref<HTMLElement | null>(null)
  let chart: echarts.ECharts | null = null
  const cache = new Map<string, MonthlyReport>()

  const bounds = (): { from: Dayjs; to: Dayjs; capped?: boolean } | null => {
    const now = dayjs().startOf('month')
    if (range.value === 'thisYear') return { from: now.startOf('year'), to: now }
    if (range.value === 'y1') return { from: now.subtract(11, 'month'), to: now }
    if (range.value === 'y3') return { from: now.subtract(35, 'month'), to: now }
    if (range.value === 'y5') return { from: now.subtract(59, 'month'), to: now }
    const from = dayjs(start.value).startOf('month')
    let to = dayjs(end.value).startOf('month')
    const capped = to.isAfter(now)
    if (capped) to = now
    if (from.isAfter(to)) return null
    return { from, to, capped }
  }

  const loadYear = async (year: number) => {
    const cacheKey = `${billId.value}-${memberId.value}-${year}`
    const cached = cache.get(cacheKey)
    if (cached) return cached
    const params: { billId: string; year: number; memberId?: string } = { billId: billId.value || '', year }
    if (memberId.value) params.memberId = memberId.value
    const [err, res] = await getMonthlyReport({ params })
    if (err || !res || res.retCode !== 0) throw new Error(res?.message || '读取月历失败')
    cache.set(cacheKey, res.data || {})
    return res.data as MonthlyReport
  }

  const point = (report: MonthlyReport, key: string, month: number) => {
    const source = key === '负债' ? '总负债' : key
    const amount = roundMoney(report[source]?.monthlyData?.[month])
    if (amount == null) return null
    // 负债记在零轴下方，和资产正向堆叠分开
    if (key === '负债' && amount !== 0) return -amount
    return amount
  }

  const render = async () => {
    error.value = ''
    const window = bounds()
    if (!window) {
      error.value = '开始日期不能晚于结束日期'
      chart?.clear()
      return
    }
    if (!billId.value || !host.value) return
    const labels: string[] = []
    const rows: { year: number; month: number }[] = []
    let cursor = window.from
    while (cursor.isBefore(window.to) || cursor.isSame(window.to, 'month')) {
      labels.push(cursor.format('YYYY-MM'))
      rows.push({ year: cursor.year(), month: cursor.month() })
      cursor = cursor.add(1, 'month')
    }
    const years = [...new Set(rows.map((item) => item.year))]
    const reports = new Map<number, MonthlyReport>()
    try {
      for (const year of years) reports.set(year, await loadYear(year))
    } catch (err) {
      error.value = err instanceof Error ? err.message : '读取月历失败'
      return
    }
    if (!chart) chart = echarts.init(host.value)
    chart.resize()
    const series =
      metric.value === 'net'
        ? [
            {
              name: '净资产',
              type: 'line',
              stack: 'net',
              areaStyle: {},
              showSymbol: false,
              color: '#18a356',
              data: rows.map((item) => point(reports.get(item.year) || {}, '总净资产', item.month)),
            },
          ]
        : STACK.map((item) => ({
            name: item.key,
            type: 'line',
              stack: 'asset',
              stackStrategy: 'samesign',
              areaStyle: {},
            showSymbol: false,
            color: item.color,
            data: rows.map((row) => point(reports.get(row.year) || {}, item.key, row.month)),
          }))
    const hasValue = series.some((item) => item.data.some((value) => value != null))
    legend.value = series.map((item) => {
      const numbers = item.data.filter((value): value is number => value != null)
      if (!numbers.length) return { name: item.name, color: item.color, last: null, change: null }
      return { name: item.name, color: item.color, last: numbers[numbers.length - 1], change: numbers[numbers.length - 1] - numbers[0] }
    })
    if (!hasValue) {
      error.value = '该区间没有盘点'
      chart.clear()
      return
    }
    if (window.capped) error.value = '结束日期晚于当前月，只画到当前月'
    chart.setOption(
      {
        tooltip: { trigger: 'axis', valueFormatter: (value: unknown) => formatMoney(value == null ? null : Number(value)) },
        legend: { show: false },
        grid: { left: 88, right: 16, top: 16, bottom: 32 },
        xAxis: { type: 'category', data: labels },
        yAxis: {
          type: 'value',
          min: series.some((item) => item.data.some((value) => value != null && value < 0)) ? undefined : 0,
          axisLabel: { formatter: (value: number) => formatMoney(value) },
        },
        series,
      },
      true,
    )
  }

  const refresh = async () => {
    cache.clear()
    await render()
  }

  watch([range, metric], () => render())
  const onResize = () => chart?.resize()
  window.addEventListener('resize', onResize)
  const observer = new ResizeObserver(() => chart?.resize())
  watch(host, (el) => {
    observer.disconnect()
    if (el) observer.observe(el)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('resize', onResize)
    observer.disconnect()
    chart?.dispose()
  })

  return { range, metric, start, end, error, legend, host, render, refresh }
}
