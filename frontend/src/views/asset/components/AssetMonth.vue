<template>
  <section v-show="active" class="month-panel">
    <div class="year-bar">
      <span>年份</span>
      <button v-for="item in years" :key="item" type="button" :class="{ active: year === item }" @click="year = item">{{ item }}</button>
    </div>
    <p class="month-note">
      {{ year }} 年。{{ year === currentYear ? '当年只统计到本月，高亮的是本月。' : '历史年统计到 12 月，高亮的是年末。' }}柱高按各图自己的最大值计算，数字是实际金额。总资产等于非负债之和，总净资产等于总资产减总负债。
    </p>
    <div class="month-grid">
      <article v-for="(row, index) in rows" :key="row.key" class="month-card" :class="{ wide: row.wide }">
        <header>
          <div>
            <h3>{{ row.key }}</h3>
            <div class="meta">较年初 <span :class="changeClass(report[row.key]?.yearChange)">{{ changeText(report[row.key]?.yearChange) }}</span> · 最后盘点 {{ report[row.key]?.lastUpdate || '无' }}</div>
          </div>
          <div class="num">{{ formatMoney(report[row.key]?.current) }}</div>
        </header>
        <div :ref="(el) => setHost(el, index)" class="month-chart"></div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { inject, nextTick, ref, toRef, watch, type Ref } from 'vue'
import dayjs from 'dayjs'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import { changeClass, changeText, formatMoney } from '../shared'
import { useMonthChart } from '../hooks/use-month-chart'

const props = defineProps<{
  active: boolean
  memberId: string
}>()

const memberId = toRef(props, 'memberId')
const revision = inject<Ref<number>>('assetRevision', ref(0))
const currentYear = dayjs().year()
const { billId } = storeToRefs(useBillStore())
const { year, years, rows, report, setHost, load } = useMonthChart(memberId)

watch([() => props.active, memberId, billId, revision], async () => {
  if (!props.active) return
  await nextTick()
  await load()
}, { immediate: true })
</script>

<style scoped lang="scss">
@use './asset.scss' as *;

.month-panel {
  @include tone;

  .year-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;

    span {
      font-size: 16px;
      color: #666;
    }

    button {
      @include asset-btn;
    }
  }

  .month-note {
    margin-bottom: 10px;
    font-size: 12px;
    color: #888;
  }

  .month-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .month-card {
    @include panel-card;
    padding: 14px 16px 12px;

    &.wide {
      grid-column: 1 / -1;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 12px;
    }

    h3 {
      font-size: 16px;
    }

    .meta {
      margin-top: 4px;
      font-size: 16px;
      color: #888;
      line-height: 1.4;
    }

    .num {
      font-size: 22px;
      font-weight: bold;
      white-space: nowrap;
    }

    .month-chart {
      height: 180px;
    }
  }
}
</style>
