import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import dayjs from 'dayjs'
import * as echarts from 'echarts'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import { getMonthlyReport } from '../api'
import { formatMoney, roundMoney } from '../shared'
import type { MonthlyReport } from '../type'

/** 月历每张图单独一个坐标系，颜色和原型一致 */
export const MONTH_ROWS = [
  { key: '总资产', wide: true, color: '#5b8ff9' },
  { key: '总净资产', wide: true, color: '#18a356' },
  { key: '流动资金', wide: false, color: '#409eff' },
  { key: '投资理财', wide: false, color: '#fac858' },
  { key: '固定资产', wide: false, color: '#91cc75' },
  { key: '应收款', wide: false, color: '#73c0de' },
  { key: '总负债', wide: true, color: '#f74f4f' },
]

/** 月历柱状图。没有盘点的月份留空，今年高亮本月，往年高亮 12 月 */
export const useMonthChart = (memberId: Ref<string>) => {
  const { billId } = storeToRefs(useBillStore())
  const year = ref(dayjs().year())
  const report = ref<MonthlyReport>({})
  const hosts = ref<HTMLElement[]>([])
  const charts: echarts.ECharts[] = []

  const setHost = (el: unknown, index: number) => {
    if (el instanceof HTMLElement) hosts.value[index] = el
  }

  const render = () => {
    const highlight = year.value === dayjs().year() ? dayjs().month() : 11
    MONTH_ROWS.forEach((row, index) => {
      const el = hosts.value[index]
      if (!el) return
      if (!charts[index]) charts[index] = echarts.init(el)
      charts[index].resize()
      const monthlyData = report.value[row.key]?.monthlyData || Array.from({ length: 12 }, () => null)
      const hasNegative = monthlyData.some((value) => value != null && value < 0)
      charts[index].setOption(
        {
          grid: { left: 88, right: 12, top: 16, bottom: 28 },
          tooltip: { trigger: 'axis', valueFormatter: (value: unknown) => formatMoney(value == null ? null : Number(value)) },
          xAxis: {
            type: 'category',
            data: Array.from({ length: 12 }, (_, month) => `${month + 1}月`),
            axisLabel: {
              color: '#999',
              fontSize: 11,
              formatter: (label: string, month: number) => (month === highlight ? `{now|${label}}` : label),
              rich: { now: { color: '#1d4f91', fontWeight: 600, fontSize: 11 } },
            },
          },
          yAxis: {
            type: 'value',
            min: hasNegative ? undefined : 0,
            axisLabel: { color: '#999', fontSize: 11, formatter: (value: number) => formatMoney(value) },
          },
          series: [
            {
              type: 'bar',
              barMaxWidth: 28,
              data: monthlyData.map((value, month) => ({
                value: roundMoney(value),
                itemStyle: {
                  color: row.color,
                  borderColor: month === highlight && value != null ? '#1d4f91' : 'transparent',
                  borderWidth: month === highlight && value != null ? 2 : 0,
                },
              })),
            },
          ],
        },
        true,
      )
    })
  }

  const load = async () => {
    if (!billId.value) {
      report.value = {}
      render()
      return
    }
    const params: { billId: string; year: number; memberId?: string } = { billId: billId.value, year: year.value }
    if (memberId.value) params.memberId = memberId.value
    const [err, res] = await getMonthlyReport({ params })
    if (err || !res || res.retCode !== 0) {
      if (res?.message) ElMessage.error(res.message)
      return
    }
    report.value = res.data || {}
    render()
  }

  const years = Array.from({ length: 6 }, (_, index) => dayjs().year() - index)
  watch(year, load)
  const onResize = () => charts.forEach((chart) => chart.resize())
  window.addEventListener('resize', onResize)
  onBeforeUnmount(() => {
    window.removeEventListener('resize', onResize)
    charts.forEach((chart) => chart.dispose())
  })

  return { year, years, rows: MONTH_ROWS, report, setHost, load, render }
}
