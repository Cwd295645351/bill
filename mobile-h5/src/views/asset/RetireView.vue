<template>
  <div class="asset-screen sub">
    <van-nav-bar title="养老计划" left-arrow fixed placeholder @click-left="router.back()" />
    <div class="a-members">
      <button type="button" :class="{ on: !view.memberId }" @click="view.memberId = ''">全部</button>
      <button v-for="item in members" :key="item.id" type="button" :class="{ on: view.memberId === item.id }" @click="view.memberId = item.id">{{ item.name }}</button>
    </div>
    <p v-if="error" class="a-hint warn">{{ error }}</p>
    <template v-else-if="!data?.plan">
      <div class="empty"><div class="illus"></div>{{ who }}还没有养老计划</div>
      <div class="a-hint">设置后按记账收支推算到达时间，并和账户资产对比。口径与总览一致。</div>
      <div style="padding:0 48px 24px"><button type="button" class="btn" @click="editing = true">设置养老计划</button></div>
    </template>
    <template v-else>
      <section class="a-card">
        <div class="a-top"><span class="a-title">养老计划{{ view.memberId ? '' : '' }}</span><button type="button" class="a-link" style="margin:0" @click="editing = true">修改</button></div>
        <div class="a-note">口径：含固定资产。净资产始终含固定资产。</div>
        <div class="a-stats">
          <div class="a-stat"><div class="k">目标金额</div><div class="n">{{ money(data.plan.amount) }}</div></div>
          <div class="a-stat"><div class="k">当前净资产</div><div class="n">{{ money(data.netWorth) }}</div></div>
          <div class="a-stat"><div class="k">目标时间</div><div class="n" style="font-size:14px">{{ planText }}</div></div>
          <div v-if="hasTarget" class="a-stat"><div class="k">剩余时间</div><div class="n" style="font-size:14px">{{ leftText }}</div></div>
        </div>
        <div class="a-note">金额进度 {{ amountPercent }}{{ exceed === '未超过' ? '' : ' · 已超过 ' + exceed }}</div>
        <div class="a-progress"><i :style="{ width: amountPercent, background: '#4285f4' }"></i></div>
        <template v-if="hasTarget">
          <div class="a-note">时间进度 {{ timePercent }} · {{ ahead ? '金额进度领先' : '金额进度落后' }}</div>
          <div class="a-progress"><i :style="{ width: timePercent, background: '#e6a23c' }"></i></div>
        </template>
      </section>
      <section class="a-card">
        <span class="a-title">按收支推算</span>
        <div class="a-scheme">
          <div class="a-scheme-row"><span>收入</span><div class="a-seg"><button type="button" :class="{ on: incomeYears === 3 }" @click="incomeYears = 3">近3年</button><button type="button" :class="{ on: incomeYears === 5 }" @click="incomeYears = 5">近5年</button></div></div>
          <div class="a-scheme-row"><span>支出</span><div class="a-seg"><button type="button" :class="{ on: expenseYears === 3 }" @click="expenseYears = 3">近3年</button><button type="button" :class="{ on: expenseYears === 5 }" @click="expenseYears = 5">近5年</button></div></div>
          <button type="button" class="a-check" :class="{ on: skipIdle }" @click="skipIdle = !skipIdle"><i>{{ skipIdle ? '✓' : '' }}</i>剔除没有收入的月份</button>
        </div>
        <div class="a-note">{{ idleNote }}</div>
        <div class="a-stats">
          <div class="a-stat"><div class="k">近{{ incomeYears }}年月均收入</div><div class="n income">{{ money(data.monthlyIncome) }}</div></div>
          <div class="a-stat"><div class="k">近{{ expenseYears }}年月均支出</div><div class="n cost">{{ money(data.monthlyExpense) }}</div></div>
          <div class="a-stat"><div class="k">月均结余</div><div class="n" :class="changeClass(surplus)">{{ deltaText(surplus, view.hideAmount) }}</div></div>
        </div>
        <div class="a-result" :class="verdict.bad ? 'bad' : 'ok'">
          <span v-if="verdict.title" class="big title" :class="verdict.bad ? 'cost' : 'income'">{{ verdict.title }}</span>
          <template v-if="verdict.reach">大约还需 <span class="big">{{ verdict.reach }}</span>，在 <b>{{ verdict.when }}</b> 前后达到。</template>
          {{ verdict.extra }}
        </div>
        <div class="a-note">收支取自记账。看单人时，月均支出只含只归属这个人的支出，不含按收入拆入的共同支出和公共支出。推算只用月均结余，不计投资收益和通胀，结果只作参考。{{ data.message }}</div>
      </section>
      <section class="a-card">
        <span class="a-title">账户资产与目标对比</span>
        <div class="a-note">{{ chartNote }}</div>
        <RetireLineChart v-if="data.plan" :series="data.series || []" :amount="data.plan.amount" :target-month="data.plan.targetMonth" :hidden="view.hideAmount" />
      </section>
    </template>
    <van-popup v-model:show="editing" position="bottom" round>
      <div class="sheet-bar"><button type="button" class="cancel" @click="editing = false">取消</button><div class="sheet-title">设置养老计划</div><button type="button" class="confirm" @click="save">保存</button></div>
      <div class="field"><label>目标金额</label><input v-model="amount" inputmode="decimal" /></div>
      <div class="field"><label>开始月份</label><input v-model="startMonth" type="month" /></div>
      <div class="field"><label>目标月份</label><input v-model="targetMonth" type="month" /></div>
      <p v-if="formError" class="a-hint warn">{{ formError }}</p>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { assetApi, type AssetMember, type RetireResult } from '@/api/asset'
