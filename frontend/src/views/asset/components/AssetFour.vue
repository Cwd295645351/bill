<template>
  <section v-show="active" class="four-panel">
    <div class="four-compare">
      <div>
        <h3>三类对比</h3>
        <div class="legend">只统计活钱、稳健、长期，已归入这三类的负债计入对应分类</div>
      </div>
      <div v-if="!compare.total" class="pie-empty">暂无</div>
      <div v-else class="pie-body">
        <div class="pie-disk" :style="{ background: compare.gradient }"></div>
        <div class="pie-legend">
          <span v-for="item in compare.slices" :key="item.key">
            <i :style="{ background: item.color }"></i>{{ item.name }} <b>{{ formatMoney(item.amount) }}</b> {{ item.percent }}%
          </span>
        </div>
      </div>
    </div>
    <div class="cards">
      <article v-for="key in order" :key="key" class="card">
        <h3>{{ summary[key]?.name || fourLabel(key) }}</h3>
        <div class="num">{{ formatMoney(summary[key]?.amount || 0) }}</div>
        <div class="meta">
          {{ summary[key]?.count || 0 }} 笔
          <template v-if="key === 'insurance'"> · 年交保费 {{ formatMoney(summary[key]?.totalPremium || 0) }} · 未填险种归入「其他」</template>
        </div>
        <ul>
          <li v-if="!(summary[key]?.assets || []).length"><span>暂无</span><span>0.00</span></li>
          <template v-for="member in grouped(key)" :key="member.key">
            <li class="member-line"><span>{{ member.name }}</span><span>{{ formatMoney(member.amount) }}</span></li>
            <li v-for="item in member.assets" :key="item.id" class="asset-line">
              <span>
                {{ item.name }}
                <template v-if="key === 'insurance'"> · {{ item.insuranceCategory || '其他' }}</template>
                <template v-if="item.isDebt"> · 负债</template>
              </span>
              <el-select class="four-pick" :model-value="key" size="small" @change="(value: string) => onMove(item, value)">
                <el-option v-for="option in fourTypes" :key="option.value" :label="option.label" :value="option.value" />
              </el-select>
              <span>
                {{ formatMoney(item.latestAmount) }}
                <em v-if="rawNote(item.currency, item.rawAmount)" class="fx">{{ rawNote(item.currency, item.rawAmount) }}</em>
              </span>
            </li>
          </template>
        </ul>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, ref, toRef, watch, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import { FOUR_TYPES, formatMoney, fourLabel, rawNote } from '../shared'
import { useFourMoney } from '../hooks/use-four-money'
import type { FourMoneyAsset } from '../type'

const props = defineProps<{
  active: boolean
  memberId: string
}>()

const memberId = toRef(props, 'memberId')
const revision = inject<Ref<number>>('assetRevision', ref(0))
const fourTypes = FOUR_TYPES
const { billId } = storeToRefs(useBillStore())
const { summary, order, load, move } = useFourMoney(memberId)

const compare = computed(() => {
  const slices = [
    { key: 'living', name: '活钱', color: '#5b8ff9' },
    { key: 'steady', name: '稳健', color: '#5ad8a6' },
    { key: 'longterm', name: '长期', color: '#f6bd16' },
  ].map((item) => ({ ...item, amount: Number(summary.value[item.key]?.amount) || 0 }))
  const total = slices.reduce((sum, item) => sum + item.amount, 0)
  let cursor = 0
  const gradient = slices
    .map((item) => {
      const start = cursor
      cursor += total > 0 ? (item.amount / total) * 100 : 0
      return `${item.color} ${start}% ${cursor}%`
    })
    .join(',')
  return {
    total,
    gradient: `conic-gradient(${gradient})`,
    slices: slices.map((item) => ({ ...item, percent: total > 0 ? ((item.amount / total) * 100).toFixed(1) : '0.0' })),
  }
})

const grouped = (key: string) => {
  const assets = summary.value[key]?.assets || []
  const buckets = new Map<string, { key: string; name: string; amount: number; assets: FourMoneyAsset[] }>()
  assets.forEach((item) => {
    const id = item.memberId || item.member?.name || '未命名'
    const bucket = buckets.get(id) || { key: id, name: item.member?.name || '未命名', amount: 0, assets: [] }
    bucket.amount += Number(item.latestAmount) || 0
    bucket.assets.push(item)
    buckets.set(id, bucket)
  })
  return [...buckets.values()].sort((left, right) => left.name.localeCompare(right.name, 'zh'))
}

const onMove = async (item: FourMoneyAsset, value: string) => {
  if (value === item.fourMoneyType) return
  await move(item, value)
}

watch([() => props.active, memberId, billId, revision], async () => {
  if (!props.active) return
  await nextTick()
  await load()
}, { immediate: true })
</script>

<style scoped lang="scss">
@use './asset.scss' as *;

.four-panel {
  .four-compare {
    @include panel-card;
    display: flex;
    align-items: center;
    gap: 32px;
    padding: 16px 24px;
    margin-bottom: 12px;

    h3 {
      font-size: 16px;
      margin-bottom: 4px;
    }

    .legend {
      font-size: 12px;
      color: #888;
    }

    .pie-empty {
      color: #999;
      font-size: 14px;
    }

    .pie-body {
      flex: 1;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-start;
      gap: 28px;
      min-height: 0;
    }

    .pie-disk {
      width: 148px;
      height: 148px;
      flex: none;
      border-radius: 50%;
    }

    .pie-legend {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
      font-size: 14px;
      color: #666;

      i {
        display: inline-block;
        width: 10px;
        height: 10px;
        margin-right: 4px;
      }

      b {
        color: #333;
        font-weight: 600;
      }
    }
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }

  .card {
    @include panel-card;
    padding: 16px;

    h3 {
      font-size: 16px;
      margin-bottom: 8px;
    }

    .num {
      font-size: 28px;
      font-weight: bold;
    }

    .meta {
      margin-top: 6px;
      color: #888;
      font-size: 13px;
    }

    ul {
      margin-top: 12px;
      list-style: none;
      padding: 0;
    }

    li {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-top: 1px dotted #e5e5e5;
      font-size: 14px;

      &.member-line,
      &.asset-line {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 112px 120px;
        align-items: center;
        column-gap: 8px;

        span:last-child {
          text-align: right;
        }
      }

      &.member-line {
        margin: 0 -16px;
        padding: 8px 16px;
        font-weight: 600;
        color: #1d4f91;
        background: #f8fbff;
        border-top: 1px solid #f2f2f2;

        span:last-child {
          grid-column: 3;
        }
      }

      &.asset-line span:first-child {
        padding-left: 12px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .four-pick {
      width: 100%;
    }

    .fx {
      display: block;
      font-style: normal;
      font-size: 12px;
      color: #999;
      font-weight: normal;
      line-height: 1.3;
    }
  }
}
</style>
