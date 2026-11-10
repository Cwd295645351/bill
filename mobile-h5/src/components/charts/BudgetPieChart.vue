<template>
  <div v-if="!alive.length" class="a-note">暂无</div>
  <div v-else class="a-pie">
    <div ref="el" class="a-disk" />
    <div class="a-legend">
      <div v-for="item in legendItems" :key="item.name" class="row">
        <i :style="{ background: item.color }" />
        <span class="name">{{ item.name }}</span>
        <b>{{ item.pct }}</b>
        <em>{{ item.amountText }}</em>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([PieChart, TooltipComponent, CanvasRenderer])

const COLORS = ['#4285f4', '#34a853', '#fbbc05', '#ea4335', '#8bc34a', '#ab47bc', '#26a69a', '#ff7043']

const props = defineProps<{
  slices: { name: string; value: number }[]
}>()

const el = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null

/** 图例金额统一以「万」为单位 */
function amountInWan(n: number) {
  const wan = Math.round((Math.abs(Number(n) || 0) / 100)) / 100
  return (Math.abs(wan - Math.round(wan)) < 0.001 ? String(Math.round(wan)) : wan.toFixed(2)) + '万'
}

function pctText(part: number, total: number) {
  return (!total ? '0.0' : ((part / total) * 100).toFixed(1)) + '%'
}

const alive = computed(() =>
  props.slices
    .filter((s) => Number(s.value) > 0)
    .map((s, index) => ({
      name: s.name,
      value: Number(s.value) || 0,
      color: COLORS[index % COLORS.length],
    })),
)

const total = computed(() => alive.value.reduce((sum, item) => sum + item.value, 0))

const legendItems = computed(() =>
  alive.value.map((item) => ({
    ...item,
    pct: pctText(item.value, total.value),
    amountText: amountInWan(item.value),
  })),
)

function render() {
  if (!el.value || !alive.value.length) return
  if (!chart) chart = echarts.init(el.value)
  chart.setOption(
    {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const value = Number(params.value) || 0
          return `${params.name}<br/>${pctText(value, total.value)}　${amountInWan(value)}`
        },
      },
      series: [
        {
          type: 'pie',
          radius: ['0%', '92%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          label: { show: false },
          labelLine: { show: false },
          data: alive.value.map((item) => ({
            name: item.name,
            value: item.value,
            itemStyle: { color: item.color },
          })),
        },
      ],
    },
    true,
  )
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

function onResize() {
  chart?.resize()
}

watch(
  () => props.slices,
  () => {
    if (!alive.value.length) {
      chart?.clear()
      return
    }
    render()
  },
  { deep: true },
)
</script>

<style scoped>
.a-note {
  color: #999;
  font-size: 12px;
  line-height: 1.5;
}
.a-pie {
  display: flex;
  align-items: center;
  gap: 12px;
}
.a-disk {
  width: 108px;
  height: 108px;
  flex: none;
}
.a-legend {
  flex: 1;
  min-width: 0;
}
.row {
  display: flex;
  align-items: center;
  width: 100%;
  margin: 3px 0;
  color: #666;
  font-size: 12px;
  text-align: left;
}
.row i {
  width: 8px;
  height: 8px;
  margin-right: 6px;
  border-radius: 2px;
  flex: none;
}
.row .name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row b {
  margin-left: 8px;
  color: #333;
  font-weight: 600;
  flex: none;
}
.row em {
  margin-left: 8px;
  color: #333;
  font-style: normal;
  font-weight: 600;
  flex: none;
}
</style>