import RetireLineChart from './RetireLineChart.vue'
import { useAssetViewStore } from '@/stores/asset-view'
import { changeClass, deltaText, moneyText, monthText } from '@/utils/asset-format'
import './asset.css'

const route = useRoute()
const router = useRouter()
const view = useAssetViewStore()
const billId = computed(() => String(route.params.id || ''))
const data = ref<RetireResult | null>(null)
const error = ref('')
const editing = ref(false)
const formError = ref('')
const amount = ref('')
const startMonth = ref(monthText())
const targetMonth = ref('')
const incomeYears = ref<3 | 5>(3)
const expenseYears = ref<3 | 5>(3)
const skipIdle = ref(true)
const members = ref<AssetMember[]>([])
const who = computed(() => (view.memberId ? '这名成员' : '这个账本'))
const hidden = computed(() => view.hideAmount)

function money(value?: number | null) {
  return moneyText(value, hidden.value)
}
function monthIndex(text?: string | null) {
  if (!text || !/^\d{4}-\d{2}$/.test(text)) return null
  const [year, month] = text.split('-').map(Number)
  return year * 12 + month - 1
}
function monthName(index: number) {
  return `${Math.floor(index / 12)}年${(index % 12) + 1}月`
}
function spanText(months: number) {
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (!years) return `${rest} 个月`
  return rest ? `${years} 年 ${rest} 个月` : `${years} 年`
}

