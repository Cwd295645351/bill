import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useBillStore } from '@/store'
import { storeToRefs } from 'pinia'
import { getThreeYearCost } from '../api'
import * as echarts from 'echarts'

export const useOverview = (options: { colorOptions: string[] }) => {
  const { colorOptions } = options

  const store = useBillStore()
  const { bill, billId } = storeToRefs(store)

  const perYearCostDatas = ref<any>({ type: [], members: [], datas: [] })

  /** 年度收支趋势柱状图配置（图表仅显示各类支出，不显示收入） */
  const perYearOptions = {
    title: { text: '近五年收支趋势' },
    tooltip: { trigger: 'item' },
    legend: { data: [] as string[] },
    color: [] as string[],
    grid: {
      top: 40,
      left: '1%',
      right: '1%',
      bottom: '0%',
      containLabel: true,
    },
    xAxis: {
      type: 'category' as const,
      boundaryGap: true,
      axisLabel: { fontSize: 16, interval: 0 },
      data: [] as string[],
    },
    yAxis: { type: 'value' as const, axisLabel: { fontSize: 16 } },
    series: [] as any[],
  }

  /** 年度收支趋势图实例（使用 shallowRef 避免被 Vue 深度响应式 Proxy 代理破坏 ECharts 内部状态） */
  const perYearChart = shallowRef<echarts.ECharts | null>(null)

  /** 设置柱状图数据 */
  const setYearLineChartData = () => {
    if (!perYearChart.value) return
    const options = {
      ...perYearOptions,
      color: colorOptions,
      xAxis: {
        ...perYearOptions.xAxis,
        data: perYearCostDatas.value.type || [],
      },
      legend: {
        data: (perYearCostDatas.value.datas || []).map((item: any) => item.name),
      },
      series: (perYearCostDatas.value.datas || []).map((item: any) => ({
        name: item.name,
        type: 'bar',
        data: item.datas,
      })),
    }
    perYearChart.value.setOption(options, true)
  }

  /** 查询近五年收支概况 */
  const getThreeYearCostData = async () => {
    const params = { billId: billId.value }
    const [err, res] = await getThreeYearCost({ params })
    if (err) return
    if (res.retCode === 0) {
      const data = res.data
      perYearCostDatas.value = data
      // 基金的类型下标
      const fundIndex = data.type.findIndex((item: any) => item === '基金')
      data.datas.forEach((item: any) => {
        item.total = item.datas.reduce((prev: string, curr: string) => Number(prev) + Number(curr), 0)
        // 总消费需要剔除基金（如无基金类型或没有数据，则消费 = 总支出）
        const fundMoney = fundIndex !== -1 && item.datas[fundIndex] !== undefined ? Number(item.datas[fundIndex]) : 0
        item.consumption = item.total - fundMoney
      })
      setYearLineChartData()
    } else {
      ElMessage.error('查询近五年收支概况失败，' + res.message)
    }
  }

  watch(
    bill,
    (val) => {
      if (!val) return
      getThreeYearCostData()
    },
    { immediate: true },
  )

  const handleResize = () => {
    perYearChart.value?.resize()
  }

  onMounted(() => {
    const el = document.getElementById('perYearChart')
    if (el) {
      perYearChart.value = echarts.init(el)
    }
    window.addEventListener('resize', handleResize)
    if (perYearCostDatas.value.datas?.length) {
      setYearLineChartData()
    }
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize)
    perYearChart.value?.dispose()
    perYearChart.value = null
  })

  return { perYearCostDatas }
}
