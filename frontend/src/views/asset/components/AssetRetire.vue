<template>
  <section v-show="active" class="retire-panel">
    <div v-if="!view?.plan" class="retire-card retire-empty">
      <div>{{ memberId ? memberName : '这个账本' }}还没有养老计划</div>
      <button type="button" class="btn primary" @click="openEdit">设置养老计划</button>
    </div>
    <template v-else>
      <div class="retire-grid">
        <div class="retire-card wide">
          <h3>
            <span>养老计划{{ memberId ? ' · ' + memberName : '' }}</span>
            <button type="button" class="btn" @click="openEdit">修改计划</button>
          </h3>
          <div class="retire-goal">
            <div><div class="label">目标金额</div><div class="num">{{ formatMoney(view.plan.amount) }}</div></div>
            <div><div class="label">目标时间</div><div class="num">{{ plan.targetText }}</div></div>
            <div><div class="label">当前金额（净资产）</div><div class="num">{{ formatMoney(view.netWorth) }}</div></div>
            <div v-if="plan.hasTarget"><div class="label">剩余时间</div><div class="num">{{ plan.leftText }}</div></div>
          </div>
          <div class="progress-row">
            <div class="line"><span>金额进度 <b>{{ plan.amountPercent }}</b></span><span>{{ formatMoney(view.netWorth) }} / {{ formatMoney(view.plan.amount) }}</span></div>
            <div class="progress"><i :style="{ width: plan.amountPercent, background: '#409eff' }"></i></div>
          </div>
          <div v-if="plan.hasTarget" class="progress-row">
            <div class="line">
              <span>时间进度 <b>{{ plan.timePercent }}</b></span>
              <span>{{ plan.startText }} 至 {{ plan.targetText }} · <span :class="plan.ahead ? 'up' : 'down'">{{ plan.ahead ? '金额进度领先时间进度' : '金额进度落后时间进度' }}</span></span>
            </div>
            <div class="progress"><i :style="{ width: plan.timePercent, background: '#e6a23c' }"></i></div>
          </div>
        </div>
        <div class="retire-card wide">
          <h3><span>按收支推算</span></h3>
          <div class="retire-scheme">
            <span>收入</span>
            <div class="seg">
              <button type="button" :class="{ active: incomeYears === 3 }" @click="incomeYears = 3">近3年</button>
              <button type="button" :class="{ active: incomeYears === 5 }" @click="incomeYears = 5">近5年</button>
            </div>
            <span>支出</span>
            <div class="seg">
              <button type="button" :class="{ active: expenseYears === 3 }" @click="expenseYears = 3">近3年</button>
              <button type="button" :class="{ active: expenseYears === 5 }" @click="expenseYears = 5">近5年</button>
            </div>
            <el-checkbox v-model="skipIdle">剔除没有收入的月份</el-checkbox>
          </div>
          <p class="month-note">{{ idleNote }}</p>
          <div class="retire-stat">
            <div><div class="label">近{{ incomeYears }}年月均收入</div><div class="num up">{{ formatMoney(view.monthlyIncome) }}</div></div>
            <div><div class="label">近{{ expenseYears }}年月均支出</div><div class="num down">{{ formatMoney(view.monthlyExpense) }}</div></div>
            <div><div class="label">月均结余</div><div class="num" :class="changeClass(savingAmount)">{{ changeText(savingAmount) }}</div></div>
          </div>
          <div class="retire-result" :class="{ bad: verdict.bad }">
            <div v-if="verdict.title" class="big" :class="verdict.tone">{{ verdict.title }}</div>
            <template v-if="verdict.reachMonths">
              大约还需 <span class="big">{{ verdict.reachMonths }}</span>，在 <b>{{ verdict.reachWhen }}</b> 前后达到目标<template v-if="verdict.verdict">，<span :class="verdict.tone">{{ verdict.verdict }}</span></template>。<br />
            </template>
            {{ verdict.extra }}
          </div>
          <p class="month-note">收支取自记账。看单人时，月均支出只含只归属这个人的支出，不含按收入拆入的共同支出和公共支出。推算只用月均结余，不计投资收益和通胀，结果只作参考。</p>
        </div>
      </div>
      <div class="retire-card wide retire-chart">
        <h3><span>账户资产与目标对比</span></h3>
        <p class="month-note">{{ chartNote }}</p>
        <div ref="host" class="retire-host"></div>
      </div>
    </template>

    <el-dialog v-model="editing" title="设置养老计划" width="480px">
      <el-form label-position="top">
        <el-form-item label="目标金额（元）"><el-input v-model="amount" /></el-form-item>
        <div class="two">
          <el-form-item label="开始时间"><el-date-picker v-model="startMonth" type="month" value-format="YYYY-MM" style="width: 100%" /></el-form-item>
          <el-form-item label="目标时间"><el-date-picker v-model="targetMonth" type="month" value-format="YYYY-MM" placeholder="可不填" style="width: 100%" /></el-form-item>
        </div>
        <p class="hint">开始时间决定曲线从哪个月画起。目标时间可以不填；不填时不显示时间进度，目标进度按目标金额画成一条横线。</p>
      </el-form>
      <template #footer>
        <el-button @click="editing = false">取消</el-button>
        <el-button type="primary" :loading="busy" @click="savePlan">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, ref, toRef, watch, type Ref } from 'vue'
