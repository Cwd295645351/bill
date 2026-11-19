<template>
  <div class="page overview-page">
    <van-nav-bar title="收支概览" left-arrow fixed placeholder @click-left="router.back()" />

    <div class="period">
      <div class="dims">
        <button type="button" :class="{ on: dimension === 'month' }" @click="setDimension('month')">月</button>
        <button type="button" :class="{ on: dimension === 'year' }" @click="setDimension('year')">年</button>
      </div>
      <div class="stepper">
        <button type="button" @click="shift(-1)">{{ prevLabel }}</button>
        <button type="button" class="center" @click="openCenter">{{ titleText }}</button>
        <button type="button" @click="shift(1)">{{ nextLabel }}</button>
      </div>
      <div class="range">
        <button type="button" class="date" @click="openDate('begin')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h2v2h6V2h2v2h3v18H4V4h3V2zm12 8H5v10h14V10zM5 8h14V6H5v2z" /></svg>
          <span>{{ dotted(begin) }}</span>
        </button>
        <span class="to">至</span>
        <button type="button" class="date" @click="openDate('end')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h2v2h6V2h2v2h3v18H4V4h3V2zm12 8H5v10h14V10zM5 8h14V6H5v2z" /></svg>
          <span>{{ dotted(end) }}</span>
        </button>
      </div>
    </div>

    <div v-if="loadError" class="error">{{ loadError }}</div>
    <div v-if="loading && !view" class="loading">加载中</div>

    <template v-if="view">
      <div class="card sums">
        <div class="out"><span>总支出</span><b>{{ money(view.totalCost) }}</b></div>
        <div class="out"><span>总投资</span><b>{{ money(view.investCost) }}</b></div>
        <div class="out"><span>总消费</span><b>{{ money(view.consumptionCost) }}</b></div>
        <div class="in"><span>总收入</span><b>{{ money(view.totalIncome) }}</b></div>
      </div>

      <div class="card">
        <div class="card-title">收入</div>
        <div v-if="!view.incomes.length" class="muted">这段时间没有收入</div>
        <div v-for="item in view.incomes" :key="item.userId" class="income">
          <span>{{ item.name }}收入</span>
          <b>{{ money(item.money) }}</b>
        </div>
      </div>

      <div class="card">
        <div class="card-title">结算建议</div>
        <div v-for="(line, index) in view.lines" :key="index" class="line">{{ line }}</div>
      </div>

      <div class="card struct">
        <div class="card-title">支出结构</div>
        <div v-if="showMembers" class="members">
          <button type="button" :class="{ on: !memberId }" @click="memberId = ''">全部</button>
          <button
            v-for="member in view.members"
            :key="member.userId"
            type="button"
            :class="{ on: memberId === member.userId }"
            @click="memberId = member.userId"
          >
            {{ member.name }}
          </button>
        </div>
        <div v-if="!activeSlices.length" class="muted">暂无</div>
        <template v-else>
          <div class="chart">
            <svg viewBox="0 0 100 100" class="donut">
              <circle
                v-for="arc in arcs"
                :key="arc.costTypeId"
                cx="50"
                cy="50"
                r="36"
                fill="none"
                :stroke="arc.color"
                stroke-width="14"
                :stroke-dasharray="arc.dash"
                :stroke-dashoffset="arc.offset"
                @click="openCategory(arc)"
              />
            </svg>
          </div>
          <div class="legend">
            <button v-for="arc in arcs" :key="arc.costTypeId" type="button" @click="openCategory(arc)">
              <i :style="{ background: arc.color }" />
              <span class="legend-copy">
                <span>{{ arc.name }}</span>
                <b>{{ arc.percent }}%</b>
              </span>
            </button>
          </div>
          <button v-for="arc in arcs" :key="arc.costTypeId" type="button" class="row" @click="openCategory(arc)">
            <i :style="{ background: arc.color }" />
            <div class="row-main">
              <div class="row-top">
                <span class="name">{{ arc.name }}</span>
                <span class="pct">{{ arc.percent }}%</span>
                <span class="count">共 {{ arc.count }} 笔</span>
                <b>{{ money(arc.money) }}</b>
              </div>
              <div class="bar"><span :style="{ width: barWidth(arc.percent), background: arc.color }" /></div>
            </div>
            <span class="chev">›</span>
          </button>
        </template>
      </div>
    </template>

    <BookTabBar :bill-id="billId" active="overview" />

    <van-popup v-model:show="showMonth" position="bottom" round>
      <div class="sheet">
        <div class="sheet-bar">
          <button type="button" @click="shiftPicker(-1)">上一年</button>
          <div>{{ pickerYear }}年</div>
          <button type="button" @click="shiftPicker(1)">下一年</button>
        </div>
        <div class="months">
          <button v-for="month in 12" :key="month" type="button" @click="pickMonth(month)">{{ month }}月</button>
        </div>
      </div>
    </van-popup>

    <van-popup v-model:show="showYear" position="bottom" round>
      <div class="sheet years">
        <button v-for="year in yearOptions" :key="year" type="button" @click="pickYear(year)">{{ year }}年</button>
      </div>
    </van-popup>

    <van-popup v-model:show="showDate" position="bottom" round>
      <van-date-picker
        v-model="datePickerValue"
        title="选择日期"
        :min-date="minDate"
        :max-date="maxDate"
        :columns-type="['year', 'month', 'day']"
        @confirm="onDateConfirm"
        @cancel="showDate = false"
      />
    </van-popup>

    <van-popup v-model:show="showRecords" position="bottom" round>
      <div class="sheet records-sheet">
        <div class="sheet-bar">
          <button type="button" @click="showRecords = false">关闭</button>
          <div>{{ recordsTitle }}</div>
          <span />
        </div>
        <div class="sheet-body">
          <div v-if="recordsLoading" class="muted">加载中</div>
          <div v-else-if="!records.length" class="muted">暂无</div>
          <div v-for="item in records" :key="item.id" class="record">
            <div class="record-top">
              <span>{{ item.date }}</span>
              <b>{{ money(item.money) }}</b>
            </div>
            <div class="meta">{{ item.payerName }} · {{ item.belongName }}</div>
            <div v-if="item.remark" class="meta">{{ item.remark }}</div>
          </div>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import BookTabBar from '@/components/BookTabBar.vue'
