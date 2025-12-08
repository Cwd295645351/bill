import { Ref, onMounted, ref, watch } from 'vue'
import { useBillStore } from '@/store'
import { storeToRefs } from 'pinia'
import dayjs from 'dayjs'
import * as echarts from 'echarts'

import { getBalance } from '../api'

import { Bill, User } from '@/types/bill'
import type { BelongCondition, BelongUser } from '../type'

export const useTypeChart = (options: { colorOptions: string[] }) => {
  const { colorOptions } = options

  const store = useBillStore()
  const { bill, billId } = storeToRefs(store)

  const users = ref<User[]>([])

  const belongCondition = ref<BelongCondition>({ startDate: '', endDate: ''})
  const belongUsers = ref<BelongUser>({ totalCost: 0, totalIncomes: 0, investCost: 0, consumptionCost: 0, details: [] })
  /** 各归属人不同类型支出数据 */
  const belongTypeDatas = ref<Record<string, any>>({})
  const belongOptions = ref<any>({
    title: {
      text: '',
      top: 50,
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
  const belongTypeChart1 = ref<any>(null)
  const belongTypeChart2 = ref<any>(null)
  const belongTypeChart3 = ref<any>(null)

  /** 设置各归属人支出比例 */
  const setTypeData = (costTypeRank: any, proportion: string) => {
    const proportionArray = proportion.split(':')
    const total = Number(proportionArray[0]) + Number(proportionArray[1])
    const proportion1 = total ? Number(proportionArray[0]) / total : 0.5 // 宜比例
    const proportion2 = total ? Number(proportionArray[1]) / total : 0.5 // 栋比例
    console.log(proportion1, proportion2, 'proportion1, proportion2')
    const data: any = {
      全部: [],
      宜: [],
      栋: [],
    }
    const allRank = costTypeRank['全部'] || []
    const rank1 = costTypeRank['宜'] || [] // 宜
    const rank2 = costTypeRank['栋'] || [] // 栋
    // 全部类型数据处理
    const totalTypeDataHandle = (item: any) => {
      const allTypeDataIndex = data['全部'].findIndex((ite: any) => ite.type === item.type)
      if (allTypeDataIndex !== -1) {
        const obj = data['全部'][allTypeDataIndex]
        data['全部'][allTypeDataIndex] = { ...obj, money: obj.money + item.money }
      } else data['全部'].push(item)
    }
    allRank.forEach((item: any) => {
      data['全部'].push(item)
      data['宜'].push({ ...item, money: item.money * proportion1 })
      data['栋'].push({ ...item, money: item.money * proportion2 })
    })
    rank1.forEach((item: any) => {
      const index = data['宜'].findIndex((ite: any) => ite.type === item.type)
      if (index !== -1) {
        const obj = data['宜'][index]
        data['宜'][index] = { ...obj, money: obj.money + item.money }
      } else data['宜'].push(item)

      totalTypeDataHandle(item)
    })
    rank2.forEach((item: any) => {
      const index = data['栋'].findIndex((ite: any) => ite.type === item.type)
      if (index !== -1) {
        const obj = data['栋'][index]
        data['栋'][index] = { ...obj, money: obj.money + item.money }
      } else data['栋'].push(item)
      totalTypeDataHandle(item)
    })

    const sortData = (data: any) => {
      return data
        .sort((a: any, b: any) => b.money - a.money)
        .map((item: any) => {
          item.money = Number(item.money.toFixed(2))
          return item
        })
    }

    // 对数据进行排序
    data['全部'] = sortData(data['全部'])
    data['栋'] = sortData(data['栋'])
    data['宜'] = sortData(data['宜'])

    belongTypeDatas.value = data
    console.log(belongTypeDatas.value, 111)
  }

  /** 设置饼图 */
  const setPieData = () => {
    const setSeriesData = (target: any, source: any, chart: any, chartName: string) => {
      let total = 0
      belongOptions.value.title.text = chartName + '-各支出比例'
      target.name = chartName
      target.data = source.map((item: any) => {
        total += item.money
        return { value: item.money.toFixed(2), name: item.name }
      })
      belongOptions.value.title.subtext = '总花费：' + total.toFixed(2)
      chart.setOption(belongOptions.value, true)
    }
    belongOptions.value.legend.data = belongTypeDatas.value.type

    setSeriesData(belongOptions.value.series[0], belongTypeDatas.value['全部'], belongTypeChart1.value, '全部')
    setSeriesData(belongOptions.value.series[0], belongTypeDatas.value['宜'], belongTypeChart2.value, '宜')
    setSeriesData(belongOptions.value.series[0], belongTypeDatas.value['栋'], belongTypeChart3.value, '栋')
  }

  const getBalanceAndPieData = async () => {
    const params = { billId: billId.value, beginDate: belongCondition.value.startDate, endDate: belongCondition.value.endDate }
    const [err, res] = await getBalance({ params })
    if (err) return
    if (res.retCode === 0) {
      belongUsers.value.totalCost = res.data.totalCost
      belongUsers.value.totalIncomes = res.data.totalIncomes
      belongUsers.value.investCost = res.data.investCost
      belongUsers.value.consumptionCost = res.data.totalCost - res.data.investCost
      belongUsers.value.details = res.data.belongUserCosts.map((item: any) => {
        item.userName = users.value.find((ite) => ite.id === item.userId)?.name ?? ''
        return item
      })

      // 获取宜收入
      const yiIncomes = res.data.belongUserCosts.find((item: any) => item.type === 2 && item.belongUserName === '宜')?.money ?? 0
      // 获取栋收入
      const dongIncomes = res.data.belongUserCosts.find((item: any) => item.type === 2 && item.belongUserName === '栋')?.money ?? 0
      const proportion = `${yiIncomes.toFixed(2)}:${dongIncomes.toFixed(2)}`
      console.log(proportion, 'proportion')

      setTypeData(res.data.costTypeRank, proportion)
      setPieData()
    } else {
      ElMessage.error('查询概览失败，' + res.message)
    }
  }

  const initData = (bill: Bill) => {
    belongCondition.value.startDate = dayjs().startOf('month').format('YYYY-MM-DD')
    belongCondition.value.endDate = dayjs().format('YYYY-MM-DD')
    users.value = bill.users
    getBalanceAndPieData()
  }

  const initChart = () => {
    belongTypeChart1.value = echarts.init(document.getElementById('belongTypeChart1') as HTMLElement)
    belongTypeChart2.value = echarts.init(document.getElementById('belongTypeChart2') as HTMLElement)
    belongTypeChart3.value = echarts.init(document.getElementById('belongTypeChart3') as HTMLElement)
    belongOptions.value.color = colorOptions
  }

  watch(
    bill,
    (val) => {
      if (!val) return
      initData(val)
    },
    { immediate: true },
  )

  onMounted(() => {
    initChart()
  })

  return { belongCondition, belongUsers, getBalanceAndPieData }
}
