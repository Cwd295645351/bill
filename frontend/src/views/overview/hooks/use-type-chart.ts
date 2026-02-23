import { Ref, onMounted, ref, watch } from 'vue'
import { useBillStore } from '@/store'
import { storeToRefs } from 'pinia'
import dayjs from 'dayjs'
import * as echarts from 'echarts'

import { getBalance } from '../api'
import { getRecordList } from '../../record/api'

import { Bill, User } from '@/types/bill'
import type { BelongCondition, BelongUser } from '../type'

export const useTypeChart = (options: { colorOptions: string[] }) => {
  const { colorOptions } = options

  const store = useBillStore()
  const { bill, billId } = storeToRefs(store)

  const users = ref<User[]>([])

  const belongCondition = ref<BelongCondition>({ startDate: '', endDate: '', days: 0, refundMoney: 0 })
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

  const dialogVisible = ref(false)
  const detailList = ref<any[]>([])
  const loading = ref(false)
  const currentCategory = ref('')
  const currentCategoryTotal = ref(0)
  const currentProportion = ref({ yi: 0.5, dong: 0.5 })

  /** 点击饼图处理 */
  const handleChartClick = async (params: any, belongUserName: string) => {
    const categoryName = params.name
    currentCategory.value = categoryName
    currentCategoryTotal.value = params.value // echart 点击事件中 params.value 就是该项的值
    dialogVisible.value = true
    loading.value = true
    detailList.value = []

    // 查找 costTypeId
    const costType = bill.value?.costTypes.find((item: any) => item.name === categoryName)
    if (!costType) {
      loading.value = false
      return
    }

    const searchParams: any = {
      beginDate: belongCondition.value.startDate,
      endDate: belongCondition.value.endDate,
      billId: (bill.value as Bill)._id,
      type: 1, // 支出
      costTypeId: costType.id,
      pageIndex: 0,
      pageSize: 1000,
      condition: 'gte',
      rangeMoney: 0,
    }

    // 如果点击的是特定归属人的饼图，查询该归属人 + "全部" 归属的数据
    if (belongUserName !== '全部') {
      const belongUser = bill.value?.users.find((u: any) => u.name === belongUserName)
      if (belongUser) {
        // 传入数组，查询该用户和归属人为"全部"(即空字符串)的数据
        searchParams.belongUserId = [belongUser.id, '']
      }
    }

    const [err, res] = await getRecordList({ params: searchParams })
    loading.value = false
    if (err) return
    if (res.retCode === 0) {
      const datas = res.data.datas as any[]
      detailList.value = datas
        .filter((item: any) => {
          // 如果是专属饼图，额外确保只包含该归属人或“全部”归属的数据
          // 防止后端在处理数组查询时返回不符合预期的数据
          if (belongUserName !== '全部') {
            const belongUser = bill.value?.users.find((u: any) => u.name === belongUserName)
            const currentBelongUserId = belongUser ? belongUser.id : null
            return item.belongUserId === currentBelongUserId || item.belongUserId === '' || !item.belongUserId
          }
          return true
        })
        .map((item: any) => {
          item.userName = users.value.find((u: any) => u.id === item.userId)?.name || '未知'
          item.date = dayjs(item.date).format('YYYY-MM-DD')
          item.totalMoney = item.money // 保存原始总金额

          // 如果是专属饼图，且这条记录的归属人是"全部"，则按比例计算
          if (belongUserName !== '全部' && (item.belongUserId === '' || !item.belongUserId)) {
            const ratio = belongUserName === '宜' ? currentProportion.value.yi : currentProportion.value.dong
            item.money = Number((item.totalMoney * ratio).toFixed(2))
          }
          return item
        })
    }
  }

  /** 设置各归属人支出比例 */
  const setTypeData = (costTypeRank: any, proportion: string) => {
    const proportionArray = proportion.split(':')
    const total = Number(proportionArray[0]) + Number(proportionArray[1])
    const proportion1 = total ? Number(proportionArray[0]) / total : 0.5 // 宜比例
    const proportion2 = total ? Number(proportionArray[1]) / total : 0.5 // 栋比例
    currentProportion.value = { yi: proportion1, dong: proportion2 }
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

  /** 合计退款 */
  const calculateMoney = (proportion: string) => {
    const costs = belongUsers.value.details
    const proportionArray = proportion.split(':')
    const proportion0 = Number(proportionArray[0])
    const proportion1 = Number(proportionArray[1])
    console.log(proportion0, proportion1, 'proportion0, proportion1')
    const total = proportion0 + proportion1
    console.log(total, 'total')
    let money = 0
    costs.forEach((item) => {
      if (item.userName === '宜') {
        if (item.belongUserId === '') {
          money += item.money * (proportion1 / total)
        } else if (item.belongUserName === '栋') {
          money += item.money
        }
      } else if (item.userName === '栋') {
        if (item.belongUserId === '') {
          money -= item.money * (proportion0 / total)
        } else if (item.belongUserName === '宜') {
          money -= item.money
        }
      }
    })
    belongCondition.value.refundMoney = Number(money.toFixed(2))
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
      let yiIncomes = res.data.belongUserCosts.find((item: any) => item.type === 2 && item.belongUserName === '宜')?.money ?? 0
      // 需要减去香港天数，一天 200 元
      yiIncomes -= belongCondition.value.days * 200
      // 减去宜缴纳社保金额
      yiIncomes -= res.data.costTypeRank['宜'].find((item: any) => item.type === '1020')?.money ?? 0
      // 获取栋收入
      let dongIncomes = res.data.belongUserCosts.find((item: any) => item.type === 2 && item.belongUserName === '栋')?.money ?? 0
      // 减去栋缴纳社保金额
      dongIncomes -= res.data.costTypeRank['栋'].find((item: any) => item.type === '1020')?.money ?? 0
      const proportion = `${yiIncomes.toFixed(2)}:${dongIncomes.toFixed(2)}`
      console.log(proportion, 'proportion')
      
      calculateMoney(proportion)
      setTypeData(res.data.costTypeRank, proportion)
      setPieData()
    } else {
      ElMessage.error('查询概览失败，' + res.message)
    }
  }

  const initData = (bill: Bill) => {
    belongCondition.value.startDate = dayjs().startOf('year').format('YYYY-MM-DD')
    belongCondition.value.endDate = dayjs().format('YYYY-MM-DD')
    users.value = bill.users
    getBalanceAndPieData()
  }

  const initChart = () => {
    belongTypeChart1.value = echarts.init(document.getElementById('belongTypeChart1') as HTMLElement)
    belongTypeChart2.value = echarts.init(document.getElementById('belongTypeChart2') as HTMLElement)
    belongTypeChart3.value = echarts.init(document.getElementById('belongTypeChart3') as HTMLElement)
    belongOptions.value.color = colorOptions

    belongTypeChart1.value.on('click', (params: any) => handleChartClick(params, '全部'))
    belongTypeChart2.value.on('click', (params: any) => handleChartClick(params, '宜'))
    belongTypeChart3.value.on('click', (params: any) => handleChartClick(params, '栋'))
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

  return { belongCondition, belongUsers, getBalanceAndPieData, dialogVisible, detailList, loading, currentCategory, currentCategoryTotal }
}