import {
  getMobileOverview,
  getMobileRecords,
  type MobileOverview,
  type OverviewCategory,
  type OverviewRecord,
} from '@/api/overview'

const COLORS = ['#4285f4', '#f74f4f', '#18a356', '#e6862e', '#7b61ff', '#00a3a1', '#c45c26', '#5b8def']
const CIRC = 2 * Math.PI * 36

const route = useRoute()
const router = useRouter()
const billId = ref('')
const dimension = ref<'month' | 'year'>('month')
const labelYear = ref(new Date().getFullYear())
const labelMonth = ref(new Date().getMonth() + 1)
const begin = ref('')
const end = ref('')
const loading = ref(false)
const loadError = ref('')
const view = ref<MobileOverview | null>(null)
const memberId = ref('')
const showMonth = ref(false)
const showYear = ref(false)
const showDate = ref(false)
const dateTarget = ref<'begin' | 'end'>('begin')
const datePickerValue = ref<string[]>([])
const pickerYear = ref(labelYear.value)
const showRecords = ref(false)
const recordsTitle = ref('')
const records = ref<OverviewRecord[]>([])
const recordsLoading = ref(false)

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function boundsOf(dim: 'month' | 'year', year: number, month: number) {
  if (dim === 'year') return { begin: `${year}-01-01`, end: `${year}-12-31` }
  return {
    begin: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(daysInMonth(year, month))}`,
  }
}

function dotted(value: string) {
  return (value || '').replace(/-/g, '.')
}

function money(value: number) {
  return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function barWidth(percent: string) {
  const value = Number(percent) || 0
  return `${Math.min(100, Math.max(0, value))}%`
}

function resetToCurrentMonth() {
  const now = new Date()
  dimension.value = 'month'
  labelYear.value = now.getFullYear()
  labelMonth.value = now.getMonth() + 1
  const range = boundsOf('month', labelYear.value, labelMonth.value)
  begin.value = range.begin
  end.value = range.end
  memberId.value = ''
  view.value = null
}

function applyPeriod() {
  const range = boundsOf(dimension.value, labelYear.value, labelMonth.value)
  begin.value = range.begin
  end.value = range.end
  void load()
}

function setDimension(next: 'month' | 'year') {
  if (dimension.value === next) return
  dimension.value = next
  applyPeriod()
}

function shift(step: number) {
  if (dimension.value === 'year') {
    const next = labelYear.value + step
    const min = view.value?.minYear
    const max = view.value?.maxYear
    if ((min != null && next < min) || (max != null && next > max)) return
    labelYear.value = next
  } else {
    let year = labelYear.value
    let month = labelMonth.value + step
    if (month < 1) {
      month = 12
      year -= 1
    }
    if (month > 12) {
      month = 1
      year += 1
    }
    labelYear.value = year
    labelMonth.value = month
  }
  applyPeriod()
}

function openCenter() {
  if (dimension.value === 'year') {
    showYear.value = true
    return
  }
  pickerYear.value = labelYear.value
  showMonth.value = true
}

function shiftPicker(step: number) {
  const next = pickerYear.value + step
  const min = view.value?.minYear
  const max = view.value?.maxYear
  if ((min != null && next < min) || (max != null && next > max)) return
  pickerYear.value = next
}

function pickMonth(month: number) {
  labelYear.value = pickerYear.value
  labelMonth.value = month
  showMonth.value = false
  applyPeriod()
}

function pickYear(year: number) {
  labelYear.value = year
  showYear.value = false
  applyPeriod()
}

const minDate = computed(() => {
  const year = view.value?.minYear ?? new Date().getFullYear() - 10
  return new Date(year, 0, 1)
})
const maxDate = computed(() => {
  const year = view.value?.maxYear ?? new Date().getFullYear() + 10
  return new Date(year, 11, 31)
})

function openDate(target: 'begin' | 'end') {
  dateTarget.value = target
  const [year, month, day] = (target === 'begin' ? begin.value : end.value).split('-')
  datePickerValue.value = [year, month, day]
  showDate.value = true
}

function onDateConfirm(payload: { selectedValues?: string[] }) {
  const selected = payload.selectedValues || []
  showDate.value = false
  if (selected.length < 3) return
  const [year, month, day] = selected
  const value = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  if (dateTarget.value === 'begin' && value > end.value) {
    showToast('开始时间不能晚于结束时间')
    return
  }
  if (dateTarget.value === 'end' && begin.value > value) {
    showToast('开始时间不能晚于结束时间')
    return
  }
  if (dateTarget.value === 'begin') begin.value = value
  else end.value = value
  void load()
}

const titleText = computed(() =>
  dimension.value === 'year' ? `${labelYear.value}年` : `${labelYear.value}年${labelMonth.value}月`
)
const prevLabel = computed(() => (dimension.value === 'year' ? '上一年' : '上一月'))
const nextLabel = computed(() => (dimension.value === 'year' ? '下一年' : '下一月'))
const yearOptions = computed(() => {
  const now = new Date().getFullYear()
  const min = view.value?.minYear ?? now
  const max = view.value?.maxYear ?? now + 10
  const years: number[] = []
  for (let year = min; year <= max; year += 1) years.push(year)
  return years
})
const showMembers = computed(() => (view.value?.members.length || 0) > 1)
const activeSlices = computed(() => {
  if (!view.value) return []
  if (!memberId.value) return view.value.categories.all
  return view.value.categories.members.find((item) => item.userId === memberId.value)?.slices || []
})
const arcs = computed(() => {
  let used = 0
  return activeSlices.value.map((item, index) => {
    const ratio = Math.max(0, Number(item.percent) || 0) / 100
    const length = ratio * CIRC
    const arc = {
      ...item,
      color: COLORS[index % COLORS.length],
      dash: `${length} ${CIRC - length}`,
      offset: -used,
    }
    used += length
    return arc
  })
})

async function load() {
  if (!billId.value || !begin.value || !end.value) return
  loading.value = true
  loadError.value = ''
  try {
    const res = await getMobileOverview(billId.value, begin.value, end.value)
    if (res.retCode !== 0 || !res.data) {
      loadError.value = res.message || '加载失败'
      return
    }
    view.value = res.data
    if (memberId.value && !res.data.members.some((item) => item.userId === memberId.value)) memberId.value = ''
  } catch {
    loadError.value = '网络异常'
  } finally {
    loading.value = false
  }
}

async function openCategory(item: OverviewCategory) {
  recordsTitle.value = item.name
  records.value = []
  showRecords.value = true
  recordsLoading.value = true
  try {
    const res = await getMobileRecords({
      billId: billId.value,
      beginDate: begin.value,
      endDate: end.value,
      costTypeId: item.costTypeId,
      memberId: memberId.value || undefined,
    })
    if (res.retCode !== 0 || !res.data) {
      showToast(res.message || '加载失败')
      showRecords.value = false
      return
    }
    records.value = res.data.records || []
  } catch {
    showToast('网络异常')
    showRecords.value = false
  } finally {
    recordsLoading.value = false
  }
}

watch(
  () => String(route.params.id || ''),
  (id) => {
    if (!id || id === billId.value) return
    billId.value = id
    resetToCurrentMonth()
    void load()
  },
  { immediate: true }
)
</script>

<style scoped>
.overview-page {
  min-height: 100vh;
  background: #f5f6f8;
  padding-bottom: 16px;
}
.period,
.card {
  margin: 12px;
  padding: 12px;
  background: #fff;
  border-radius: 12px;
}
.dims,
.stepper,
.range,
.members {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dims button,
.stepper button,
.members button,
.months button,
.years button {
  border: 0;
  background: #f3f5f8;
  color: #333;
  border-radius: 8px;
  padding: 8px 0;
  font-size: 14px;
}
.dims button {
  flex: 1;
}
.dims button.on,
.members button.on {
  background: #4285f4;
  color: #fff;
}
.stepper {
  margin-top: 10px;
}
.stepper button {
  flex: 1;
}
.stepper .center {
  background: #fff;
  font-weight: 600;
}
.range {
  margin-top: 10px;
}
.date {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  border: 0;
  background: transparent;
  color: #222;
  font-size: 14px;
  text-align: left;
}
.date svg {
  width: 16px;
  height: 16px;
  fill: #4285f4;
  flex: none;
}
.date span,
.income span,
.line,
.name,
.legend span,
.record,
.meta {
  word-break: break-all;
}
.to {
  flex: none;
  color: #888;
}
.sums {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.sums span,
.card-title {
  color: #888;
  font-size: 12px;
}
.sums b,
.income b,
.row b,
.record b {
  display: block;
  margin-top: 4px;
  color: #222;
  font-size: 16px;
  word-break: break-all;
}
.sums .out b {
  color: #f74f4f;
}
.sums .in b,
.income b {
  color: #18a356;
}
.struct .card-title {
  margin-bottom: 16px;
}
.income,
.line,
.record {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
  font-size: 14px;
}
.line {
  display: block;
}
.members {
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.members button {
  padding: 6px 10px;
}
.chart {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}
.donut {
  width: 168px;
  height: 168px;
  transform: rotate(-90deg);
}
.donut circle {
  cursor: pointer;
}
.legend {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px 8px;
  margin-bottom: 8px;
}
.legend button,
.row {
  width: 100%;
  border: 0;
  background: transparent;
  display: flex;
  align-items: center;
  gap: 6px;
  text-align: left;
  padding: 0;
  color: #222;
  min-width: 0;
}
.row {
  gap: 8px;
  padding: 8px 0;
}
.legend button {
  align-items: flex-start;
  font-size: 12px;
}
.legend-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}
.legend i,
.row > i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}
.legend i {
  margin-top: 3px;
}
.legend b {
  font-size: 12px;
  font-weight: 400;
  color: #888;
}
.row-main {
  flex: 1;
  min-width: 0;
}
.row-top {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  align-items: baseline;
}
.pct,
.count,
.meta,
.muted,
.error,
.loading {
  color: #888;
  font-size: 12px;
}
.row b {
  margin-left: auto;
  font-size: 14px;
}
.bar {
  height: 6px;
  margin-top: 6px;
  background: #f0f2f5;
  border-radius: 99px;
  overflow: hidden;
}
.bar span {
  display: block;
  height: 100%;
}
.chev {
  color: #bbb;
  font-size: 18px;
}
.error,
.loading,
.muted {
  margin: 8px 12px;
}
.sheet {
  padding: 12px 12px 24px;
  max-height: 70vh;
  overflow: auto;
}
.records-sheet {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
}
.records-sheet .sheet-bar {
  position: relative;
  flex: none;
  margin: 0;
  padding: 14px 12px 10px;
  background: #fff;
}
.sheet-body {
  overflow: auto;
  min-height: 0;
  max-height: calc(70vh - 52px);
  padding: 0 12px 16px;
}
.sheet-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  font-weight: 600;
}
.records-sheet .sheet-bar div {
  position: absolute;
  left: 64px;
  right: 64px;
  text-align: center;
  pointer-events: none;
}
.records-sheet .sheet-bar button {
  position: relative;
  z-index: 1;
}
.sheet-bar button {
  border: 0;
  background: transparent;
  color: #4285f4;
}
.months,
.years {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.years {
  padding: 12px 12px 24px;
  max-height: 70vh;
  overflow: auto;
}
.record {
  display: block;
  padding: 10px 0;
  border-top: 1px solid #f2f3f5;
}
.record-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.record-top b {
  margin: 0;
  flex: none;
  text-align: right;
}
</style>