const nowIndex = new Date().getFullYear() * 12 + new Date().getMonth()
const hasTarget = computed(() => !!data.value?.plan?.targetMonth)
const amountPercent = computed(() => {
  const plan = data.value?.plan
  if (!plan?.amount) return '0.0%'
  return `${Math.max(0, Math.min((data.value?.netWorth || 0) / plan.amount, 1) * 100).toFixed(1)}%`
})
const timePercent = computed(() => {
  const start = monthIndex(data.value?.plan?.startMonth)
  const target = monthIndex(data.value?.plan?.targetMonth)
  if (start == null || target == null || target <= start) return '100.0%'
  return `${Math.max(0, Math.min((nowIndex - start) / (target - start), 1) * 100).toFixed(1)}%`
})
const ahead = computed(() => parseFloat(amountPercent.value) >= parseFloat(timePercent.value))
const planText = computed(() => (hasTarget.value ? data.value?.plan?.targetMonth : '未设置'))
const leftText = computed(() => {
  const target = monthIndex(data.value?.plan?.targetMonth)
  if (target == null) return ''
  const left = Math.max(target - nowIndex, 0)
  return left ? spanText(left) : '已到期'
})
const exceed = computed(() => {
  const plan = data.value?.plan
  if (!plan) return '未超过'
  const gap = (data.value?.netWorth || 0) - plan.amount
  return gap > 0 ? moneyText(gap, hidden.value) : '未超过'
})
const surplus = computed(() => (data.value?.monthlyIncome || 0) - (data.value?.monthlyExpense || 0))
const idleNote = computed(() => {
  const idle = data.value?.idleMonths || []
  if (!idle.length) return `近${incomeYears.value}年每个月都有收入。`
  const text = idle.map((item) => (view.memberId ? item.month : `${item.name} ${item.month}`)).join('、')
  return skipIdle.value ? `已剔除 ${idle.length} 个没有收入的月份：${text}。这些月份不参与收入平均，支出照常统计。` : `有 ${idle.length} 个月没有收入：${text}，目前按 0 计入收入平均。`
})
const verdict = computed(() => {
  const plan = data.value?.plan
  const current = data.value?.netWorth || 0
  if (!plan) return { bad: false, title: '', reach: '', when: '', extra: '' }
  const gap = plan.amount - current
  if (gap <= 0) return { bad: false, title: '已达到目标金额', reach: '', when: '', extra: `当前净资产超过目标 ${moneyText(-gap, hidden.value)}。` }
  if (surplus.value <= 0) return { bad: true, title: '按当前收支达不到目标', reach: '', when: '', extra: `还差 ${moneyText(gap, hidden.value)}。` }
  const months = Math.ceil(gap / surplus.value)
  const when = monthName(nowIndex + months)
  const target = monthIndex(plan.targetMonth)
  const compare = target == null ? '' : target >= nowIndex + months ? `比目标时间早 ${spanText(target - (nowIndex + months))}。` : `比目标时间晚 ${spanText(nowIndex + months - target)}。`
  return { bad: target != null && target < nowIndex + months, title: '', reach: spanText(months), when, extra: `还差 ${moneyText(gap, hidden.value)}。${compare}` }
})
const chartNote = computed(() => {
  const series = data.value?.series || []
  if (!series.length) return '账户资产取每月月底的净资产。'
  return `${series[0].month} 至 ${series[series.length - 1].month}。没有盘点的月份断开。`
})

async function load() {
  view.bindBill(billId.value)
  const [memberRes, res] = await Promise.all([
    assetApi.members(billId.value),
    assetApi.retirePlan({
      billId: billId.value,
      memberId: view.memberId || undefined,
      incomeYears: incomeYears.value,
      expenseYears: expenseYears.value,
      skipIdle: skipIdle.value ? '1' : '0'
    })
  ])
  members.value = memberRes.data || []
  if (res.retCode !== 0) error.value = res.message || '养老计划没有加载出来'
  else {
    data.value = res.data
    if (res.data?.plan) {
      amount.value = String(res.data.plan.amount)
      startMonth.value = res.data.plan.startMonth
      targetMonth.value = res.data.plan.targetMonth || ''
    }
  }
}
async function save() {
  const value = Number(amount.value)
  const now = monthText()
  if (!(value > 0)) return (formError.value = '目标金额必须大于 0')
  if (startMonth.value > now) return (formError.value = '开始月份不能晚于本月')
  if (targetMonth.value && targetMonth.value <= now) return (formError.value = '目标月份必须晚于本月')
  formError.value = ''
  const res = await assetApi.saveRetirePlan({
    billId: billId.value,
    memberId: view.memberId || undefined,
    amount: value,
    startMonth: startMonth.value,
    targetMonth: targetMonth.value || undefined
  })
  if (res.retCode !== 0) return (formError.value = res.message || '没有保存')
  editing.value = false
  await load()
}
watch(() => [billId.value, view.memberId, incomeYears.value, expenseYears.value, skipIdle.value], load, { immediate: true })
</script>
