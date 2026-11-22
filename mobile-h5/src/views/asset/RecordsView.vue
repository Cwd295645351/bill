<template>
  <div class="asset-screen">
    <van-nav-bar title="盘点" left-arrow fixed placeholder @click-left="router.back()" />
    <section v-if="asset" class="a-card records-head">
      <div class="a-top"><span class="a-title">{{ asset.name }}</span><button type="button" class="a-link" style="margin:0" @click="router.push({ name: 'bill-asset-form', params: { id: billId }, query: { assetId: asset.id } })">编辑资料</button></div>
      <div class="a-note">{{ asset.memberName }} · {{ labelOf(ASSET_TYPES, asset.type) }}{{ asset.fourMoneyType ? ' · ' + labelOf(FOUR_TYPES, asset.fourMoneyType) : '' }} · {{ labelOf(CURRENCIES, asset.currency) }}</div>
      <div class="a-note">只列出实际盘点。当前 {{ money(asset.latestAmount) }}，取日期最新的一条。改盘点日或金额都写回这一条，不会另添。只剩一条时不能删除。</div>
    </section>
    <p v-if="error" class="a-hint warn">{{ error }}</p>
    <div class="a-group">
      <van-list v-model:loading="loading" :finished="finished" finished-text="没有更多了" @load="loadMore">
        <div v-for="item in list" :key="item.id" class="a-arow">
          <div class="grow"><div class="title">{{ stampDay(item.date) }}{{ item.id === latestId ? ' · 当前' : '' }}</div><div class="a-sub">{{ money(item.amount) }}</div></div>
          <button type="button" class="a-link" style="margin:0 8px 0 0" @click="beginEdit(item)">修改</button>
          <button v-if="total > 1" type="button" class="a-link" style="margin:0;color:#f74f4f" @click="pending = item">删除</button>
        </div>
      </van-list>
    </div>
    <div class="a-foot"><button type="button" class="primary" @click="beginAdd">记一笔盘点</button></div>
    <van-popup v-model:show="draftOpen" position="bottom" round>
      <div class="sheet-bar"><button type="button" class="cancel" @click="draftOpen = false">取消</button><div class="sheet-title">{{ editingId ? '修改这一条' : '记一笔盘点' }}</div><button type="button" class="confirm" @click="save">保存</button></div>
      <div class="field"><label>金额</label><input v-model="amount" inputmode="decimal" /></div>
      <div class="field"><label>盘点日</label><input v-model="date" type="date" /></div>
      <div class="a-hint">改的是选中的这一条，不会另添。</div>
    </van-popup>
    <van-dialog v-model:show="showDelete" title="删除盘点" message="删除后不能恢复。" show-cancel-button @confirm="remove" @cancel="pending = null" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { assetApi, type AssetRecordItem, type AssetRow } from '@/api/asset'
import { useAssetViewStore } from '@/stores/asset-view'
import { ASSET_TYPES, CURRENCIES, FOUR_TYPES, dayStamp, labelOf, moneyText, stampDay, todayText } from '@/utils/asset-format'
import './asset.css'

const route = useRoute()
const router = useRouter()
const view = useAssetViewStore()
const billId = computed(() => String(route.params.id || ''))
const assetId = computed(() => String(route.query.assetId || ''))
const asset = ref<AssetRow | null>(null)
const list = ref<AssetRecordItem[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const finished = ref(false)
const error = ref('')
const amount = ref('')
const date = ref(todayText())
const editingId = ref('')
const draftOpen = ref(false)
const pending = ref<AssetRecordItem | null>(null)
const showDelete = computed({
  get: () => !!pending.value,
  set: (value) => { if (!value) pending.value = null }
})
const latestId = computed(() => list.value[0]?.id || '')

function money(value: number) {
  return moneyText(value, view.hideAmount)
}
function beginAdd() {
  editingId.value = ''
  amount.value = ''
  date.value = todayText()
  draftOpen.value = true
}
function beginEdit(item: AssetRecordItem) {
  editingId.value = item.id
  amount.value = String(item.amount)
  date.value = stampDay(item.date)
  draftOpen.value = true
}
async function loadAsset() {
  const stats = await assetApi.listStats(billId.value)
  const rows = [...(stats.data?.assetGroups || []), ...(stats.data?.debtGroups || [])].flatMap((group) => group.assets)
  asset.value = rows.find((item) => item.id === assetId.value) || null
}
async function loadMore() {
  if (!assetId.value || finished.value) {
    loading.value = false
    return
  }
  const res = await assetApi.records(assetId.value, page.value)
  loading.value = false
  if (res.retCode !== 0) {
    error.value = res.message || '盘点没有加载出来'
    finished.value = true
    return
  }
  const incoming = res.data?.list || []
  list.value = page.value === 1 ? incoming : list.value.concat(incoming)
  total.value = res.data?.total || 0
  page.value += 1
  finished.value = list.value.length >= total.value
}
function reload() {
  page.value = 1
  list.value = []
  finished.value = false
  loading.value = true
  loadMore()
}
async function save() {
  if (amount.value.trim() === '' || Number(amount.value) < 0 || !Number.isFinite(Number(amount.value))) return (error.value = '盘点金额不能小于 0')
  if (!date.value) return (error.value = '请填写盘点日')
  error.value = ''
  const res = await assetApi.saveRecord({ id: editingId.value || undefined, assetId: assetId.value, amount: Number(amount.value), date: dayStamp(date.value) }, !!editingId.value)
  if (res.retCode !== 0) return (error.value = res.message || '没有保存')
  editingId.value = ''
  amount.value = ''
  date.value = todayText()
  draftOpen.value = false
  reload()
}
async function remove() {
  if (!pending.value) return
  if (total.value <= 1) return (error.value = '只剩一条盘点，不能删除')
  const res = await assetApi.deleteRecord(pending.value.id)
  pending.value = null
  if (res.retCode !== 0) error.value = res.message || '没有删除'
  else reload()
}
watch(assetId, () => { view.bindBill(billId.value); loadAsset(); reload() }, { immediate: true })
</script>
