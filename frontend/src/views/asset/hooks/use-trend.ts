import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import dayjs, { type Dayjs } from 'dayjs'
import * as echarts from 'echarts'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import { getAssetTrend, getOverview } from '../api'
import { formatMoney, shortAmount } from '../shared'
import type { AssetTrendResponse } from '../type'

export type TrendRange = 'since' | 'thisYear' | 'y1' | 'y3' | 'y5' | 'custom'
export type TrendGrain = 'month' | 'year'
export type TrendMetric = 'all' | 'net'

const COLORS: Record<string, string> = {
  liquid: '#409eff',
  invest: '#fac858',
  fixed: '#91cc75',
  receivable: '#73c0de',
  liability: '#f74f4f',
  net: '#18a356'
}

/** 一次请求 /asset/trend；overview 只用于「记账以来」最早月 */
export const useTrend = (memberId: Ref<string>) => {
  const { billId } = storeToRefs(useBillStore())
  const range = ref<TrendRange>('since')
  const grain = ref<TrendGrain>('month')
  const metric = ref<TrendMetric>('all')
  const start = ref(dayjs().startOf('year').format('YYYY-MM'))
  const end = ref(dayjs().format('YYYY-MM'))
  const error = ref('')
  const legend = ref<{ name: string; color: string; last: number | null; change: number | null }[]>([])
  const host = ref<HTMLElement | null>(null)
  let chart: echarts.ECharts | null = null
  const cache = new Map<string, AssetTrendResponse>()
  let earliestMonth = ''

  const bounds = (): { from: Dayjs; to: Dayjs; capped?: boolean } | null => {
    const now = dayjs().startOf('month')
    if (range.value === 'since') {
      const from = earliestMonth ? dayjs(earliestMonth).startOf('month') : now
      return { from: from.isAfter(now) ? now : from, to: now }
    }
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

  const render = async () => {
    error.value = ''
    if (!billId.value || !host.value) return
    if (range.value === 'since') {
      const params: { billId: string; memberId?: string } = { billId: billId.value }
      if (memberId.value) params.memberId = memberId.value
      const [err, res] = await getOverview({ params })
      if (!err && res?.retCode === 0) earliestMonth = res.data?.earliestRecordMonth || ''
    }
    const window = bounds()
    if (!window) {
      error.value = '开始日期不能晚于结束日期'
      chart?.clear()
      return
    }

    const startMonth = window.from.format('YYYY-MM')
    const endMonth = window.to.format('YYYY-MM')
    const cacheKey = `${billId.value}-${memberId.value}-${startMonth}-${endMonth}-${grain.value}-${metric.value}`
    let data = cache.get(cacheKey)
    if (!data) {
      const params: {
        billId: string
        startMonth: string
        endMonth: string
        grain: TrendGrain
        metric: TrendMetric
        memberId?: string
      } = {
        billId: billId.value || '',
        startMonth,
        endMonth,
        grain: grain.value,
        metric: metric.value
      }
      if (memberId.value) params.memberId = memberId.value
      const [err, res] = await getAssetTrend({ params })
      if (err || !res || res.retCode !== 0) {
        error.value = res?.message || '读取趋势失败'
        return
      }
      data = res.data as AssetTrendResponse
      cache.set(cacheKey, data)
    }

    if (!chart || chart.isDisposed() || chart.getDom() !== host.value) {
      if (chart && !chart.isDisposed()) chart.dispose()
      chart = echarts.init(host.value)
    }
    chart.resize()

    const labelsShown = data.labels.map((label) => (grain.value === 'year' && /^\d{4}$/.test(label) ? `${label}年` : label))
    const seriesShown = (data.series || []).map((item) => ({
      name: item.name,
      type: 'line' as const,
      stack: metric.value === 'net' ? 'net' : 'asset',
      stackStrategy: metric.value === 'net' ? undefined : ('samesign' as const),
      areaStyle: {},
      showSymbol: grain.value === 'year',
      color: COLORS[item.key] || '#18a356',
      data: item.values
    }))

    const hasValue = seriesShown.some((item) => item.data.some((value) => value != null))
    legend.value = seriesShown.map((item, index) => {
      const meta = data!.legend?.[index]
      if (meta && (meta.last != null || meta.first != null)) {
        return {
          name: item.name,
          color: item.color,
          last: meta.last,
          change: meta.delta
        }
      }
      const numbers = item.data.filter((value): value is number => value != null)
      if (!numbers.length) return { name: item.name, color: item.color, last: null, change: null }
      return {
        name: item.name,
        color: item.color,
        last: numbers[numbers.length - 1],
        change: numbers[numbers.length - 1] - numbers[0]
      }
    })

    if (!hasValue) {
      error.value = '该区间没有盘点'
      chart.clear()
      return
    }
    if (window.capped || data.capped) error.value = '结束日期晚于当前月，只画到当前月'

    const signedShort = (value: number | null, withPlus = false) => {
      if (value == null || Number.isNaN(value)) return '—'
      const text = shortAmount(Math.abs(value))
      if (value < -0.004) return `-${text}`
      if (withPlus && value > 0.004) return `+${text}`
      return text
    }
    const hasNegative = seriesShown.some((item) => item.data.some((value) => value != null && value < 0))
    chart.setOption(
      {
        tooltip: { trigger: 'axis', valueFormatter: (value: unknown) => formatMoney(value == null ? null : Number(value)) },
        legend: {
          top: 4,
          left: 0,
          right: 0,
          itemWidth: 14,
          itemHeight: 12,
          itemGap: 22,
          textStyle: {
            fontSize: 16,
            lineHeight: 28,
            color: '#666',
            rich: {
              tag: { fontSize: 16, lineHeight: 28, color: '#999', padding: [0, 4, 0, 8] },
              num: { fontSize: 16, lineHeight: 28, color: '#666' },
              up: { fontSize: 16, lineHeight: 28, color: '#18a356' },
              down: { fontSize: 16, lineHeight: 28, color: 'rgb(247, 79, 79)' },
              flat: { fontSize: 16, lineHeight: 28, color: '#666' }
            }
          },
          formatter: (name: string) => {
            const item = legend.value.find((row) => row.name === name)
            if (!item || item.last == null) return `${name} 无`
            const tone = item.change == null || Math.abs(item.change) < 0.005 ? 'flat' : item.change > 0 ? 'up' : 'down'
            return `${name}{tag|期末}{num|${signedShort(item.last)}}{tag|变化}{${tone}|${signedShort(item.change, true)}}`
          }
        },
        grid: { left: 88, right: 16, top: seriesShown.length > 2 ? 88 : 52, bottom: labelsShown.length > 18 ? 64 : 32 },
        xAxis: { type: 'category', data: labelsShown, axisLabel: labelsShown.length > 18 ? { rotate: 45, fontSize: 11 } : {} },
        yAxis: {
          type: 'value',
          min: hasNegative ? undefined : 0,
          axisLabel: { formatter: (value: number) => signedShort(value) }
        },
        series: seriesShown
      },
      true
    )
  }

  const refresh = async () => {
    cache.clear()
    await render()
  }

  watch([range, metric, grain], () => render())
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

  return { range, grain, metric, start, end, error, legend, host, render, refresh }
}