import dayjs from 'dayjs'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import { changeClass, changeText, formatMoney } from '../shared'
import { useRetire } from '../hooks/use-retire'

const props = defineProps<{
  active: boolean
  memberId: string
  memberName: string
}>()

const memberId = toRef(props, 'memberId')
const revision = inject<Ref<number>>('assetRevision', ref(0))
const { billId } = storeToRefs(useBillStore())
const retire = useRetire(memberId)
const view = retire.view
const amount = retire.amount
const startMonth = retire.startMonth
const targetMonth = retire.targetMonth
const busy = retire.saving
const host = retire.host
const incomeYears = retire.incomeYears
const expenseYears = retire.expenseYears
const skipIdle = retire.skipIdle
const editing = ref(false)

const monthIndexOf = (text?: string | null) => {
  if (!text || !/^\d{4}-\d{2}$/.test(text)) return null
  const [yearText, monthPart] = text.split('-').map(Number)
  return yearText * 12 + monthPart - 1
}
const monthNameOf = (index: number) => `${Math.floor(index / 12)}年${(index % 12) + 1}月`
const spanText = (months: number) => {
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (!years) return `${rest} 个月`
  return rest ? `${years} 年 ${rest} 个月` : `${years} 年`
}

const savingAmount = computed(() => (view.value?.monthlyIncome || 0) - (view.value?.monthlyExpense || 0))
const plan = computed(() => {
  const currentPlan = view.value?.plan
  const current = view.value?.netWorth || 0
  const now = dayjs()
  const nowIndex = now.year() * 12 + now.month()
  const startIndex = monthIndexOf(currentPlan?.startMonth)
  const targetIndex = monthIndexOf(currentPlan?.targetMonth)
  const hasTarget = targetIndex != null && startIndex != null
  const amountRate = currentPlan && currentPlan.amount > 0 ? Math.max(0, Math.min(current / currentPlan.amount, 1)) : 0
  const timeTotal = hasTarget ? targetIndex - startIndex : 0
  const timeRate = startIndex != null && timeTotal > 0 ? Math.max(0, Math.min((nowIndex - startIndex) / timeTotal, 1)) : 1
  const leftMonths = hasTarget ? Math.max(targetIndex - nowIndex, 0) : 0
  return {
    hasTarget,
    amountPercent: `${(amountRate * 100).toFixed(1)}%`,
    timePercent: `${(timeRate * 100).toFixed(1)}%`,
    ahead: amountRate >= timeRate,
    targetText: hasTarget ? monthNameOf(targetIndex) : '未设置',
    startText: startIndex == null ? '' : monthNameOf(startIndex),
    leftText: leftMonths ? spanText(leftMonths) : '已到期',
    nowIndex,
    targetIndex,
    leftMonths,
  }
})
const verdict = computed(() => {
  const currentPlan = view.value?.plan
  const current = view.value?.netWorth || 0
  const gap = Math.max((currentPlan?.amount || 0) - current, 0)
  const saving = savingAmount.value
  const info = plan.value
  const empty = { bad: false, title: '', tone: '', reachMonths: '', reachWhen: '', verdict: '', extra: '' }
  if (!currentPlan) return empty
  if (gap <= 0) {
    return { ...empty, title: '已达到目标金额', tone: 'up', extra: `当前净资产 ${formatMoney(current)}，已超过目标 ${formatMoney(current - currentPlan.amount)}。` }
  }
  if (saving <= 0) {
    const byTarget = info.hasTarget
      ? `按目标时间需每月结余 ${formatMoney(info.leftMonths > 0 ? gap / info.leftMonths : gap)}。`
      : '未设置目标时间，无法按期限倒推每月需要的结余。'
    return { ...empty, bad: true, title: '按当前收支达不到目标', tone: 'down', extra: `月均支出不低于月均收入，每月没有结余。还差 ${formatMoney(gap)}。${byTarget}` }
  }
  const months = Math.ceil(gap / saving)
  const reachIndex = info.nowIndex + months
  const base = `还差 ${formatMoney(gap)}，按月均结余 ${formatMoney(saving)} 推算。`
  if (!info.hasTarget || info.targetIndex == null) {
    return { ...empty, reachMonths: spanText(months), reachWhen: monthNameOf(reachIndex), extra: base }
  }
  const diff = info.targetIndex - reachIndex
  const need = info.leftMonths > 0 ? gap / info.leftMonths : gap
  return {
    bad: diff < 0,
    title: '',
    tone: diff >= 0 ? 'up' : 'down',
    reachMonths: spanText(months),
    reachWhen: monthNameOf(reachIndex),
    verdict: diff >= 0 ? `比目标时间早 ${spanText(diff)}` : `比目标时间晚 ${spanText(-diff)}`,
    extra: `${base}按目标时间需每月结余 ${formatMoney(need)}。`,
  }
})
const idleNote = computed(() => {
  const idle = view.value?.idleMonths || []
  const years = incomeYears.value
  if (!idle.length) return `近${years}年每个月都有收入。`
  const text = idle.map((item) => (props.memberId ? item.month : `${item.name} ${item.month}`)).join('、')
  if (skipIdle.value) return `已剔除 ${idle.length} 个没有收入的月份：${text}。这些月份不参与收入平均，支出照常统计。`
  return `有 ${idle.length} 个月份没有收入：${text}，目前按 0 计入收入平均。`
})
const chartNote = computed(() => {
  const currentPlan = view.value?.plan
  const series = view.value?.series || []
  if (!currentPlan || !series.length) return '账户资产取每月月底的净资产。'
  const startIndex = monthIndexOf(series[0].month)
  const endIndex = monthIndexOf(series[series.length - 1].month)
  const range = startIndex != null && endIndex != null ? `${monthNameOf(startIndex)} 至 ${monthNameOf(endIndex)}。` : ''
  const hasTarget = Boolean(currentPlan.targetMonth)
  const base = series.find((item) => item.value != null)?.value ?? 0
  const targetIndex = monthIndexOf(currentPlan.targetMonth)
  const totalMonths = hasTarget && startIndex != null && targetIndex != null ? Math.max(targetIndex - startIndex, 1) : 1
  const last = series.length - 1
  const lastValue = series[last]?.value
  const goal = hasTarget ? Math.round((base + (currentPlan.amount - base) * last / totalMonths) * 100) / 100 : currentPlan.amount
  const gapNow = lastValue == null ? null : lastValue - goal
  const compared = hasTarget ? '目标进度' : '目标金额'
  const gapText = gapNow == null
    ? '本月还没有盘点。'
    : gapNow >= 0
      ? `本月账户资产比${compared}多 ${formatMoney(gapNow)}。`
      : `本月账户资产比${compared}少 ${formatMoney(Math.abs(gapNow))}。`
  const goalNote = hasTarget && targetIndex != null
    ? `目标进度线从开始时间的资产匀速涨到 ${monthNameOf(targetIndex)} 的 ${formatMoney(currentPlan.amount)}。`
    : `未设置目标时间，目标进度是 ${formatMoney(currentPlan.amount)} 的水平线。`
  return `${range}账户资产取每月月底的净资产；${goalNote}${gapText}`
})

