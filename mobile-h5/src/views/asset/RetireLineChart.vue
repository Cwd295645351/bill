<template>
  <div ref="el" class="a-line" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { moneyText, shortText } from '@/utils/asset-format'

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const props = defineProps<{
  series: { month: string; value: number | null }[]
  amount: number
  targetMonth?: string | null
  hidden?: boolean
}>()

const el = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null

function monthIndex(text?: string | null) {
  if (!text || !/^\d{4}-\d{2}$/.test(text)) return null
  const [year, month] = text.split('-').map(Number)
  return year * 12 + month - 1
}

function render() {
  if (!el.value || !props.series.length) return
  if (!chart) chart = echarts.init(el.value)
  const values = props.series.map((item) => item.value).filter((item): item is number => item != null)
  const base = values[0] ?? 0
  const start = monthIndex(props.series[0]?.month)
  const target = monthIndex(props.targetMonth)
  const total = target != null && start != null ? Math.max(target - start, 1) : 1
  const goal = props.series.map((_, index) => {
    if (!props.targetMonth) return props.amount
    return Math.round((base + ((props.amount - base) * index) / total) * 100) / 100
  })
  chart.setOption(
    {
      legend: { top: 0, itemWidth: 12, itemHeight: 8, textStyle: { fontSize: 11, color: '#666' }, data: ['账户资产', '目标进度'] },
      grid: { left: 4, right: 12, top: 28, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis',
        confine: true,
        valueFormatter: (value: unknown) => (value == null ? '—' : moneyText(Number(value), props.hidden)),
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: props.series.map((item) => item.month),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#e6e6e6' } },
        axisLabel: {
          color: '#999',
          fontSize: 10,
          hideOverlap: true,
          formatter: (label: string) => {
            const matched = /^(\d{4})-(\d{2})$/.exec(label)
            if (!matched) return label
            return matched[2] === '01' ? `${matched[1].slice(2)}/${Number(matched[2])}` : String(Number(matched[2]))
          },
        },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#f2f3f5' } },
        axisLabel: { color: '#999', fontSize: 10, formatter: (value: number) => shortText(value, props.hidden) },
      },
      series: [
        {
          name: '账户资产',
          type: 'line',
          showSymbol: false,
          connectNulls: false,
          color: '#4285f4',
          lineStyle: { width: 2 },
          data: props.series.map((item) => item.value),
        },
        {
          name: '目标进度',
          type: 'line',
          showSymbol: false,
          color: '#e6a23c',
          lineStyle: { type: 'dashed', width: 2 },
          data: goal,
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

watch(() => [props.series, props.amount, props.targetMonth, props.hidden], render, { deep: true })
</script>
