<template>
  <section v-show="active" class="trend-panel">
    <div class="trend-card">
      <div class="trend-toolbar">
        <div class="trend-tools">
          <div class="seg">
            <span class="seg-label">粒度</span>
            <button type="button" :class="{ active: grain === 'month' }" @click="grain = 'month'">月份</button>
            <button type="button" :class="{ active: grain === 'year' }" @click="grain = 'year'">年份</button>
          </div>
          <div class="seg">
            <span class="seg-label">区间</span>
            <button type="button" :class="{ active: range === 'since' }" @click="range = 'since'">记账以来</button>
            <button type="button" :class="{ active: range === 'thisYear' }" @click="range = 'thisYear'">今年</button>
            <button type="button" :class="{ active: range === 'y1' }" @click="range = 'y1'">近1年</button>
            <button type="button" :class="{ active: range === 'y3' }" @click="range = 'y3'">近3年</button>
            <button type="button" :class="{ active: range === 'y5' }" @click="range = 'y5'">近5年</button>
            <button type="button" :class="{ active: range === 'custom' }" @click="range = 'custom'">自定义</button>
          </div>
        </div>
        <div class="seg">
          <span class="seg-label">口径</span>
          <button type="button" :class="{ active: metric === 'all' }" @click="metric = 'all'">全部</button>
          <button type="button" :class="{ active: metric === 'net' }" @click="metric = 'net'">净资产</button>
        </div>
      </div>
      <div v-show="range === 'custom'" class="trend-custom">
        <label>开始 <el-date-picker v-model="start" type="month" value-format="YYYY-MM" placeholder="开始月份" style="width: 160px" /></label>
        <label>结束 <el-date-picker v-model="end" type="month" value-format="YYYY-MM" placeholder="结束月份" style="width: 160px" /></label>
        <button type="button" class="btn primary" @click="render()">确定</button>
      </div>
      <p class="month-note">
        {{ metric === 'all' ? '流动资金、投资理财、固定资产和应收款从零轴向上堆叠。负债按负数画在零轴下方。' : '净资产 = 非负债合计 − 负债。' }}
        {{ grain === 'year' ? '图例中的变化是区间内首个有数的年份到最后一年。每个点取该年在区间内最后一次有数的月份。' : '图例中的变化是区间内首个有数的月份到最后一个月。' }}
        <span v-if="error" class="down">{{ error }}</span>
      </p>
      <div ref="host" class="trend"></div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { inject, nextTick, ref, toRef, watch, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import { useTrend } from '../hooks/use-trend'

const props = defineProps<{
  active: boolean
  memberId: string
}>()

const memberId = toRef(props, 'memberId')
const revision = inject<Ref<number>>('assetRevision', ref(0))
const { billId } = storeToRefs(useBillStore())
const { host, range, grain, metric, start, end, error, render, refresh } = useTrend(memberId)

watch([() => props.active, memberId, billId, revision], async () => {
  if (!props.active) return
  await nextTick()
  await refresh()
}, { immediate: true })
</script>

<style scoped lang="scss">
@use './asset.scss' as *;

.trend-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  @include tone;

  .trend-card {
    @include panel-card;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 16px;
  }

  .trend-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 14px;

    .seg {
      margin-bottom: 0;
    }
  }

  .trend-tools {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .seg {
    @include seg;
    margin-bottom: 0;

    .seg-label {
      font-size: 16px;
      color: #999;
    }
  }

  .trend-custom {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
    font-size: 13px;
    color: #666;

    label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
    }

    .btn {
      @include asset-btn;
    }
  }

  .month-note {
    margin-bottom: 16px;
    line-height: 1.8;
    font-size: 12px;
    color: #888;
  }

  .trend {
    flex: 1;
    min-height: 360px;
  }
}
</style>
