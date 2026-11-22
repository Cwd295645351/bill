<template>
  <div class="asset-screen">
    <van-nav-bar title="家庭资产" fixed placeholder />
    <div class="a-members">
      <button type="button" :class="{ on: !view.memberId }" @click="pickMember('')">全部</button>
      <button v-for="item in members" :key="item.id" type="button" :class="{ on: view.memberId === item.id }" @click="pickMember(item.id)">{{ item.name }}</button>
      <button type="button" class="a-manage" @click="go('bill-asset-members')">管理</button>
    </div>
    <p v-if="error" class="a-hint warn">{{ error }}</p>
    <p v-else-if="loading" class="a-hint">加载中</p>
    <template v-else-if="empty">
      <div class="empty"><div class="illus"></div>这个账本还没有资产</div>
      <div class="a-hint">资产按当前账本分开。没有登录账号的家人也可以先加到资产成员里。</div>
      <LedgerCard :bill-id="billId" :member-id="view.memberId" :hidden="view.hideAmount" />
    </template>
    <template v-else>
      <section class="a-hero">
        <div class="a-hero-top">
          <div class="label">{{ who }} · {{ view.excludeFixed ? '已移除固定资产' : '含固定资产' }}</div>
          <span class="a-hero-actions">
            <button type="button" class="a-switch" :class="{ on: view.hideAmount }" @click="view.hideAmount = !view.hideAmount">{{ view.hideAmount ? '显示金额' : '隐藏金额' }}</button>
            <button type="button" class="a-switch" :class="{ on: view.excludeFixed }" @click="view.excludeFixed = !view.excludeFixed">移除固定资产</button>
          </span>
        </div>
        <div class="num">{{ signedText(cardNet, view.hideAmount) }}</div>
        <div class="split">
          <div><div class="k">总资产</div><div class="v">{{ shortText(cardAsset, view.hideAmount) }}</div></div>
          <div><div class="k">总负债</div><div class="v">{{ shortText(overview?.debtAmount, view.hideAmount) }}</div></div>
        </div>
        <div class="a-fx">金额均为人民币。{{ rateLine }}。外币按当前汇率折算，改汇率会重算已有月份。{{ view.excludeFixed ? '只从这张卡片的总资产和净资产里去掉固定资产，总负债、分组和其他页面不变。' : '' }}</div>
      </section>
      <section class="a-card">
        <div class="a-top"><span class="a-title">较 {{ dayLabel(compareDay) }}</span><button type="button" class="a-link" style="margin:0" @click="compareOpen = true">更换对比日</button></div>
        <div class="a-note">总资产 <span class="a-change" :class="changeClass(hasBaseline ? overview?.totalChange : 0)">{{ deltaText(hasBaseline ? overview?.totalChange : 0, view.hideAmount) }}</span>　总负债 <span class="a-change" :class="changeClass(hasBaseline ? overview?.debtChange : 0, true)">{{ deltaText(hasBaseline ? overview?.debtChange : 0, view.hideAmount) }}</span></div>
        <div class="a-note">{{ compareNote }}分组里每一笔比的是它自己的上一笔盘点，加总不必等于这里。</div>
      </section>
      <button type="button" class="a-card" @click="go('bill-asset-four')">
        <div class="a-top"><span class="a-title">四笔钱</span><span class="a-link" style="margin:0">查看</span></div>
        <div class="a-note">活钱、稳健、长期。保障单独看，不含负债</div>
        <div v-if="fourTotal" class="a-mix">
          <i v-for="item in fourSlices" :key="item.name" :style="{ width: item.share, background: item.color }"></i>
        </div>
        <div v-else class="a-note">暂无活钱、稳健或长期</div>
        <div class="a-mix-legend"><span v-for="item in fourSlices" :key="item.name"><i :style="{ background: item.color }"></i>{{ item.name }} {{ item.percent }}</span></div>
      </button>
      <button type="button" class="a-card" @click="go('bill-asset-month')">
        <div class="a-top"><span class="a-title">月历</span><span class="a-link" style="margin:0">查看</span></div>
        <div class="a-note">按年看每一类的月末余额。和资产趋势分开，各图按自己的最大值拉伸。</div>
      </button>
      <button type="button" class="a-card" @click="go('bill-asset-trend')">
        <div class="a-top"><span class="a-title">资产趋势</span><span class="a-link" style="margin:0">查看</span></div>
        <div class="a-note">按月份或年份看一段区间。可选记账以来、今年、近 1/3/5 年和自定义。当前{{ view.excludeFixed ? '卡片已移除固定资产' : '含固定资产' }}。</div>
      </button>
      <button type="button" class="a-card" @click="go('bill-asset-retire')">
        <div class="a-top"><span class="a-title">养老计划</span><span class="a-link" style="margin:0">查看</span></div>
        <div class="a-note">含收支推算，以及账户资产和目标进度的对比。</div>
        <div class="a-sub">{{ retireBrief }}</div>
      </button>
      <section v-for="group in groups" :key="group.typeName" class="a-group">
        <button type="button" class="a-ghead" :class="{ debt: group.typeName === '负债' }" @click="toggle(group.typeName)">
          <span class="grow">{{ open[group.typeName] ? '▾ ' : '▸ ' }}{{ group.typeName }}<small>占{{ group.typeName === '负债' ? '负债 ' : '资产 ' }}{{ percentText(group.amount, group.typeName === '负债' ? debtBase : assetBase) }} · 较上一笔 <span :class="changeClass(groupChange(group), group.typeName === '负债')">{{ deltaText(groupChange(group), view.hideAmount) }}</span></small></span>
          <span>{{ shortText(group.amount, view.hideAmount) }}</span>
        </button>
        <template v-if="open[group.typeName]">
          <div v-for="block in memberBlocks(group.assets)" :key="block.name">
            <div class="a-mhead"><span class="grow">{{ block.name }}</span><span>{{ moneyText(block.amount, view.hideAmount) }}</span></div>
            <div v-for="row in block.rows" :key="row.id" class="a-arow">
              <button type="button" class="grow" @click="openRecords(row.id)"><div class="title">{{ row.name }}</div></button>
              <div class="a-amt">{{ moneyText(row.latestAmount, view.hideAmount) }}<em v-if="fx(row)">{{ fx(row) }}</em><em :class="changeClass(row.change, !!row.isDebt || row.type === 'debt')">{{ deltaText(row.change, view.hideAmount) }}</em></div>
            </div>
          </div>
        </template>
      </section>
      <LedgerCard :bill-id="billId" :member-id="view.memberId" :hidden="view.hideAmount" />
    </template>
    <div class="a-foot"><button type="button" class="primary" @click="go('bill-asset-form')">登记资产</button></div>
    <BookTabBar :bill-id="billId" active="asset" />
    <van-popup v-model:show="compareOpen" position="bottom" round>
      <div class="sheet-bar"><button type="button" class="cancel" @click="compareOpen = false">取消</button><div class="sheet-title">更换对比日</div><button type="button" class="confirm" @click="applyCompare">确定</button></div>
      <div class="field"><label>对比日</label><input v-model="compareInput" type="date" :max="today" /></div>
      <div class="a-hint">留空后点确定，会回到上一笔盘点日。</div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BookTabBar from '@/components/BookTabBar.vue'
