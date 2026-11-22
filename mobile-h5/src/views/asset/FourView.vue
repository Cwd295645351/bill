<template>
  <div class="asset-screen sub">
    <van-nav-bar title="四笔钱" left-arrow fixed placeholder @click-left="router.back()" />
    <div class="a-members">
      <button type="button" :class="{ on: !view.memberId }" @click="view.memberId = ''">全部</button>
      <button v-for="item in members" :key="item.id" type="button" :class="{ on: view.memberId === item.id }" @click="view.memberId = item.id">{{ item.name }}</button>
      <button type="button" class="a-manage" @click="router.push({ name: 'bill-asset-members', params: { id: billId } })">管理</button>
    </div>
    <p v-if="error" class="a-hint warn">{{ error }}</p>
    <section class="a-card">
      <span class="a-title">三类对比</span>
      <div class="a-note">只统计活钱、稳健、长期，三者合计 100%。保障在下面单独看，不含负债。点某一笔查看盘点。</div>
      <div v-if="pie.length" class="a-pie">
        <div class="a-disk" :style="{ background: pieGradient }"></div>
        <div class="a-legend">
          <div v-for="item in flex" :key="item.key"><i :style="{ background: item.color }"></i><span>{{ item.name }}</span><b>{{ item.percent }}</b></div>
        </div>
      </div>
      <div v-else class="a-note">暂无</div>
    </section>
    <section v-for="item in rows" :key="item.key" class="a-card">
      <div class="a-top"><span class="a-title">{{ item.title }}</span><b>{{ item.empty ? '暂无' : money(item.amount) }}</b></div>
      <div class="a-note">{{ item.count }} 笔 · {{ item.share }}{{ item.extra }}</div>
      <template v-if="item.blocks.length">
        <div v-for="block in item.blocks" :key="block.name">
          <div class="a-mhead"><span class="grow">{{ block.name }}</span><span>{{ money(block.amount) }}</span></div>
          <button v-for="asset in block.rows" :key="asset.id" type="button" class="a-arow" @click="openRecords(asset.id)">
            <span class="grow"><span class="title">{{ asset.name }}{{ item.insurance ? ' · ' + (asset.insuranceCategory || '其他') : '' }}</span></span>
            <span class="a-amt">{{ money(asset.latestAmount) }}<em v-if="fx(asset)">{{ fx(asset) }}</em></span>
          </button>
        </div>
      </template>
      <div v-else class="a-note">暂无</div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { assetApi, type AssetRow, type FourSummary } from '@/api/asset'
import { useAssetViewStore } from '@/stores/asset-view'
import { ASSET_COLORS, currencySymbol, memberBlocks, moneyText, percentText } from '@/utils/asset-format'
import './asset.css'

const route = useRoute()
const router = useRouter()
const view = useAssetViewStore()
const billId = computed(() => String(route.params.id || ''))
const members = ref<{ id: string; name: string }[]>([])
const data = ref<FourSummary | null>(null)
const error = ref('')
const hidden = computed(() => view.hideAmount)
const keys = [
  { key: 'living', name: '活钱', insurance: false },
  { key: 'steady', name: '稳健', insurance: false },
  { key: 'longterm', name: '长期', insurance: false },
  { key: 'insurance', name: '保险', insurance: true }
]
const base = computed(() => keys.slice(0, 3).reduce((sum, item) => sum + (data.value?.[item.key]?.amount || 0), 0))
const flex = computed(() => keys.slice(0, 3).map((item) => {
  const amount = data.value?.[item.key]?.amount || 0
  return { ...item, color: ASSET_COLORS[item.name], amount, percent: percentText(amount, base.value) }
}))
const pie = computed(() => flex.value.filter((item) => item.amount > 0))
const pieGradient = computed(() => {
  let cursor = 0
  const total = pie.value.reduce((sum, item) => sum + item.amount, 0) || 1
  return `conic-gradient(${pie.value.map((item) => {
    const start = cursor
    cursor += (item.amount / total) * 100
    return `${item.color} ${start}% ${cursor}%`
  }).join(',')})`
})
const rows = computed(() => keys.map((item) => {
  const bucket = data.value?.[item.key]
  const assets = bucket?.assets || []
  const amount = bucket?.amount || 0
  return {
    ...item,
    title: item.insurance ? '保障' : item.name,
    amount,
    count: bucket?.count || 0,
    empty: !bucket?.count,
    share: item.insurance ? '不计入三类比例' : `占三类 ${percentText(amount, base.value)}`,
    extra: item.insurance ? ` · 年交保费 ${moneyText(bucket?.totalPremium || 0, hidden.value)}` : '',
    blocks: memberBlocks(assets)
  }
}))

function money(value?: number | null) {
  return moneyText(value, hidden.value)
}
function fx(asset: AssetRow) {
  if (!asset.currency || asset.currency === 'CNY' || asset.rawAmount == null) return ''
  return currencySymbol(asset.currency) + money(asset.rawAmount)
}
function openRecords(assetId: string) {
  router.push({ name: 'bill-asset-records', params: { id: billId.value }, query: { assetId } })
}
async function load() {
  view.bindBill(billId.value)
  const [memberRes, res] = await Promise.all([
    assetApi.members(billId.value),
    assetApi.fourMoney(billId.value, view.memberId || undefined)
  ])
  members.value = memberRes.data || []
  if (res.retCode !== 0) error.value = res.message || '四笔钱没有加载出来'
  else data.value = res.data
}
watch(() => [billId.value, view.memberId], load, { immediate: true })
</script>
