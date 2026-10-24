import { onBeforeUnmount, ref } from 'vue'
import * as echarts from 'echarts'
import { formatMoney, shortAmount } from '../shared'

export interface PieSlice {
  name: string
  amount: number
  color: string
}

/**
 * 总览两张饼图。四笔钱点进四笔钱页，资产类型点中某一类时回调名称。
 */
export const useOverviewPies = () => {
  const fourHost = ref<HTMLDivElement | null>(null)
  const typeHost = ref<HTMLDivElement | null>(null)
  let fourChart: echarts.ECharts | null = null
  let typeChart: echarts.ECharts | null = null

  const release = (chart: echarts.ECharts | null) => {
    if (chart && !chart.isDisposed()) chart.dispose()
    return null
  }

  const option = (slices: PieSlice[]) => ({
    tooltip: {
      trigger: 'item',
      formatter: (item: { name: string; value: number; percent: number }) => `${item.name}<br/>${formatMoney(item.value)}（${Number(item.percent).toFixed(2)}%）`,
    },
    series: [
      {
        type: 'pie',
        // 直径留出外侧空间，两行标签才不会压在扇区上
        radius: '50%',
        center: ['50%', '52%'],
        data: slices
          .filter((item) => item.amount > 0)
          .map((item) => ({
            name: item.name,
            value: item.amount,
            itemStyle: { color: item.color },
          })),
        label: {
          formatter: (item: { name: string; value: number; percent: number }) => `${item.name}\n${shortAmount(item.value)}\n(${Number(item.percent).toFixed(2)}%)`,
          color: 'inherit',
          fontSize: 13,
          lineHeight: 18,
        },
        labelLine: { length: 20, length2: 20 },
        labelLayout: { hideOverlap: false },
      },
    ],
  })

  const paint = (four: PieSlice[], types: PieSlice[], onFour: () => void, onType: (name: string) => void) => {
    fourChart = release(fourChart)
    typeChart = release(typeChart)
    if (fourHost.value && four.some((item) => item.amount > 0)) {
      fourChart = echarts.init(fourHost.value)
      fourChart.setOption(option(four))
      fourChart.on('click', () => onFour())
    }
    if (typeHost.value && types.some((item) => item.amount > 0)) {
      typeChart = echarts.init(typeHost.value)
      typeChart.setOption(option(types))
      typeChart.on('click', (params) => {
        if (params.name) onType(String(params.name))
      })
    }
  }

  const resize = () => {
    fourChart?.resize()
    typeChart?.resize()
  }

  window.addEventListener('resize', resize)
  onBeforeUnmount(() => {
    window.removeEventListener('resize', resize)
    fourChart = release(fourChart)
    typeChart = release(typeChart)
  })

  return { fourHost, typeHost, paint, resize }
}
