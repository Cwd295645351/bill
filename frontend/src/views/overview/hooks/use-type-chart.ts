import { ref, watch, computed, nextTick, onBeforeUnmount } from 'vue'
import { useBillStore } from '@/store'
import { storeToRefs } from 'pinia'
import dayjs from 'dayjs'
import { formatDate, dayStartTs, dayEndTs } from '@/utils/dateUtil'
import * as echarts from 'echarts'

import { getBalance, getCategoryRecords, getSettlement } from '../api'

import type { BelongCondition, BelongUser, CategoryRecord, MoneyRow, SettlementResult, SettlementSlice } from '../type'

/** 一张饼图：全部，或某一名当前成员 */
interface ChartSlot {
  key: string
  name: string
  userId: string
}

export const useTypeChart = (options: { colorOptions: string[] }) => {
  const { colorOptions } = options

  const store = useBillStore()
  const { bill, billId } = storeToRefs(store)

  const belongCondition = ref<BelongCondition>({
    startDate: '' as number | '',
    endDate: '' as number | '',
    quantityInputs: {},
    refundMoney: 0,
  })
  /** 已启用的数量型规则，用于动态渲染查询表单 */
  const quantityRules = computed(() => (bill.value?.overviewRules || []).filter((rule) => rule.enabled && rule.ruleType === 'quantity'))
  const belongUsers = ref<BelongUser>({ totalCost: 0, totalIncomes: 0, investCost: 0, consumptionCost: 0, details: [] })
  /** 只留在当前页，换账本或重新进入时回到关闭 */
  const cumulativeIncome = ref(false)
  /** 日期或开关变了、还没成功查询时，收入区间说明用本地预览 */
  const noteDirty = ref(true)
  const serverNote = ref('')
  const incomeLabel = ref('总收入')
  const incomeRows = ref<MoneyRow[]>([])
  let querySeq = 0
  /** 服务端返回的结算文案。查询失败时保留上一次 */
  const settlementLines = ref<string[]>([])
  /** 最近一次成功的支出结构 */
  const piePayload = ref<SettlementResult['pies'] | null>(null)
  const belongOptions = ref<any>({
    title: {
      text: '',
      top: 30,
      left: 'center',
      subtextStyle: {
        fontSize: 16,
      },
    },
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)',
    },
    color: [],
    legend: { type: 'scroll', data: [] },
    series: [
      {
        name: '',
        type: 'pie',
        selectedMode: 'single',
        radius: ['40', '50%'],
        top: '15%',
        label: {
          formatter: '{b}({d}%)',
          fontSize: 14,
        },
        data: [],
      },
    ],
  })
  const belongTypeCharts: (echarts.ECharts | null)[] = []
  /** 图表槽位。一名成员时只有「全部」 */
  const chartSlots = ref<ChartSlot[]>([{ key: '全部', name: '全部', userId: '' }])
  const chartCount = computed(() => chartSlots.value.length)

  const dialogVisible = ref(false)
  const detailList = ref<CategoryRecord[]>([])
  const loading = ref(false)
  const currentCategory = ref('')
  const currentCategoryTotal = ref<number | string>(0)

  /** 点击饼图查看该类记账。与手机概览共用分类明细，金额是记账原金额 */
  const handleChartClick = async (params: { name?: string; value?: number | string; data?: { costTypeId?: string } }, slot: ChartSlot) => {
    const costTypeId = String(params.data?.costTypeId || '')
    currentCategory.value = params.name || ''
    currentCategoryTotal.value = params.value ?? 0
    dialogVisible.value = true
    loading.value = true
    detailList.value = []

    if (!costTypeId || !belongCondition.value.startDate || !belongCondition.value.endDate) {
      loading.value = false
      dialogVisible.value = false
      return
    }

    const [err, res] = await getCategoryRecords({
      params: {
        billId: billId.value,
        beginDate: formatDate(belongCondition.value.startDate),
        endDate: formatDate(belongCondition.value.endDate),
        costTypeId,
        ...(slot.userId ? { memberId: slot.userId } : {}),
      },
    })
    loading.value = false
    if (err || !res || res.retCode !== 0) {
      if (res && res.retCode !== 0) ElMessage.error(res.message || '查询明细失败')
      dialogVisible.value = false
      return
    }
    detailList.value = res.data?.records || []
  }

  /** 用结算结果画饼图 */
  const setPieData = () => {
    const pies = piePayload.value
    if (!pies) return
    const draw = (slices: SettlementSlice[], chart: echarts.ECharts, chartName: string) => {
      let total = 0
      belongOptions.value.title.text = chartName + '-各支出比例'
      belongOptions.value.series[0].name = chartName
      belongOptions.value.series[0].data = (slices || []).map((item) => {
        total += Number(item.money)
        return { value: Number(item.money).toFixed(2), name: item.name, costTypeId: item.costTypeId }
      })
      belongOptions.value.legend.data = (slices || []).map((item) => item.name)
      belongOptions.value.title.subtext = '总花费：' + total.toFixed(2)
      chart.setOption(belongOptions.value, true)
    }
    if (belongTypeCharts[0]) draw(pies.all, belongTypeCharts[0], '全部')
    pies.members.forEach((member, index) => {
      const chart = belongTypeCharts[index + 1]
      if (chart) draw(member.slices, chart, member.name)
    })
  }

  const disposeCharts = () => {
    belongTypeCharts.forEach((chart) => {
      chart?.dispose()
    })
    belongTypeCharts.length = 0
  }

  /** 按当前槽位初始化饼图。槽位来自最近一次结算 */
  const initChart = () => {
    disposeCharts()
    belongOptions.value.color = colorOptions
    chartSlots.value.forEach((slot, index) => {
      const el = document.getElementById(`belongTypeChart${index}`)
      if (!el) return
      const chart = echarts.init(el)
      belongTypeCharts[index] = chart
      chart.on('click', (params: any) => {
        void handleChartClick(params, slot)
      })
    })
  }

  const crossYear = computed(() => {
    const start = belongCondition.value.startDate
    const end = belongCondition.value.endDate
    if (!start || !end) return false
    return dayjs(start).year() !== dayjs(end).year()
  })

  const localNote = computed(() => {
    if (!cumulativeIncome.value || crossYear.value) return ''
    const start = belongCondition.value.startDate
    const end = belongCondition.value.endDate
    if (!start || !end) return ''
    const incomeStart = dayjs(start).startOf('year')
    const same = dayjs(start).startOf('day').valueOf() === incomeStart.valueOf()
    const text = `收入区间：${incomeStart.format('YYYY-MM-DD')} 至 ${dayjs(end).format('YYYY-MM-DD')}`
    return same ? `${text}，与支出区间相同` : text
  })

  /** 开关关闭时不显示说明。未查询成功前用本地预览，成功后用服务端四个时间戳 */
  const incomeNote = computed(() => {
    if (!cumulativeIncome.value || crossYear.value) return ''
    if (noteDirty.value || !serverNote.value) return localNote.value
    return serverNote.value
  })

  const noteFromServer = (result: SettlementResult) => {
    const begin = dayjs(result.incomeBeginDate).format('YYYY-MM-DD')
    const end = dayjs(result.incomeEndDate).format('YYYY-MM-DD')
    const same = result.incomeBeginDate === result.expenseBeginDate && result.incomeEndDate === result.expenseEndDate
    const text = `收入区间：${begin} 至 ${end}`
    return same ? `${text}，与支出区间相同` : text
  }

  const getBalanceAndPieData = async () => {
    const seq = ++querySeq
    const expenseBegin = dayStartTs(belongCondition.value.startDate)
    const expenseEnd = dayEndTs(belongCondition.value.endDate)
    const useCumulative = cumulativeIncome.value && !crossYear.value
    const incomeBegin = useCumulative ? dayjs(expenseBegin).startOf('year').valueOf() : expenseBegin
    const rangesDiffer = useCumulative && incomeBegin !== expenseBegin
    const params = {
      billId: billId.value,
      beginDate: expenseBegin,
      endDate: expenseEnd,
    }
    const balanceTask = getBalance({ params })
    const incomeTask = rangesDiffer
      ? getBalance({ params: { billId: billId.value, beginDate: incomeBegin, endDate: expenseEnd } })
      : null
    const settleTask = getSettlement({
      data: useCumulative ? { ...params, cumulativeIncome: true } : params,
    })
    const [err, res] = await balanceTask
    const incomeResult = incomeTask ? await incomeTask : null
    const [settleErr, settleRes] = await settleTask
    if (seq !== querySeq) return
    if (err || !res || res.retCode !== 0) {
      ElMessage.error('查询概览失败，' + (res?.message || ''))
      return
    }
    if (incomeResult && (incomeResult[0] || !incomeResult[1] || incomeResult[1].retCode !== 0)) {
      ElMessage.error('查询概览失败，' + (incomeResult[1]?.message || ''))
      return
    }
    if (settleErr || !settleRes || settleRes.retCode !== 0) {
      ElMessage.error('查询概览失败，' + (settleRes?.message || ''))
      return
    }
    const result = settleRes.data as SettlementResult
    const serverDiffer =
      result.incomeBeginDate !== result.expenseBeginDate || result.incomeEndDate !== result.expenseEndDate
    belongUsers.value.totalCost = res.data.totalCost
    belongUsers.value.investCost = res.data.investCost
    belongUsers.value.consumptionCost = res.data.totalCost - res.data.investCost
    belongUsers.value.totalIncomes = incomeResult ? incomeResult[1].data.totalIncomes : res.data.totalIncomes
    incomeRows.value = (result.members || [])
      .filter((member) => Number(member.income) > 0)
      .map((member) => ({ userId: member.userId, name: member.name, money: Number(member.income) }))
    incomeLabel.value = serverDiffer ? '总收入（分账区间）' : '总收入'
    serverNote.value = noteFromServer(result)
    noteDirty.value = false
    settlementLines.value = result.lines || []
    piePayload.value = result.pies
    const memberPies = result.pies?.members || []
    chartSlots.value = [{ key: '全部', name: '全部', userId: '' }, ...memberPies.map((member) => ({ key: member.userId, name: member.name, userId: member.userId }))]
    await nextTick()
    initChart()
    setPieData()
  }

  const initData = async () => {
    cumulativeIncome.value = false
    noteDirty.value = true
    serverNote.value = ''
    incomeLabel.value = '总收入'
    belongCondition.value.startDate = dayjs().startOf('year').valueOf()
    belongCondition.value.endDate = dayjs().valueOf()
    await getBalanceAndPieData()
  }

  watch(
    () => [belongCondition.value.startDate, belongCondition.value.endDate],
    () => {
      noteDirty.value = true
      if (crossYear.value && cumulativeIncome.value) {
        cumulativeIncome.value = false
        ElMessage.warning('跨年时按支出区间自身的收入分账')
      }
    },
    { flush: 'sync' },
  )

  watch(
    cumulativeIncome,
    () => {
      noteDirty.value = true
    },
    { flush: 'sync' },
  )

  watch(
    bill,
    (val) => {
      if (!val) return
      initData()
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    disposeCharts()
  })

  return {
    quantityRules,
    belongCondition,
    belongUsers,
    cumulativeIncome,
    crossYear,
    incomeNote,
    incomeLabel,
    incomeRows,
    settlementLines,
    getBalanceAndPieData,
    dialogVisible,
    detailList,
    loading,
    currentCategory,
    currentCategoryTotal,
    chartCount,
  }
}