import { assetApi, type AssetGroup, type AssetOverview, type AssetRow, type AssetStats, type RetireResult } from '@/api/asset'
import { useAssetViewStore } from '@/stores/asset-view'
import { ASSET_COLORS, changeClass, currencySymbol, dayLabel, deltaText, fixedAmount, memberBlocks, moneyText, orderedGroups, percentText, shortText, signedText, todayText } from '@/utils/asset-format'
import LedgerCard from './LedgerCard.vue'
import './asset.css'

const route = useRoute()
const router = useRouter()
const view = useAssetViewStore()
const billId = computed(() => String(route.params.id || ''))
const members = ref<{ id: string; name: string }[]>([])
const stats = ref<AssetStats | null>(null)
const overview = ref<AssetOverview | null>(null)
const retire = ref<RetireResult | null>(null)
const loading = ref(true)
const error = ref('')
const open = reactive<Record<string, boolean>>({})
const today = todayText()
const compareInput = ref('')
const compareOpen = ref(false)

const groups = computed(() => orderedGroups(stats.value))
const empty = computed(() => !groups.value.length)
const fixed = computed(() => fixedAmount(stats.value))
const cardAsset = computed(() => Math.max((overview.value?.assetAmount || 0) - (view.excludeFixed ? fixed.value : 0), 0))
const cardNet = computed(() => (overview.value?.netAmount || 0) - (view.excludeFixed ? fixed.value : 0))
const assetBase = computed(() => overview.value?.assetAmount || 0)
const debtBase = computed(() => overview.value?.debtAmount || 0)
const hasBaseline = computed(() => !!(view.compareDay || overview.value?.defaultAsOf))
const compareDay = computed(() => view.compareDay || overview.value?.defaultAsOf || '')
const who = computed(() => {
  const name = members.value.find((item) => item.id === view.memberId)?.name
  return name ? `${name}的净资产` : '家庭净资产'
})
const compareNote = computed(() => (hasBaseline.value ? '' : '还没有更早的盘点，卡片上的变化按没有变化显示。'))
const rateLine = computed(() => {
  if (!overview.value) return ''
  const saved = overview.value.ratesSaved ? '' : '，当前是尚未保存的初始值'
  return `1 港币 = ${moneyText(overview.value.hkdRate)} 元，1 美元 = ${moneyText(overview.value.usdRate)} 元${saved}`
})
const fourSlices = computed(() => {
  const rows = groups.value.flatMap((group) => group.assets).filter((row) => row.type !== 'debt')
  const names = [
    { key: 'living', name: '活钱' },
    { key: 'steady', name: '稳健' },
    { key: 'longterm', name: '长期' }
  ]
  const slices = names.map((item) => ({
    ...item,
    color: ASSET_COLORS[item.name],
    amount: rows.filter((row) => row.fourMoneyType === item.key).reduce((sum, row) => sum + Number(row.latestAmount || 0), 0)
  }))
  const total = slices.reduce((sum, item) => sum + item.amount, 0)
  return slices.map((item) => ({ ...item, share: total ? `${(item.amount / total) * 100}%` : '0%', percent: percentText(item.amount, total) }))
})
const fourTotal = computed(() => fourSlices.value.reduce((sum, item) => sum + item.amount, 0))
const retireBrief = computed(() => {
  const plan = retire.value?.plan
  const current = retire.value?.netWorth
  if (!plan) return '还没有设置目标 · 含固定资产'
  return `目标 ${shortText(plan.amount, view.hideAmount)} · 当前 ${shortText(current, view.hideAmount)} · 含固定资产`
})

