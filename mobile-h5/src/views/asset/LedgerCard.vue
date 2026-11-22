<template>
  <section class="a-card a-ledger">
    <div class="a-top">
      <span class="a-title">年度收支对账</span>
      <button type="button" class="a-year" @click="open = true">{{ year }} 年</button>
    </div>
    <p v-if="error" class="a-note">{{ error }}</p>
    <template v-else-if="result">
      <div class="a-note">{{ rangeText }}。今年统计到本月，已结束的年份统计到 12 月。没有按月明细。</div>
      <div class="a-stats">
        <div class="a-stat"><div class="k">记账总收入</div><div class="n income">{{ money(result.income) }}</div></div>
        <div class="a-stat"><div class="k">记账总支出</div><div class="n cost">{{ money(result.expense) }}</div></div>
        <div class="a-stat"><div class="k">收支结余</div><div class="n" :class="changeClass(result.surplus)">{{ deltaText(result.surplus, hidden) }}</div><div class="sub">总收入 − 总支出</div></div>
        <div class="a-stat"><div class="k">总资产变化</div><div class="n" :class="changeClass(result.assetChange)">{{ result.assetChange == null ? '—' : deltaText(result.assetChange, hidden) }}</div><div class="sub">{{ assetSub }}</div></div>
        <div class="a-stat wide">
          <div class="k">差额 <span v-if="result.diff != null && !hidden" class="tag" :class="result.equal ? 'ok' : 'warn'">{{ result.equal ? '相等' : '不相等' }}</span></div>
          <div class="n" :class="changeClass(result.diff)">{{ result.diff == null ? '—' : deltaText(result.diff, hidden) }}</div>
          <div class="sub">总资产变化 − 收支结余</div>
        </div>
      </div>
      <div class="a-note">同期净资产变化 {{ result.netChange == null ? '—' : deltaText(result.netChange, hidden) }}。差额不为 0 时，常见原因是投资或房产估值涨跌、记账漏记或重复、资产没有及时盘点，以及还贷本金没有记成支出。这里的总资产含固定资产，不受「移除固定资产」影响。{{ belong }}</div>
      <div v-if="memberId && !result.unmatched" class="a-note">只归属他 {{ money(result.exclusive) }}，共同支出拆分 {{ money(result.sharedShare) }}，公共支出拆分 {{ money(result.publicShare) }}。各人有效收入：{{ incomes }}</div>
      <div v-if="result.quantityRules.length" class="a-note">数量规则：{{ rules }}</div>
    </template>
    <van-popup v-model:show="open" position="bottom" round>
      <div class="sheet-bar"><button type="button" class="cancel" @click="open = false">取消</button><div class="sheet-title">选择年份</div><span></span></div>
      <div class="sheet-list">
        <button v-for="item in years" :key="item" type="button" class="sheet-item" :class="{ on: item === year }" @click="choose(item)">{{ item }} 年</button>
      </div>
    </van-popup>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { assetApi, type LedgerResult } from '@/api/asset'
import { useAssetViewStore } from '@/stores/asset-view'
import { changeClass, deltaText, moneyText } from '@/utils/asset-format'

const props = defineProps<{ billId: string; memberId: string; hidden: boolean }>()
const view = useAssetViewStore()
const result = ref<LedgerResult | null>(null)
const years = ref<number[]>([])
const error = ref('')
const open = ref(false)
const year = computed(() => view.ledgerYear || new Date().getFullYear())

const incomes = computed(() => (result.value?.effectiveIncome || []).map((item) => `${item.name} ${moneyText(item.effectiveIncome, props.hidden)}`).join('、') || '无')
const rules = computed(() => (result.value?.quantityRules || []).map((item) => `${item.name} ${item.quantity}${item.unitName}`).join('、'))
const rangeText = computed(() => {
  const data = result.value
  if (!data?.openingMonth || !data.endMonth) return '这一年没有记账'
  return `记账 ${data.openingMonth} 至 ${data.endMonth}`
})
const assetSub = computed(() => {
  const data = result.value
  if (!data || data.assetChange == null) return '缺少盘点数据'
  return `${data.endMonth} ${money(data.closingAsset)} − ${data.openingMonth} ${money(data.openingAsset)}`
})
const belong = computed(() => {
  if (!props.memberId) return '看全部时，每一笔收入和支出各记一次。'
  if (result.value?.unmatched) return result.value.message || '没有找到同名记账成员，收入和支出按 0 计。资产变化仍按当前这些资产计算。'
  return '收入只计归属这名成员的收入。支出含只归属他的金额；有共同支出和公共支出时，按有效收入拆给他，与概览分账一致。'
})

function money(value?: number | null) {
  return moneyText(value, props.hidden)
}
function choose(value: number) {
  view.ledgerYear = value
  open.value = false
}
async function load() {
  error.value = ''
  const res = await assetApi.ledger(props.billId, year.value, props.memberId || undefined)
  if (res.retCode !== 0) {
    error.value = res.message || '对账没有加载出来'
    return
  }
  result.value = res.data
  const listed = (res.data?.years || []).filter((item) => Number.isFinite(item))
  years.value = listed.length ? listed : [year.value]
  if (!years.value.includes(year.value)) view.ledgerYear = years.value[years.value.length - 1]
}
watch(() => [props.billId, props.memberId, year.value], load, { immediate: true })
</script>
