<template>
  <div class="asset-screen sub">
    <van-nav-bar title="资产趋势" left-arrow fixed placeholder @click-left="router.back()" />
    <div class="a-members">
      <button type="button" :class="{ on: !view.memberId }" @click="view.memberId = ''">全部</button>
      <button v-for="item in members" :key="item.id" type="button" :class="{ on: view.memberId === item.id }" @click="view.memberId = item.id">{{ item.name }}</button>
    </div>
    <section class="a-card">
      <div class="a-seg">
        <button type="button" :class="{ on: grain === 'month' }" @click="grain = 'month'">月份</button>
        <button type="button" :class="{ on: grain === 'year' }" @click="grain = 'year'">年份</button>
      </div>
      <div style="height:8px"></div>
      <div class="a-range">
        <button v-for="item in ranges" :key="item.value" type="button" :class="{ on: range === item.value }" @click="range = item.value">{{ item.label }}</button>
      </div>
      <div v-if="range === 'custom'" class="a-custom">
        <label>开始 <input v-model="start" type="month" /></label>
        <label>结束 <input v-model="end" type="month" /></label>
      </div>
      <div class="a-seg" style="margin-top:8px">
        <button type="button" :class="{ on: metric === 'all' }" @click="metric = 'all'">全部</button>
        <button type="button" :class="{ on: metric === 'net' }" @click="metric = 'net'">净资产</button>
      </div>
      <div v-if="note && !labels.length" class="empty"><div class="illus"></div>{{ note }}</div>
      <template v-else>
        <div class="a-note">{{ grain === 'year' ? '按年时，每一年取区间内最后一次有数的月份。' : '按月时，没有盘点的月份留空，不画成 0。' }}{{ note }}含固定资产。点某一{{ grain === 'year' ? '年' : '月' }}看金额。</div>
        <TrendLineChart :labels="labels" :series="lines" :colors="colors" :hidden="view.hideAmount" :pick="pick" @pick="pick = $event" />
        <div class="a-stats">
          <div v-for="item in pickedStats" :key="item.k" class="a-stat"><div class="k">{{ item.k }}</div><div class="n" :class="item.cls">{{ item.n }}</div></div>
        </div>
        <div class="a-legend" style="margin-top:8px">
          <template v-for="item in legend" :key="item.key">
            <div><i :style="{ background: item.color }"></i><span>{{ item.name }}</span><b>{{ item.lastText }}</b></div>
            <div class="a-note" style="margin:0 0 6px 14px">区间变化 <span :class="item.cls">{{ item.deltaText }}</span></div>
          </template>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TrendLineChart from './TrendLineChart.vue'
import { assetApi, type TrendResult } from '@/api/asset'
import { useAssetViewStore } from '@/stores/asset-view'
import { changeClass, changeShort, moneyText, monthText, signedText } from '@/utils/asset-format'
import './asset.css'

const ranges = [
  { value: 'since', label: '记账以来' },
  { value: 'thisYear', label: '今年' },
  { value: 'y1', label: '近1年' },
  { value: 'y3', label: '近3年' },
  { value: 'y5', label: '近5年' },
  { value: 'custom', label: '自定义' }
]
const colors: Record<string, string> = { liquid: '#5b8ff9', invest: '#5ad8a6', fixed: '#f6bd16', receivable: '#6dc8ec', liability: '#f08bb4', net: '#4285f4' }
const route = useRoute()
const router = useRouter()
const view = useAssetViewStore()
const billId = computed(() => String(route.params.id || ''))
const range = ref('since')
const grain = ref<'month' | 'year'>('month')
const metric = ref<'all' | 'net'>('all')
const start = ref(monthText())
const end = ref(monthText())
const result = ref<TrendResult | null>(null)
const note = ref('')
const members = ref<{ id: string; name: string }[]>([])
const pick = ref(0)

