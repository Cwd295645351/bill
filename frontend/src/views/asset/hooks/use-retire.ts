import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import dayjs from 'dayjs'
import * as echarts from 'echarts'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import { getRetirePlan, saveRetirePlan } from '../api'
import { formatMoney } from '../shared'

export interface RetireView {
  plan: { amount: number; startMonth: string; targetMonth: string | null } | null
  monthlyIncome: number
  monthlyExpense: number
  idleMonths: { name: string; month: string }[]
  skipIdle: boolean
  unmatched: boolean
  message: string
  netWorth: number
  series: { month: string; value: number | null }[]
}

/** 养老计划。月均由服务端按只归属本人或全家原数计算 */
export const useRetire = (memberId: Ref<string>) => {
  const { billId } = storeToRefs(useBillStore())
  const incomeYears = ref<3 | 5>(3)
  const expenseYears = ref<3 | 5>(3)
  const skipIdle = ref(true)
  const view = ref<RetireView | null>(null)
  const amount = ref('')
  const startMonth = ref(dayjs().format('YYYY-MM'))
  const targetMonth = ref('')
  const saving = ref(false)
  const host = ref<HTMLElement | null>(null)
  let chart: echarts.ECharts | null = null

  const monthIndex = (text?: string | null) => {
    if (!text || !/^\d{4}-\d{2}$/.test(text)) return null
    const [yearText, monthPart] = text.split('-').map(Number)
    return yearText * 12 + monthPart - 1
  }

  const draw = () => {
    if (!host.value || !view.value?.plan) return
    if (!chart) chart = echarts.init(host.value)
    chart.resize()
    const plan = view.value.plan
    const series = view.value.series || []
    const base = series.find((item) => item.value != null)?.value ?? 0
    const startIndex = monthIndex(series[0]?.month)
    const targetIndex = monthIndex(plan.targetMonth)
    const totalMonths = targetIndex != null && startIndex != null ? Math.max(targetIndex - startIndex, 1) : 1
    const goal = series.map((_, offset) => {
      if (!plan.targetMonth) return plan.amount
      return Math.round((base + (plan.amount - base) * offset / totalMonths) * 100) / 100
    })
    chart.setOption({
      tooltip: { trigger: 'axis', valueFormatter: (value: unknown) => formatMoney(value == null ? null : Number(value)) },
      legend: { top: 0, data: ['账户资产', '目标进度'] },
      grid: { left: 96, right: 24, top: 36, bottom: 32 },
      xAxis: { type: 'category', boundaryGap: false, data: series.map((item) => item.month) },
      yAxis: { type: 'value', scale: true, axisLabel: { formatter: (value: number) => formatMoney(value) } },
      series: [
        { name: '账户资产', type: 'line', showSymbol: false, connectNulls: false, color: '#409eff', areaStyle: { opacity: 0.12 }, data: series.map((item) => item.value) },
        { name: '目标进度', type: 'line', showSymbol: false, color: '#e6a23c', lineStyle: { type: 'dashed', width: 2 }, data: goal },
      ],
    }, true)
  }

  const load = async () => {
    if (!billId.value) {
      view.value = null
      return
    }
    const params: { billId: string; memberId?: string; incomeYears: number; expenseYears: number; skipIdle: string } = {
      billId: billId.value,
      incomeYears: incomeYears.value,
      expenseYears: expenseYears.value,
      skipIdle: skipIdle.value ? '1' : '0',
    }
    if (memberId.value) params.memberId = memberId.value
    const [err, res] = await getRetirePlan({ params })
    if (err || !res || res.retCode !== 0) {
      if (res?.message) ElMessage.error(res.message)
      return
    }
    view.value = res.data
    if (res.data?.plan) {
      amount.value = String(res.data.plan.amount)
      startMonth.value = res.data.plan.startMonth
      targetMonth.value = res.data.plan.targetMonth || ''
    }
    draw()
  }

  const save = async () => {
    if (!billId.value) return false
    saving.value = true
    const [err, res] = await saveRetirePlan({
      data: {
        billId: billId.value,
        memberId: memberId.value || undefined,
        amount: Number(amount.value),
        startMonth: startMonth.value,
        targetMonth: targetMonth.value || undefined,
      },
    })
    saving.value = false
    if (err || !res || res.retCode !== 0) {
      ElMessage.error(res?.message || '保存失败')
      return false
    }
    view.value = res.data
    draw()
    return true
  }

  watch([incomeYears, expenseYears, skipIdle], () => load())
  watch(host, () => draw())
  onBeforeUnmount(() => chart?.dispose())

  return { incomeYears, expenseYears, skipIdle, view, amount, startMonth, targetMonth, saving, host, load, save }
}
