<template>
  <div ref="el" class="trend-line" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkLineComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { moneyText, shortText } from '@/utils/asset-format'

echarts.use([LineChart, GridComponent, TooltipComponent, MarkLineComponent, CanvasRenderer])

const props = defineProps<{
  labels: string[]
  series: { key: string; name: string; values: (number | null)[] }[]
  colors: Record<string, string>
  hidden?: boolean
  pick: number
}>()

const emit = defineEmits<{ pick: [index: number] }>()

const el = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null
let bound = false

function axisText(value: number) {
  const text = shortText(Math.abs(value), props.hidden)
  return value < -0.004 ? `-${text}` : text
}

function shortAxis(label: string) {
  const matched = /^(\d{4})-(\d{2})/.exec(label)
  if (!matched) return label
  return matched[2] === '01' ? `${matched[1].slice(2)}/${Number(matched[2])}` : String(Number(matched[2]))
}

function render() {
  if (!el.value || !props.labels.length) return
  if (!chart) chart = echarts.init(el.value)
  bindPick()
  const picked = props.labels[props.pick]
  const hasNegative = props.series.some((item) => item.values.some((value) => value != null && value < 0))
  chart.setOption(
    {
      grid: { left: 4, right: 12, top: 16, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis',
        confine: true,
        formatter: (params: unknown) => {
          const rows = (Array.isArray(params) ? params : [params]) as { seriesName?: string; value?: number | null; axisValue?: string }[]
          const title = rows[0]?.axisValue || ''
          const body = rows
            .map((row) => `${row.seriesName}　${row.value == null ? '—' : moneyText(Number(row.value), props.hidden)}`)
            .join('<br/>')
          return `${title}<br/>${body}`
        },
      },
      xAxis: {
        type: 'category',
        data: props.labels,
        boundaryGap: false,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#e6e6e6' } },
        axisLabel: {
          color: '#999',
          fontSize: 10,
          hideOverlap: true,
          formatter: (label: string) => (label === picked ? `{now|${shortAxis(label)}}` : shortAxis(label)),
          rich: { now: { color: '#4285f4', fontWeight: 600, fontSize: 10 } },
        },
      },
      yAxis: {
        type: 'value',
        min: hasNegative ? undefined : 0,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#f2f3f5' } },
        axisLabel: { color: '#999', fontSize: 10, formatter: (value: number) => axisText(value) },
      },
      series: props.series.map((item, index) => ({
        name: item.name,
        type: 'line',
        stack: 'asset',
        stackStrategy: 'samesign',
        areaStyle: { opacity: 0.72 },
        connectNulls: false,
        showSymbol: false,
        symbol: 'none',
        color: props.colors[item.key] || '#4285f4',
        lineStyle: { width: 1.5 },
        data: item.values,
        markLine: index === 0 && picked
          ? {
              silent: true,
              symbol: 'none',
              animation: false,
              label: { show: false },
              lineStyle: { color: '#c5d4ea', type: 'dashed' },
              data: [{ xAxis: picked }],
            }
          : undefined,
      })),
    },
    true,
  )
}

function bindPick() {
  if (!chart || bound) return
  bound = true
  chart.getZr().on('click', (event: { offsetX: number; offsetY: number }) => {
    if (!chart || !chart.containPixel({ gridIndex: 0 }, [event.offsetX, event.offsetY])) return
    const coord = chart.convertFromPixel({ xAxisIndex: 0 }, [event.offsetX, event.offsetY])
    const raw = Array.isArray(coord) ? coord[0] : coord
    const index = Math.round(Number(raw))
    if (index >= 0 && index < props.labels.length) emit('pick', index)
  })
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

watch(() => [props.labels, props.series, props.colors, props.hidden, props.pick], render, { deep: true })
</script>

<style scoped>
.trend-line {
  width: 100%;
  height: 220px;
  margin-top: 8px;
}
</style>
