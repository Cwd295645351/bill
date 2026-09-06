import { ref, watch, computed, nextTick } from 'vue'
import { useBillStore } from '@/store'
import { storeToRefs } from 'pinia'
import dayjs from 'dayjs'
import { formatDate, dayStartTs, dayEndTs } from '@/utils/dateUtil'
import * as echarts from 'echarts'

import { getBalance } from '../api'
import { getRecordList } from '../../record/api'

import { Bill, User } from '@/types/bill'
import type { OverviewRule } from '@/types/bill'
import type { BelongCondition, BelongUser } from '../type'

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
  const quantityRules = computed(() =>
    (bill.value?.overviewRules || []).filter((rule) => rule.enabled && rule.ruleType === 'quantity'),
  )
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
  /** 图表实例数组: [0]="全部", [1]=user0, [2]=user1 */
  const belongTypeCharts = ref<any[]>([])
  /** 图表数量：用户 ≥ 2 时显示全部 + 各用户；仅1个用户时只显示全部 */
  const chartCount = computed(() => (users.value.length >= 2 ? users.value.length + 1 : 1))

  const dialogVisible = ref(false)
  const detailList = ref<any[]>([])
  const loading = ref(false)
  const currentCategory = ref('')
  const currentCategoryTotal = ref(0)
  /** 比例映射: { [userName]: ratio } */
  const currentProportion = ref<Record<string, number>>({})

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
      beginDate: belongCondition.value.startDate ? dayStartTs(belongCondition.value.startDate) : '',
      endDate: belongCondition.value.endDate ? dayEndTs(belongCondition.value.endDate) : '',
      billId: (bill.value as Bill).id,
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

    const [err, res] = await getRecordList({ data: searchParams })
    loading.value = false
    if (err) return
    if (res.retCode === 0) {
      const datas = res.data.datas as any[]
      detailList.value = datas
        .filter((item: any) => {
          // 如果是专属饼图，额外确保只包含该归属人或"全部"归属的数据
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
          item.date = formatDate(item.date)
          item.totalMoney = item.money // 保存原始总金额

          // 如果是专属饼图，且这条记录的归属人是"全部"，则按比例计算
          if (belongUserName !== '全部' && (item.belongUserId === '' || !item.belongUserId)) {
            const ratio = currentProportion.value[belongUserName] ?? 0.5
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

    const userNames = users.value.map((u) => u.name)
    const userName0 = userNames[0] || ''
    const userName1 = userNames[1] || ''

    const proportion0 = total ? Number(proportionArray[0]) / total : 0.5
    const proportion1 = total ? Number(proportionArray[1]) / total : 0.5

    currentProportion.value = { [userName0]: proportion0, [userName1]: proportion1 }
    console.log('用户比例:', currentProportion.value)

    const data: Record<string, any[]> = { 全部: [] }
    userNames.forEach((name) => {
      data[name] = []
    })

    const allRank = costTypeRank['全部'] || []

    // 全部类型数据处理：汇总到"全部"
    const totalTypeDataHandle = (item: any) => {
      const allTypeDataIndex = data['全部'].findIndex((ite: any) => ite.type === item.type)
      if (allTypeDataIndex !== -1) {
        const obj = data['全部'][allTypeDataIndex]
        data['全部'][allTypeDataIndex] = { ...obj, money: obj.money + item.money }
      } else data['全部'].push(item)
    }

    // "全部"归属数据的成本按比例分配到各用户
    allRank.forEach((item: any) => {
      data['全部'].push(item)
      // 仅当存在两个用户时才按比例分摊
      if (userName1) {
        data[userName0].push({ ...item, money: item.money * proportion0 })
        data[userName1].push({ ...item, money: item.money * proportion1 })
      } else {
        // 只有1个用户时，"全部"数据直接归给该用户
        data[userName0].push({ ...item, money: item.money })
      }
    })

    // 各用户的专属数据合并
    userNames.forEach((userName) => {
      const rank = costTypeRank[userName] || []
      rank.forEach((item: any) => {
        const index = data[userName].findIndex((ite: any) => ite.type === item.type)
        if (index !== -1) {
          const obj = data[userName][index]
          data[userName][index] = { ...obj, money: obj.money + item.money }
        } else {
          data[userName].push(item)
        }
        totalTypeDataHandle(item)
      })
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
    Object.keys(data).forEach((key) => {
      data[key] = sortData(data[key])
    })

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

    // 只有1个用户时，只渲染"全部"饼图（index 0）
    if (users.value.length < 2) {
      if (belongTypeDatas.value['全部'] && belongTypeCharts.value[0]) {
        setSeriesData(belongOptions.value.series[0], belongTypeDatas.value['全部'], belongTypeCharts.value[0], '全部')
      }
      return
    }

    const labels = ['全部', ...users.value.map((u) => u.name)]
    labels.forEach((label, i) => {
      if (belongTypeDatas.value[label] && belongTypeCharts.value[i]) {
        setSeriesData(belongOptions.value.series[0], belongTypeDatas.value[label], belongTypeCharts.value[i], label)
      }
    })
  }

  /** 合计退款 */
  const calculateMoney = (proportion: string) => {
    const costs = belongUsers.value.details
    const proportionArray = proportion.split(':')
    const proportion0 = Number(proportionArray[0])
    const proportion1 = Number(proportionArray[1])
    const total = proportion0 + proportion1

    const userNames = users.value.map((u) => u.name)
    const userName0 = userNames[0] || ''
    const userName1 = userNames[1] || ''

    if (!total) {
      belongCondition.value.refundMoney = 0
      return
    }

    let money = 0
    costs.forEach((item) => {
      if (item.userName === userName0) {
        if (item.belongUserId === '') {
          money += item.money * (proportion1 / total)
        } else if (item.belongUserName === userName1) {
          money += item.money
        }
      } else if (item.userName === userName1) {
        if (item.belongUserId === '') {
          money -= item.money * (proportion0 / total)
        } else if (item.belongUserName === userName0) {
          money -= item.money
        }
      }
    })
    belongCondition.value.refundMoney = Number(money.toFixed(2))
  }

  /** 应退文案：正数=user1 退给 user0；负数=user0 退给 user1 */
  const refundText = computed(() => {
    const userName0 = users.value[0]?.name || ''
    const userName1 = users.value[1]?.name || ''
    const money = belongCondition.value.refundMoney
    if (!userName0 || !userName1) return `应退金额：${money}`
    if (money === 0) return '应退金额：双方结清，无需转账'
    if (money > 0) return `应退金额：${userName1} → ${userName0} 转 ${money} 元`
    return `应退金额：${userName0} → ${userName1} 转 ${Math.abs(money)} 元`
  })

  const getBalanceAndPieData = async () => {
    const params = {
      billId: billId.value,
      beginDate: dayStartTs(belongCondition.value.startDate),
      endDate: dayEndTs(belongCondition.value.endDate),
    }
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

      const userNames = users.value.map((u) => u.name)
      const userName0 = userNames[0] || ''
      const userName1 = userNames[1] || ''
      const enabledRules = (bill.value?.overviewRules || []).filter((rule) => rule.enabled)

      // 按启用规则计算有效收入：数量规则仅扣归属人，支出类型规则扣对应类型金额
      const calcIncomes = (userName: string, userId: string) => {
        let incomes = res.data.belongUserCosts.find((item: any) => item.type === 2 && item.belongUserName === userName)?.money ?? 0
        enabledRules.forEach((rule: OverviewRule) => {
          if (rule.ruleType === 'quantity') {
            const input = belongCondition.value.quantityInputs[rule.id]
            if (userId && input && userId === input.belongUserId) {
              incomes -= Number(input.quantity || 0) * Number(rule.unitPrice || 0)
            }
          } else if (rule.ruleType === 'cost_type' && rule.costTypeId) {
            incomes -= res.data.costTypeRank[userName]?.find((item: any) => item.type === rule.costTypeId)?.money ?? 0
          }
        })
        return incomes
      }

      const user0Incomes = calcIncomes(userName0, users.value[0]?.id ?? '')
      const user1Incomes = calcIncomes(userName1, users.value[1]?.id ?? '')
      const incomeTotal = user0Incomes + user1Incomes
      // 有效收入总和为 0 时回退均分，避免比例出现 NaN
      const proportion = !Number.isFinite(incomeTotal) || incomeTotal === 0 ? '1:1' : `${user0Incomes.toFixed(2)}:${user1Incomes.toFixed(2)}`
      console.log(proportion, 'proportion')

      calculateMoney(proportion)
      setTypeData(res.data.costTypeRank, proportion)
      setPieData()
    } else {
      ElMessage.error('查询概览失败，' + res.message)
    }
  }

  /** 销毁已有图表实例，避免重复 init 泄漏 */
  const disposeCharts = () => {
    belongTypeCharts.value.forEach((chart) => {
      chart?.dispose()
    })
    belongTypeCharts.value = []
  }

  /** 按当前用户列表初始化饼图 DOM（需在 chartCount 对应节点渲染后调用） */
  const initChart = () => {
    disposeCharts()
    belongOptions.value.color = colorOptions
    const userNames = users.value.map((u) => u.name)

    const allEl = document.getElementById('belongTypeChart0')
    if (!allEl) return

    // "全部" 图表 (index 0)
    belongTypeCharts.value[0] = echarts.init(allEl)
    belongTypeCharts.value[0].on('click', (params: any) => handleChartClick(params, '全部'))

    // 用户图表（仅当用户 ≥ 2 时才渲染各用户饼图）
    if (userNames.length >= 2) {
      userNames.forEach((name, i) => {
        const el = document.getElementById(`belongTypeChart${i + 1}`)
        if (!el) return
        belongTypeCharts.value[i + 1] = echarts.init(el)
        belongTypeCharts.value[i + 1].on('click', (params: any) => handleChartClick(params, name))
      })
    }
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
    // 等 chartCount 更新后的 DOM 节点就绪，再初始化图表（修复刷新后 users 晚于 onMounted 导致只剩「全部」）
    await nextTick()
    initChart()
    getBalanceAndPieData()
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
    getBalanceAndPieData,
    dialogVisible,
    detailList,
    loading,
    currentCategory,
    currentCategoryTotal,
    chartCount,
    refundText,
  }
}
