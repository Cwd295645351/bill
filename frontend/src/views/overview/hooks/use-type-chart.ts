import { ref, watch, computed, nextTick } from 'vue'
import { useBillStore } from '@/store'
import { storeToRefs } from 'pinia'
import dayjs from 'dayjs'
import { formatDate, dayStartTs, dayEndTs } from '@/utils/dateUtil'
import * as echarts from 'echarts'

import { getBalance, getSettlement } from '../api'
import { getRecordList } from '../../record/api'

import { Bill, User } from '@/types/bill'
import type { BelongCondition, BelongUser, SettlementResult, SettlementSlice } from '../type'

/** 一张饼图：全部，或某一名当前成员 */
interface ChartSlot {
  key: string
  name: string
  userId: string
}

/** 归属为空表示公共支出 */
const isPublicBelong = (belongUserId: string | null | undefined) => belongUserId == null || belongUserId === ''

export const useTypeChart = (options: { colorOptions: string[] }) => {
  const { colorOptions } = options

  const store = useBillStore()
  const { bill, billId } = storeToRefs(store)

  const users = ref<User[]>([])

  const belongCondition = ref<BelongCondition>({
    startDate: '' as number | '',
    endDate: '' as number | '',
    quantityInputs: {},
    refundMoney: 0,
  })
  /** 已启用的数量型规则，用于动态渲染查询表单 */
  const quantityRules = computed(() => (bill.value?.overviewRules || []).filter((rule) => rule.enabled && rule.ruleType === 'quantity'))
  const belongUsers = ref<BelongUser>({ totalCost: 0, totalIncomes: 0, investCost: 0, consumptionCost: 0, details: [] })
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
  const belongTypeCharts = ref<any[]>([])
  /** 图表槽位。一名成员时只有「全部」 */
  const chartSlots = ref<ChartSlot[]>([{ key: '全部', name: '全部', userId: '' }])
  const chartCount = computed(() => chartSlots.value.length)

  const dialogVisible = ref(false)
  const detailList = ref<any[]>([])
  const loading = ref(false)
  const currentCategory = ref('')
  const currentCategoryTotal = ref(0)

  /** 点击饼图查看该类记账。明细金额用记账原金额，不再替换成分账份额 */
  const handleChartClick = async (params: any, slot: ChartSlot) => {
    const categoryName = params.name
    currentCategory.value = categoryName
    currentCategoryTotal.value = params.value
    dialogVisible.value = true
    loading.value = true
    detailList.value = []

    const costType = bill.value?.costTypes.find((item: any) => item.name === categoryName)
    if (!costType) {
      loading.value = false
      return
    }

    const searchParams: any = {
      beginDate: belongCondition.value.startDate ? dayStartTs(belongCondition.value.startDate) : '',
      endDate: belongCondition.value.endDate ? dayEndTs(belongCondition.value.endDate) : '',
      billId: (bill.value as Bill).id,
      type: 1,
      costTypeId: costType.id,
      pageIndex: 0,
      pageSize: 1000,
      condition: 'gte',
      rangeMoney: 0,
    }

    if (slot.key !== '全部' && slot.userId) {
      searchParams.belongUserId = [slot.userId, '']
    }

    const [err, res] = await getRecordList({ data: searchParams })
    loading.value = false
    if (err) return
    if (res.retCode === 0) {
      const datas = res.data.datas as any[]
      detailList.value = datas
        .filter((item: any) => {
          if (slot.key === '全部') return true
          return item.belongUserId === slot.userId || isPublicBelong(item.belongUserId)
        })
        .map((item: any) => {
          item.userName = users.value.find((u: any) => u.id === item.userId)?.name || item.userName || '未知'
          item.date = formatDate(item.date)
          return item
        })
    }
  }

  /** 用结算结果画饼图 */
  const setPieData = () => {
    const pies = piePayload.value
    if (!pies) return
    const draw = (slices: SettlementSlice[], chart: any, chartName: string) => {
      let total = 0
      belongOptions.value.title.text = chartName + '-各支出比例'
      belongOptions.value.series[0].name = chartName
      belongOptions.value.series[0].data = (slices || []).map((item) => {
        total += Number(item.money)
        return { value: Number(item.money).toFixed(2), name: item.name }
      })
      belongOptions.value.legend.data = (slices || []).map((item) => item.name)
      belongOptions.value.title.subtext = '总花费：' + total.toFixed(2)
      chart.setOption(belongOptions.value, true)
    }
    if (belongTypeCharts.value[0]) draw(pies.all, belongTypeCharts.value[0], '全部')
    pies.members.forEach((member, index) => {
      const chart = belongTypeCharts.value[index + 1]
      if (chart) draw(member.slices, chart, member.name)
    })
  }

  const disposeCharts = () => {
    belongTypeCharts.value.forEach((chart) => {
      chart?.dispose()
    })
    belongTypeCharts.value = []
  }

  /** 按当前槽位初始化饼图。槽位来自最近一次结算 */
  const initChart = () => {
    disposeCharts()
    belongOptions.value.color = colorOptions
    chartSlots.value.forEach((slot, index) => {
      const el = document.getElementById(`belongTypeChart${index}`)
      if (!el) return
      const chart = echarts.init(el)
      belongTypeCharts.value[index] = chart
      chart.on('click', (params: any) => {
        void handleChartClick(params, slot)
      })
    })
  }

  const getBalanceAndPieData = async () => {
    const params = {
      billId: billId.value,
      beginDate: dayStartTs(belongCondition.value.startDate),
      endDate: dayEndTs(belongCondition.value.endDate),
    }
    const [err, res] = await getBalance({ params })
    if (err) return
    if (res.retCode !== 0) {
      ElMessage.error('查询概览失败，' + res.message)
      return
    }
    belongUsers.value.totalCost = res.data.totalCost
    belongUsers.value.totalIncomes = res.data.totalIncomes
    belongUsers.value.investCost = res.data.investCost
    belongUsers.value.consumptionCost = res.data.totalCost - res.data.investCost
    belongUsers.value.details = res.data.belongUserCosts.map((item: any) => {
      item.userName = users.value.find((ite) => ite.id === item.userId)?.name ?? ''
      return item
    })

    const quantityInputs = Object.entries(belongCondition.value.quantityInputs).map(([ruleId, input]) => ({
      ruleId,
      quantity: input.quantity === '' || input.quantity == null ? 0 : Number(input.quantity),
      belongUserId: input.belongUserId,
    }))
    const [settleErr, settleRes] = await getSettlement({
      data: {
        billId: billId.value,
        beginDate: params.beginDate,
        endDate: params.endDate,
        quantityInputs,
      },
    })
    if (settleErr) return
    if (!settleRes || settleRes.retCode !== 0) {
      ElMessage.error('查询概览失败，' + (settleRes?.message || ''))
      return
    }
    const result = settleRes.data as SettlementResult
    settlementLines.value = result.lines || []
    piePayload.value = result.pies
    const memberPies = result.pies?.members || []
    chartSlots.value = [{ key: '全部', name: '全部', userId: '' }, ...memberPies.map((member) => ({ key: member.userId, name: member.name, userId: member.userId }))]
    await nextTick()
    initChart()
    setPieData()
  }

  /** 按当前启用的数量规则同步查询输入，保留已填数量 */
  const syncQuantityInputs = (billData: Bill) => {
    const rules = (billData.overviewRules || []).filter((rule) => rule.enabled && rule.ruleType === 'quantity')
    const next = { ...belongCondition.value.quantityInputs }
    const validIds = new Set(rules.map((rule) => rule.id))
    const defaultUserId = billData.users[0]?.id || ''
    rules.forEach((rule) => {
      if (!next[rule.id]) {
        next[rule.id] = { quantity: 0, belongUserId: defaultUserId }
      } else if (!next[rule.id].belongUserId && defaultUserId) {
        next[rule.id].belongUserId = defaultUserId
      }
    })
    Object.keys(next).forEach((id) => {
      if (!validIds.has(id)) delete next[id]
    })
    belongCondition.value.quantityInputs = next
  }

  const initData = async (billData: Bill) => {
    belongCondition.value.startDate = dayjs().startOf('year').valueOf()
    belongCondition.value.endDate = dayjs().valueOf()
    users.value = billData.users
    syncQuantityInputs(billData)
    await getBalanceAndPieData()
  }

  watch(
    bill,
    (val) => {
      if (!val) return
      initData(val)
    },
    { immediate: true },
  )

  watch(quantityRules, () => {
    if (bill.value) syncQuantityInputs(bill.value)
  })

  return {
    users,
    quantityRules,
    belongCondition,
    belongUsers,
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
