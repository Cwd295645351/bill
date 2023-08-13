import { onMounted, ref, watch, Ref } from 'vue'
import dayjs from 'dayjs'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import { getCurrentMonthCost } from '../api'
import * as echarts from 'echarts'

import type { MonthOverview, BelongUserCost } from '../type'
import type { Bill, User } from '@/types/bill'

export const useStatistics = (options: { users: Ref<User[]> }) => {
  const { users } = options
  const store = useBillStore()
  const { bill } = storeToRefs(store)

  /** 本月概览数据 */
  const monthOverview = ref<MonthOverview>({
    /** 总支出 */
    totalCost: 0,
    /** 团队归属人支出明细 */
    belongUserCosts: [],
    /** 预算 */
    budget: 0,
  })
  /** 支出比例 */
  const proportion = ref({ first: '954.44', second: '1055', money: 0 })
  const chart = ref<any>(null)
  const chartOptions = ref({
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}({d}%)',
    },
    legend: {
      orient: 'horizontal',
      type: 'scroll',
      bottom: 0,
    },
    series: [
      {
        name: '各支出类型占比',
        type: 'pie',
        radius: '80%',
        data: [],
        label: {
          show: false,
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
      },
    ],
  })

  /** 查询本月收支概况 */
  const getCost = async () => {
    const params = { billId: (bill.value as Bill)._id }
    const [err, res] = await getCurrentMonthCost({ params })
    if (err) return
    if (res.retCode === 0) {
      monthOverview.value.totalCost = res.data.totalCost
      monthOverview.value.belongUserCosts = res.data.belongUserCosts.map((item: BelongUserCost) => {
        item.userName = (users.value.find((ite) => ite.id === item.userId) as User).name
        return item
      })
      chartOptions.value.series[0].data = res.data.costTypeCost.map((item: any) => {
        return { value: item.money, name: item.name }
      })
      chart.value.setOption(chartOptions.value, true)
      calculateMoney()
    } else {
      ElMessage.error('查询本月收支概况失败，', res.message)
    }
  }

  /** 合计退款 */
  const calculateMoney = () => {
    const costs = monthOverview.value.belongUserCosts
    const currProportion = proportion.value
    const first = Number(currProportion.first)
    const second = Number(currProportion.second)
    let money = 0
    costs.forEach((item) => {
      if (item.userName === '宜') {
        if (item.belongUserId === '') {
          money += item.money * (second / (first + second))
        } else if (item.belongUserName === '栋') {
          money += item.money
        }
      } else if (item.userName === '栋') {
        if (item.belongUserId === '') {
          money -= item.money * (first / (first + second))
        } else if (item.belongUserName === '宜') {
          money -= item.money
        }
      }
    })
    currProportion.money = Number(money.toFixed(2))
  }

  watch(bill, (val) => {
    initData(val as Bill)
  })

  const initData = (bill: Bill) => {
    const budget = bill.budget
    monthOverview.value.budget = budget.find((item) => item.date === Number(dayjs(new Date()).format('YYYY-MM')))?.totalBudget || 0
    getCost()
  }

  onMounted(() => {
    chart.value = echarts.init(document.getElementById('costStatistics') as HTMLElement)
    setTimeout(() => {
      initData(bill.value as Bill)
    }, 300)
  })

  return { monthOverview, proportion, getCost, calculateMoney }
}
