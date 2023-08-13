import { onMounted, ref, watch } from 'vue'
import { useBillStore } from '@/store'
import { storeToRefs } from 'pinia'
import { getThreeYearCost } from '../api'
import * as echarts from 'echarts'

export const useOverview = (options: { colorOptions: string[] }) => {
  const { colorOptions } = options

  const store = useBillStore()
  const { bill, billId } = storeToRefs(store)

  const perYearCostDatas = ref<any>({ type: [], datas: [] })

  /** 年度支出趋势折线图配置 */
  const perYearOptions = ref<any>({
    title: { text: '近三年支出趋势' },
    tooltip: { trigger: 'axis' },
    legend: { data: [] },
    color: [],
    grid: {
      left: '1%',
      right: '1%',
      bottom: '0%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: true,
      axisLabel: { fontSize: 16, interval: 0 },
      data: [],
    },
    yAxis: { type: 'value', axisLabel: { fontSize: 16 } },
    series: [],
  })
  /** 年度支出趋势折线图chart */
  const perYearChart = ref<any>(null)

  watch(bill, (val) => {
    getThreeYearCostData()
  })

  /** 查询过去三年支出概况 */
  const getThreeYearCostData = async () => {
    const params = { billId: billId.value }
    const [err, res] = await getThreeYearCost({ params })
    if (err) return
    if (res.retCode === 0) {
      const data = res.data
      perYearCostDatas.value = data
      data.datas.forEach((item: any) => {
        item.total = item.datas.reduce((prev: string, curr: string) => Number(prev) + Number(curr))
      })
      setYearLineChartData()
    } else {
      ElMessage.error('查询过去三年支出概况失败，' + res.message)
    }
  }

  /** 设置折线图 */
  const setYearLineChartData = () => {
    const options = perYearOptions.value
    options.xAxis.data = perYearCostDatas.value.type
    options.legend.data = []
    options.series = []
    perYearCostDatas.value.datas.forEach((item: any) => {
      options.legend.data.push(item.name)
      options.series.push({ name: item.name, type: 'bar', data: item.datas })
    })
    perYearChart.value.setOption(options, true)
  }

  onMounted(() => {
    perYearChart.value = echarts.init(document.getElementById('perYearChart') as HTMLElement)
    perYearOptions.value.color = colorOptions

    if (bill.value) getThreeYearCostData()
  })

  return { perYearCostDatas }
}