const labels = computed(() => result.value?.labels || [])
const lines = computed(() => result.value?.series || [])
const legend = computed(() => (result.value?.legend || []).map((item) => ({
  ...item,
  name: result.value?.series.find((series) => series.key === item.key)?.name || item.key,
  color: colors[item.key] || '#18a356',
  lastText: item.last == null ? '—' : moneyText(item.last, view.hideAmount),
  deltaText: changeShort(item.delta, view.hideAmount),
  cls: changeClass(item.delta)
})))
function pointName(label: string) {
  const month = /^(\d{4})-(\d{2})$/.exec(label)
  if (month) return `${month[1]}年${Number(month[2])}月`
  return label || '区间起点'
}
const pickedStats = computed(() => {
  const points = result.value?.labels || []
  const series = result.value?.series || []
  const index = Math.min(pick.value, Math.max(points.length - 1, 0))
  const label = points[index] || ''
  const valueOf = (key: string, at: number) => series.find((item) => item.key === key)?.values[at]
  const netAt = (at: number) => {
    if (metric.value === 'net') return valueOf('net', at) ?? null
    const keys = ['liquid', 'invest', 'fixed', 'receivable', 'liability']
    const nums = keys.map((key) => valueOf(key, at)).filter((value): value is number => value != null)
    if (!nums.length) return null
    return Math.round(nums.reduce((sum, value) => sum + value, 0) * 100) / 100
  }
  const baseIndex = Math.max(points.findIndex((_, at) => netAt(at) != null), 0)
  const net = netAt(index)
  const baseNet = netAt(baseIndex)
  const delta = net == null || baseNet == null ? null : Math.round((net - baseNet) * 100) / 100
  const compared = `较${pointName(points[baseIndex] || '')}`
  if (metric.value === 'net') {
    return [
      { k: `${label}净资产`, n: net == null ? '—' : signedText(net, view.hideAmount), cls: '' },
      { k: compared, n: changeShort(delta, view.hideAmount), cls: changeClass(delta) }
    ]
  }
  const assetNums = ['liquid', 'invest', 'fixed', 'receivable'].map((key) => valueOf(key, index)).filter((value): value is number => value != null)
  const asset = assetNums.length ? Math.round(assetNums.reduce((sum, value) => sum + value, 0) * 100) / 100 : null
  const debt = valueOf('liability', index)
  return [
    { k: `${label}总资产`, n: asset == null ? '—' : moneyText(asset, view.hideAmount), cls: '' },
    { k: '总负债', n: debt == null ? '—' : moneyText(Math.abs(debt), view.hideAmount), cls: '' },
    { k: '净资产', n: net == null ? '—' : signedText(net, view.hideAmount), cls: '' },
    { k: `净资产${compared}`, n: changeShort(delta, view.hideAmount), cls: changeClass(delta) }
  ]
})

function bounds(): { error: string; startMonth: string; endMonth: string; note: string } {
  const now = new Date()
  const endMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  if (range.value === 'custom') {
    if (start.value > end.value) return { error: '开始月不能晚于结束月', startMonth: start.value, endMonth: end.value, note: '' }
    const capped = end.value > endMonth
    return { error: '', startMonth: start.value, endMonth: capped ? endMonth : end.value, note: capped ? '结束月晚于本月，只画到本月。' : '' }
  }
  const shift = range.value === 'y1' ? 11 : range.value === 'y3' ? 35 : range.value === 'y5' ? 59 : 0
  const from = new Date(now.getFullYear(), now.getMonth() - shift, 1)
  const startMonth = range.value === 'thisYear' ? `${now.getFullYear()}-01` : range.value === 'since' ? '1970-01' : monthText(from)
  return { error: '', startMonth, endMonth, note: '' }
}

async function load() {
  note.value = ''
  view.bindBill(billId.value)
  const memberRes = await assetApi.members(billId.value)
  members.value = memberRes.data || []
  let window = bounds()
  if (window.error) {
    note.value = window.error
    result.value = null
    return
  }
  if (range.value === 'since') {
    const overview = await assetApi.overview(billId.value, view.memberId || undefined)
    window = { ...window, startMonth: overview.data?.earliestRecordMonth || window.endMonth }
  }
  const res = await assetApi.trend({
    billId: billId.value,
    memberId: view.memberId || undefined,
    startMonth: window.startMonth,
    endMonth: window.endMonth,
    grain: grain.value,
    metric: metric.value
  })
  if (res.retCode !== 0) {
    note.value = res.message || '趋势没有加载出来'
    return
  }
  result.value = res.data
  pick.value = Math.max((res.data?.labels || []).length - 1, 0)
  const hasValue = (res.data?.series || []).some((item) => item.values.some((value) => value != null))
  note.value = hasValue ? window.note : '这段时间没有盘点'
}
watch(() => [billId.value, view.memberId, range.value, grain.value, metric.value, start.value, end.value], load, { immediate: true })
</script>