function groupChange(group: AssetGroup) {
  return group.assets.reduce((sum, row) => sum + (Number(row.change) || 0), 0)
}
function fx(row: AssetRow) {
  if (!row.currency || row.currency === 'CNY' || row.rawAmount == null) return ''
  return currencySymbol(row.currency) + moneyText(row.rawAmount, view.hideAmount)
}
function go(name: string) {
  router.push({ name, params: { id: billId.value } })
}
function openRecords(assetId: string) {
  router.push({ name: 'bill-asset-records', params: { id: billId.value }, query: { assetId } })
}
function pickMember(id: string) {
  view.memberId = id
  view.compareDay = ''
}
function toggle(name: string) {
  open[name] = !open[name]
}
function applyCompare() {
  if (compareInput.value && compareInput.value > today) {
    error.value = '对比日不能晚于今天'
    return
  }
  view.compareDay = compareInput.value
  compareOpen.value = false
}

async function load() {
  loading.value = true
  error.value = ''
  view.bindBill(billId.value)
  const memberId = view.memberId || undefined
  const [memberRes, statRes, overviewRes, retireRes] = await Promise.all([
    assetApi.members(billId.value),
    assetApi.listStats(billId.value, memberId),
    assetApi.overview(billId.value, memberId, view.compareDay || undefined),
    assetApi.retirePlan({ billId: billId.value, memberId, incomeYears: 3, expenseYears: 3, skipIdle: '1' })
  ])
  loading.value = false
  if (memberRes.retCode !== 0) {
    error.value = memberRes.message || '无权查看该账本'
    return
  }
  members.value = memberRes.data || []
  if (view.memberId && !members.value.some((item) => item.id === view.memberId)) view.memberId = ''
  if (statRes.retCode !== 0 || overviewRes.retCode !== 0) {
    error.value = statRes.message || overviewRes.message || '资产没有加载出来'
    return
  }
  stats.value = statRes.data
  overview.value = overviewRes.data
  retire.value = retireRes.retCode === 0 ? retireRes.data : null
  if (!view.compareDay) compareInput.value = overviewRes.data?.defaultAsOf || ''
}

watch(() => [billId.value, view.memberId, view.compareDay], load, { immediate: true })
</script>