const openEdit = () => {
  const currentPlan = view.value?.plan
  if (currentPlan) {
    amount.value = String(currentPlan.amount)
    startMonth.value = currentPlan.startMonth
    targetMonth.value = currentPlan.targetMonth || ''
  } else {
    amount.value = ''
    startMonth.value = dayjs().format('YYYY-MM')
    targetMonth.value = ''
  }
  editing.value = true
}
const savePlan = async () => {
  const ok = await retire.save()
  if (ok) editing.value = false
}

watch([() => props.active, memberId, billId, revision], async () => {
  if (!props.active) return
  await nextTick()
  await retire.load()
}, { immediate: true })
</script>

<style scoped lang="scss">
@use './asset.scss' as *;

.retire-panel {
  @include tone;

  .btn {
    @include asset-btn;
  }

  .retire-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .retire-card {
    @include panel-card;
    padding: 16px 18px;

    &.wide {
      grid-column: 1 / -1;
    }

    h3 {
      font-size: 16px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  }

  .retire-empty {
    text-align: center;
    padding: 48px 0;
    color: #888;

    .btn {
      margin-top: 12px;
    }
  }

  .retire-goal {
    display: flex;
    gap: 40px;
    flex-wrap: wrap;

    .label {
      font-size: 16px;
      color: #888;
    }

    .num {
      font-size: 24px;
      font-weight: bold;
      line-height: 1.4;
    }
  }

  .progress-row {
    margin-top: 14px;

    .line {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: #666;
      margin-bottom: 6px;

      b {
        color: #333;
      }
    }
  }

  .progress {
    height: 12px;
    border-radius: 6px;
    background: #eef1f6;
    overflow: hidden;

    i {
      display: block;
      height: 100%;
      border-radius: 6px;
    }
  }

  .retire-scheme {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    font-size: 16px;
    color: #666;

    .seg {
      @include seg;
      margin-bottom: 0;
    }
  }

  .month-note {
    margin: 8px 0 0;
    font-size: 12px;
    color: #888;
    line-height: 1.6;
  }

  .retire-stat {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-top: 12px;

    > div {
      background: #f8fbff;
      border-radius: 6px;
      padding: 10px 12px;
    }

    .label {
      font-size: 16px;
      color: #888;
    }

    .num {
      font-size: 20px;
      font-weight: bold;
      margin-top: 2px;
    }
  }

  .retire-result {
    margin-top: 14px;
    padding: 14px 16px;
    border-radius: 6px;
    background: #f6fbf7;
    border: 1px solid #d6efdc;
    font-size: 14px;
    line-height: 1.8;

    &.bad {
      background: #fff6f6;
      border-color: #f8d4d4;
    }

    .big {
      font-size: 22px;
      font-weight: bold;
    }
  }

  .retire-chart {
    margin-top: 12px;
  }

  .retire-host {
    height: 320px;
  }

  .two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .hint {
    font-size: 12px;
    color: #909399;
    margin-top: 4px;
  }
}
</style>
