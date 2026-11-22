<template>
  <div ref="el" class="month-bar" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { moneyText, shortText } from '@/utils/asset-format'

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

const props = defineProps<{
  values: (number | null)[]
  color: string
  /** 高亮的月份，从 1 开始 */
  highlight: number
  hidden?: boolean
}>()

const el = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null

function render() {
  if (!el.value) return
  if (!chart) chart = echarts.init(el.value)
  const hasNegative = props.values.some((value) => value != null && value < 0)
  chart.setOption(
    {
      grid: { left: 4, right: 8, top: 10, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis',
        confine: true,
        formatter: (params: unknown) => {
          const row = (Array.isArray(params) ? params[0] : params) as { name?: string; value?: number | null }
          const value = row?.value
          const text = value == null ? '没有盘点' : moneyText(Number(value), props.hidden)
          return `${row?.name}月<br/>${text}`
        },
      },
      xAxis: {
        type: 'category',
        data: props.values.map((_, index) => String(index + 1)),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#e6e6e6' } },
        axisLabel: {
          color: '#999',
          fontSize: 10,
          interval: 0,
          formatter: (label: string) => (Number(label) === props.highlight ? `{now|${label}}` : label),
          rich: { now: { color: '#4285f4', fontWeight: 600, fontSize: 10 } },
        },
      },
      yAxis: {
        type: 'value',
        min: hasNegative ? undefined : 0,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#f2f3f5' } },
        axisLabel: {
          color: '#999',
          fontSize: 10,
          formatter: (value: number) => shortText(value, props.hidden),
        },
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 16,
          data: props.values.map((value, index) => ({
            value,
            itemStyle: {
              color: props.color,
              borderRadius: value != null && value < 0 ? [0, 0, 3, 3] : [3, 3, 0, 0],
              borderColor: index + 1 === props.highlight && value != null ? '#1d4f91' : 'transparent',
              borderWidth: index + 1 === props.highlight && value != null ? 1.5 : 0,
            },
          })),
        },
      ],
    },
    true,
  )
}

function onResize() {
  chart?.resize()
}

onMounted(() => {
  render()
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  chart?.dispose()
  chart = null
})

watch(() => [props.values, props.color, props.highlight, props.hidden], render, { deep: true })
</script>

<style scoped>
.month-bar {
  width: 100%;
  height: 168px;
  margin-top: 8px;
}
</style>
