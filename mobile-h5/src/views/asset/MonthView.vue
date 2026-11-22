<template>
  <div class="asset-screen sub">
    <van-nav-bar title="月历" left-arrow fixed placeholder @click-left="router.back()" />
    <div class="a-members">
      <button type="button" :class="{ on: !view.memberId }" @click="view.memberId = ''">全部</button>
      <button v-for="item in members" :key="item.id" type="button" :class="{ on: view.memberId === item.id }" @click="view.memberId = item.id">{{ item.name }}</button>
    </div>
    <section class="a-card">
      <div class="a-range">
        <button v-for="item in years" :key="item" type="button" :class="{ on: item === year }" @click="year = item">{{ item }}</button>
      </div>
      <div class="a-note">{{ year }} 年。{{ year === nowYear ? '今年只画到本月，高亮的是本月。' : '这一年画满 12 个月，高亮的是 12 月。' }}没有盘点的月份留空。每一类按自己的最大值拉伸，和趋势不是同一张图。含固定资产。</div>
    </section>
    <p v-if="error" class="a-hint warn">{{ error }}</p>
    <section v-for="item in cards" :key="item.name" class="a-card">
      <div class="a-top"><span class="a-title">{{ item.name }}</span><b>{{ item.current }}</b></div>
      <div class="a-note">较年初 <span class="a-change" :class="item.cls">{{ item.change }}</span></div>
      <MonthBarChart :values="item.values" :color="item.color" :highlight="limit" :hidden="view.hideAmount" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MonthBarChart from './MonthBarChart.vue'
import { assetApi, type MonthlyReport } from '@/api/asset'
import { useAssetViewStore } from '@/stores/asset-view'
import { ASSET_COLORS, changeClass, deltaText, moneyText, signedText } from '@/utils/asset-format'
import './asset.css'

const order = ['总资产', '总净资产', '流动资金', '投资理财', '固定资产', '应收款', '总负债']
const route = useRoute()
const router = useRouter()
const view = useAssetViewStore()
const billId = computed(() => String(route.params.id || ''))
const nowYear = new Date().getFullYear()
const year = ref(nowYear)
const years = computed(() => Array.from({ length: 6 }, (_, index) => nowYear - index))
const members = ref<{ id: string; name: string }[]>([])
const report = ref<MonthlyReport | null>(null)
const error = ref('')
const limit = computed(() => (year.value === nowYear ? new Date().getMonth() + 1 : 12))
const cards = computed(() => order.map((name) => {
  const row = report.value?.[name]
  const values = (row?.monthlyData || []).slice(0, limit.value)
  const current = values[values.length - 1]
  const ytd = row?.yearChange
  return {
    name,
    color: ASSET_COLORS[name] || '#4285f4',
    current: current == null ? '—' : (name === '总净资产' ? signedText(current, view.hideAmount) : moneyText(current, view.hideAmount)),
    change: current == null ? '—' : deltaText(ytd, view.hideAmount),
    cls: changeClass(name === '总负债' && ytd != null ? -Number(ytd) : ytd),
    values
  }
}))

async function load() {
  view.bindBill(billId.value)
  const [memberRes, res] = await Promise.all([
    assetApi.members(billId.value),
    assetApi.monthlyReport(billId.value, year.value, view.memberId || undefined)
  ])
  members.value = memberRes.data || []
  if (res.retCode !== 0) error.value = res.message || '月历没有加载出来'
  else report.value = res.data
}
watch(() => [billId.value, view.memberId, year.value], load, { immediate: true })
</script>
