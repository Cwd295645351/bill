<template>
  <section v-show="active" class="overview">
    <div class="top">
      <aside class="summary">
        <h2>家庭资产</h2>
        <div class="metric">
          <div class="label">净资产</div>
          <div class="num up">{{ formatMoney(familyAsset.netAmount) }}</div>
        </div>
        <div class="metric">
          <div class="label">总资产</div>
          <div class="num">{{ formatMoney(familyAsset.assetAmount) }}</div>
        </div>
        <div class="metric">
          <div class="label">总负债</div>
          <div class="num down">{{ formatMoney(familyAsset.debtAmount) }}</div>
        </div>
        <div class="actions">
          <button type="button" class="btn primary" @click="formDialog?.openCreate(memberId)">登记资产</button>
          <button type="button" class="btn" @click="emit('open-members')">成员</button>
          <button type="button" class="btn" @click="openRates">汇率</button>
        </div>
        <div class="fx-line">金额均为人民币，外币按 1 港币 = {{ formatMoney(summary.hkdRate) }} 元 · 1 美元 = {{ formatMoney(summary.usdRate) }} 元 折算{{ summary.ratesSaved ? '' : '。当前是尚未保存的初始值' }}</div>
      </aside>
      <div class="chart-card change-card">
        <div class="change-head">
          <span>总资产</span>
          <span class="change-num" :class="changeClass(shownAssetChange)">{{ changeText(shownAssetChange) }} 元</span>
          <span class="split">总负债</span>
          <span class="change-num" :class="changeClass(halfFen(shownDebtChange) ? 0 : shownDebtChange)">{{ debtChangeLabel }}</span>
        </div>
        <div class="change-sub">
          截至
          <el-date-picker
            class="compare-date"
            :model-value="asOf || undefined"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
            clearable
            style="width: 150px"
            @update:model-value="onAsOfInput"
          />
          <span v-if="!asOf">还没有上一次登记</span>
        </div>
        <div class="vchange">
          <div v-for="item in orderedChanges" :key="item.typeName" class="vchange-col" @click="focusGroup(item.typeName)">
            <div class="vchange-plot">
              <div class="vchange-label" :class="halfFen(item.change) ? 'muted' : changeClass(item.change)">{{ halfFen(item.change) ? '没有变化' : compactDelta(item.change) }}</div>
              <div class="vchange-bar" :style="{ height: barHeight(item.current) }">{{ shortAmount(item.current) }}</div>
            </div>
            <div class="vchange-name">{{ item.typeName }}</div>
          </div>
        </div>
      </div>
      <div class="pie-col">
        <div class="chart-card pie-card pie-link" @click="emit('switch-tab', 'four')">
          <h3>四笔钱</h3>
          <div class="legend">点击进入四笔钱。活钱、稳健、长期，不含保险，也不含负债</div>
          <div v-if="!fourChart.total" class="pie-empty">暂无</div>
          <div v-else ref="fourHost" class="pie-host"></div>
        </div>
        <div class="chart-card pie-card">
          <h3>资产类型</h3>
          <div class="legend">点击某一类，定位到下方表格并展开</div>
          <div v-if="!typePieTotal" class="pie-empty">暂无</div>
          <div v-else ref="typeHost" class="pie-host"></div>
        </div>
      </div>
    </div>

    <div class="groups">
      <div v-if="hasOverviewRows" class="sheet-head">
        <span>名称</span><span>占本组</span><span>当前金额</span><span>换算</span><span>较上次盘点</span><span></span>
      </div>
      <div v-for="group in orderedGroups" :id="'group-' + group.type" :key="group.type" class="group" :class="{ located: locatedType === group.type }">
        <div class="group-head" :data-fold="group.typeName" @click="toggleGroup(group.type)">
          <span><i class="caret">{{ openGroups[group.type] ? '▾' : '▸' }}</i>{{ group.typeName }}</span>
          <span>占{{ group.type === 'debt' ? '负债' : '资产' }} {{ percentText(group.percent) }}</span>
          <span>{{ formatMoney(group.amount) }}</span>
          <span>{{ shortAmount(group.amount) }}</span>
          <span :class="changeClass(group.change)">{{ changeText(group.change) }}</span>
          <span></span>
        </div>
        <template v-if="openGroups[group.type]">
          <template v-for="member in group.members" :key="member.memberId || member.memberName">
            <div class="member-head">
              <span>{{ member.memberName }}</span>
              <span>{{ percentText(member.percent) }}</span>
              <span>{{ formatMoney(member.amount) }}</span>
              <span>{{ shortAmount(member.amount) }}</span>
              <span :class="changeClass(member.change)">{{ changeText(member.change) }}</span>
              <span></span>
            </div>
            <div
              v-for="row in member.assets"
              :key="row.id"
              class="asset-row"
              :class="cycleClass(row)"
              :title="row.isDebt ? undefined : turnaroundLabel(row.turnaroundCycle)"
              @click="recordDialog?.open(row)"
            >
              <span>{{ row.name }}</span>
              <span>{{ percentText(row.percent) }}</span>
              <span>{{ formatMoney(row.latestAmount) }}<em v-if="rawNote(row.currency, row.rawAmount)" class="fx">{{ rawNote(row.currency, row.rawAmount) }}</em></span>
              <span>{{ shortAmount(row.latestAmount) }}</span>
              <span :class="changeClass(row.prevAmount == null ? null : row.change)">{{ row.prevAmount == null ? '—' : changeText(row.change) }}</span>
              <span class="row-actions">
                <button type="button" class="link" @click.stop="formDialog?.openEdit(row)">编辑</button>
                <button type="button" class="link danger" :disabled="deletingId === row.id" @click.stop="deleteAsset(row)">删除</button>
              </span>
            </div>
          </template>
        </template>
      </div>
    </div>

    <section class="ledger-card">
      <div class="ledger-head">
        <h3>年度收支对账</h3>
        <el-select v-model="ledgerYear" class="ledger-year" style="width: 110px">
          <el-option v-for="item in ledgerYears" :key="item" :label="`${item} 年`" :value="item" />
        </el-select>
        <span v-if="ledgerResult?.message" class="ledger-range">{{ ledgerResult.message }}</span>
        <span v-else class="ledger-range">统计至 {{ monthLabel(ledgerResult?.endMonth) }}</span>
      </div>
      <div v-if="ledgerResult?.quantityRules?.length" class="ledger-rules">
        <span
          v-for="rule in ledgerResult.quantityRules"
          :key="rule.id"
          class="rule-tag"
        >
          {{ rule.name }}：{{ rule.quantity }} {{ rule.unitName || '单位' }} × {{ formatMoney(rule.unitPrice) }} 元/{{ rule.unitName || '单位' }}
          <template v-if="rule.belongUserName">（归属 {{ rule.belongUserName }}）</template>
          <template v-else-if="rule.quantity > 0">（未指定归属人）</template>
        </span>
      </div>
      <div class="ledger-stats">
        <div>
          <div class="label">记账总收入</div>
          <div class="num up">{{ formatMoney(ledgerResult?.income) }}</div>
        </div>
        <div>
          <div class="label">记账总支出</div>
          <div class="num down">{{ formatMoney(ledgerResult?.expense) }}</div>
        </div>
        <div>
          <div class="label">收支结余</div>
          <div class="num" :class="changeClass(ledgerResult?.surplus)">{{ changeText(ledgerResult?.surplus) }}</div>
          <div class="sub">总收入 − 总支出</div>
        </div>
        <div>
          <div class="label">总资产变化</div>
          <div class="num" :class="changeClass(ledgerResult?.assetChange)">{{ changeText(ledgerResult?.assetChange) }}</div>
          <div class="sub">{{ ledgerAssetSub }}</div>
        </div>
        <div>
          <div class="label">差额 <span v-if="ledgerResult?.equal != null" class="ledger-tag" :class="ledgerResult.equal ? 'ok' : 'warn'">{{ ledgerResult.equal ? '相等' : '不相等' }}</span></div>
          <div class="num" :class="changeClass(ledgerResult?.diff)">{{ changeText(ledgerResult?.diff) }}</div>
          <div class="sub">总资产变化 − 收支结余</div>
        </div>
      </div>
      <div class="ledger-note">
        同期净资产变化 {{ changeText(ledgerResult?.netChange) }}。差额不为 0 时，常见原因是投资或房产估值涨跌、记账漏记或重复、资产没有及时盘点，以及还贷本金没有记成支出。
        <template v-if="!memberId">看全部时，每一笔收入和支出各记一次。</template>
        <template v-else-if="ledgerResult?.unmatched">没有找到与「{{ memberName }}」同名的记账成员，收入和支出按 0 计，也不参与公共支出拆分。</template>
        <template v-else>
          收入只计归属「{{ memberName }}」的收入。分摊按有效收入，与概览分账一致。
          <span v-for="(person, index) in ledgerResult?.effectiveIncome || []" :key="person.userId">{{ index ? '，' : '' }}{{ person.name }} {{ formatMoney(person.effectiveIncome) }}</span>。
          支出含只归属他的 {{ formatMoney(ledgerResult?.exclusive) }}，共同支出拆入 {{ formatMoney(ledgerResult?.sharedShare) }}，公共支出拆入 {{ formatMoney(ledgerResult?.publicShare) }}。
        </template>
      </div>
    </section>

    <AssetFormDialog ref="formDialog" :members="members" :reload="reload" />
    <AssetRecordDialog ref="recordDialog" :reload="reload" />

    <el-dialog v-model="rateVisible" title="汇率" width="420px">
      <p class="hint">1 单位外币折合多少人民币。改汇率不会改原币盘点。</p>
      <el-form label-position="top">
        <el-form-item label="港币"><el-input v-model="hkdInput" /></el-form-item>
        <el-form-item label="美元"><el-input v-model="usdInput" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="saveRates">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, ref, toRef, watch, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessageBox } from 'element-plus'
import { useBillStore } from '@/store'
import { delAsset, saveExchangeRate } from '../api'
import { changeClass, changeText, compactDelta, formatMoney, fourLabel, rawNote, shortAmount, turnaroundLabel, TURNAROUND_TYPES } from '../shared'
import { useOverview } from '../hooks/use-overview'
import { useOverviewPies } from '../hooks/use-overview-pies'
import { useLedger } from '../hooks/use-ledger'
import AssetFormDialog from './AssetFormDialog.vue'
import AssetRecordDialog from './AssetRecordDialog.vue'
import type { AssetGroup, AssetMember, AssetRow } from '../type'

const props = defineProps<{
  active: boolean
  memberId: string
  memberName: string
  members: AssetMember[]
}>()

const emit = defineEmits<{
  'open-members': []
  'switch-tab': [tab: string]
}>()

const typeOrder = ['流动资金', '投资理财', '固定资产', '应收款', '负债']
const turnaroundOrder = TURNAROUND_TYPES.map((item) => item.value)
const turnaroundClasses: Record<string, string> = {
  'T+0': 'cycle-t0',
  'T+1': 'cycle-t1',
  长期: 'cycle-longterm',
  不可提现: 'cycle-nonwithdrawable',
}
const fourPieColors: Record<string, string> = { 活钱: '#5b8ff9', 稳健: '#5ad8a6', 长期: '#f6bd16' }
const typePieColors: Record<string, string> = { 流动资金: '#5b8ff9', 投资理财: '#5ad8a6', 固定资产: '#f6bd16', 应收款: '#6dc8ec', 负债: '#f08bb4' }

const memberId = toRef(props, 'memberId')
const revision = inject<Ref<number>>('assetRevision', ref(0))
const { billId } = storeToRefs(useBillStore())
const { stats, summary, asOf, load: loadOverview, setAsOf } = useOverview(memberId)
const { fourHost, typeHost, paint: paintPies, resize: resizePies } = useOverviewPies()
const ledger = useLedger(memberId)
const ledgerYear = ledger.year
const ledgerYears = ledger.years
const ledgerResult = ledger.result
const openGroups = ref<Record<string, boolean>>({})
const locatedType = ref('')
const deletingId = ref('')
const formDialog = ref<InstanceType<typeof AssetFormDialog> | null>(null)
const recordDialog = ref<InstanceType<typeof AssetRecordDialog> | null>(null)

const familyAsset = computed(() => ({
  assetAmount: Number(summary.value.assetAmount) || 0,
  debtAmount: Number(summary.value.debtAmount) || 0,
  netAmount: Number(summary.value.netAmount) || 0,
  totalChange: Number(summary.value.totalChange) || 0,
  debtChange: Number(summary.value.debtChange) || 0,
}))
const halfFen = (value: number | null | undefined) => Math.abs(Number(value) || 0) < 0.005
const shownAssetChange = computed(() => (asOf.value ? familyAsset.value.totalChange : 0))
const shownDebtChange = computed(() => (asOf.value ? familyAsset.value.debtChange : 0))
const debtChangeLabel = computed(() => (halfFen(shownDebtChange.value) ? '没有变化' : `${changeText(shownDebtChange.value)} 元`))
const orderedChanges = computed(() => {
  const rows = summary.value.categoryChanges || []
  return typeOrder.map((name) => rows.find((item) => item.typeName === name) || { type: name, typeName: name, current: 0, prev: 0, change: 0 })
})
const changeMax = computed(() => Math.max(...orderedChanges.value.map((item) => Number(item.current) || 0), 1))
const barHeight = (current: number) => `${Math.max(16, Math.round(((Number(current) || 0) / changeMax.value) * 78))}%`
const typePieTotal = computed(() => orderedChanges.value.reduce((sum, item) => sum + (Number(item.current) || 0), 0))
const fourChart = computed(() => {
  const rows = [...(stats.value.assetGroups || []), ...(stats.value.debtGroups || [])].flatMap((group) => group.assets)
  const items = ['living', 'steady', 'longterm'].map((key) => ({
    key,
    name: fourLabel(key),
    amount: rows.filter((row) => !row.isDebt && row.fourMoneyType === key).reduce((sum, row) => sum + (Number(row.latestAmount) || 0), 0),
  }))
  return { items, total: items.reduce((sum, item) => sum + item.amount, 0) }
})
const hasOverviewRows = computed(() => [...(stats.value.assetGroups || []), ...(stats.value.debtGroups || [])].some((group) => group.assets.length > 0))
const cycleClass = (row: AssetRow) => (row.isDebt ? '' : turnaroundClasses[row.turnaroundCycle || 'T+0'] || turnaroundClasses['T+0'])
const orderedGroups = computed(() => {
  const rows = [...(stats.value.assetGroups || []), ...(stats.value.debtGroups || [])]
  return typeOrder
    .map((name) => rows.find((item) => item.typeName === name))
    .filter((item): item is AssetGroup => Boolean(item))
    .map((group) => {
      const base = group.type === 'debt' ? familyAsset.value.debtAmount : familyAsset.value.assetAmount
      const groupTotal = Number(group.amount) || 0
      const shareOfGroup = (amount: number) => (groupTotal > 0 ? amount / groupTotal : 0)
      const buckets = new Map<string, AssetRow[]>()
      group.assets.forEach((row) => {
        const key = row.memberId || row.memberName || '未命名'
        const list = buckets.get(key) || []
        list.push(row)
        buckets.set(key, list)
      })
      const members = [...buckets.values()]
        .map((assets) => {
          const amount = assets.reduce((sum, row) => sum + (Number(row.latestAmount) || 0), 0)
          const known = assets.filter((row) => row.prevAmount != null)
          const change = known.length ? known.reduce((sum, row) => sum + (Number(row.change) || 0), 0) : null
          return {
            memberId: assets[0]?.memberId || '',
            memberName: assets[0]?.memberName || '未命名',
            amount,
            change,
            percent: shareOfGroup(amount),
            assets: assets
              .map((row) => ({ ...row, percent: shareOfGroup(Number(row.latestAmount) || 0) }))
              .sort((left, right) => {
                const leftRank = Math.max(0, turnaroundOrder.indexOf(left.turnaroundCycle || 'T+0'))
                const rightRank = Math.max(0, turnaroundOrder.indexOf(right.turnaroundCycle || 'T+0'))
                return leftRank - rightRank
              }),
          }
        })
        .sort((left, right) => left.memberName.localeCompare(right.memberName, 'zh'))
      return { ...group, percent: base > 0 ? group.amount / base : 0, members }
    })
})
const percentText = (value: number) => `${((value || 0) * 100).toFixed(1)}%`
const monthLabel = (value?: string) => {
  if (!value) return ''
  const [yearText, monthText] = value.split('-')
  return `${yearText}年${Number(monthText)}月底`
}
const ledgerAssetSub = computed(() => {
  const data = ledgerResult.value
  if (!data || data.assetChange == null) return '缺少盘点数据'
  return `${monthLabel(data.endMonth)} ${formatMoney(data.closingAsset)} − ${monthLabel(data.openingMonth)} ${formatMoney(data.openingAsset)}`
})

const rateVisible = ref(false)
const hkdInput = ref('')
const usdInput = ref('')
const openRates = () => {
  hkdInput.value = String(summary.value.hkdRate || '')
  usdInput.value = String(summary.value.usdRate || '')
  rateVisible.value = true
}
const reload = async () => {
  await Promise.all([loadOverview(), ledger.load()])
  await paintOverviewCharts()
}
const deleteAsset = async (row: AssetRow) => {
  try {
    await ElMessageBox.confirm(
      '资产项目与历史记录将同时删除，无法恢复，确认要删除吗？',
      '确认删除',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  deletingId.value = row.id
  const [err, res] = await delAsset({ params: { id: row.id } })
  deletingId.value = ''
  if (err || !res || res.retCode !== 0) {
    ElMessage.error(res?.message || '删除失败')
    return
  }
  await reload()
}
const saveRates = async () => {
  const [err, res] = await saveExchangeRate({ data: { billId: billId.value, hkdRate: hkdInput.value, usdRate: usdInput.value } })
  if (err || !res || res.retCode !== 0) {
    ElMessage.error(res?.message || '汇率必须大于0')
    return
  }
  rateVisible.value = false
  await reload()
}
const onAsOfInput = (value: string | null | undefined) => setAsOf(value || '')
const toggleGroup = (type: string) => {
  openGroups.value = { ...openGroups.value, [type]: !openGroups.value[type] }
}
const focusGroup = async (typeName: string) => {
  const group = orderedGroups.value.find((item) => item.typeName === typeName)
  if (!group) return
  openGroups.value = { ...openGroups.value, [group.type]: true }
  locatedType.value = group.type
  await nextTick()
  document.getElementById(`group-${group.type}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
const paintOverviewCharts = async () => {
  await nextTick()
  paintPies(
    fourChart.value.items.map((item) => ({ name: item.name, amount: item.amount, color: fourPieColors[item.name] || '#5b8ff9' })),
    orderedChanges.value.map((item) => ({ name: item.typeName, amount: Number(item.current) || 0, color: typePieColors[item.typeName] || '#5b8ff9' })),
    () => emit('switch-tab', 'four'),
    (name) => focusGroup(name),
  )
  requestAnimationFrame(() => resizePies())
}

watch(memberId, () => {
  openGroups.value = {}
  locatedType.value = ''
})
watch([() => props.active, memberId, billId, revision], async () => {
  if (!props.active) return
  await nextTick()
  await reload()
}, { immediate: true })
</script>

<style scoped lang="scss">
@use './asset.scss' as *;

.overview {
  @include tone;

  .btn {
    @include asset-btn;
  }

  .top {
    display: flex;
    flex-wrap: nowrap;
    gap: 12px;
    align-items: stretch;
  }

  .summary {
    @include panel-card;
    width: 280px;
    flex: none;
    display: flex;
    flex-direction: column;
    padding: 16px 18px 18px;

    h2 {
      text-align: center;
      font-size: 22px;
      margin-bottom: 12px;
    }

    .metric {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 8px 0;
      border-top: 1px solid #eee;

      .label {
        font-size: 16px;
        color: #333;
      }

      .num {
        font-size: 26px;
        font-weight: bold;
        line-height: 1.3;
      }
    }

    .actions {
      display: flex;
      gap: 8px;
      margin-top: 14px;
      padding-top: 14px;
    }

    .fx-line {
      margin-top: 10px;
      font-size: 12px;
      color: #999;
      line-height: 1.5;
    }
  }

  .chart-card {
    @include panel-card;
    min-width: 0;
    padding: 14px 16px 10px;

    h3 {
      font-size: 16px;
      margin-bottom: 4px;
    }
  }

  .change-card {
    display: flex;
    flex-direction: column;
    flex: 1 1 500px;
    min-width: 220px;

    .change-head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      font-size: 16px;
      font-weight: 600;
      color: #333;

      .change-num {
        margin-left: 8px;
      }

      .split {
        margin-left: 22px;
      }
    }

    .change-sub {
      margin: 4px 0 8px;
      font-size: 12px;
      color: #999;

      .compare-date {
        width: 150px;
        margin-left: 6px;
      }
    }

    .vchange {
      display: flex;
      align-items: stretch;
      gap: 8px;
      flex: 1;
      min-height: 220px;
      margin-top: 8px;
    }

    .vchange-col {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
    }

    .vchange-plot {
      flex: 1;
      width: 100%;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      align-items: center;
      border-bottom: 1px solid #e5e5e5;
    }

    .vchange-label {
      min-height: 18px;
      margin-bottom: 4px;
      font-size: 16px;
      font-weight: 600;
      color: #555;
      white-space: nowrap;

      &.muted {
        font-weight: 400;
        color: #9b96a8;
      }
    }

    .vchange-bar {
      width: 78%;
      max-width: 92px;
      background: #d9d4ea;
      border-radius: 2px 2px 0 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #333;
      font-size: 12px;
      font-weight: 600;
    }

    .vchange-name {
      margin-top: 8px;
      font-size: 13px;
      color: #666;
    }
  }

  .pie-col {
    flex: 1.8 1 520px;
    min-width: 0;
    display: flex;
    flex-direction: row;
    align-items: stretch;
    gap: 12px;

    .chart-card {
      display: flex;
      flex-direction: column;
      flex: 1;
      width: auto;
    }

    .pie-link {
      cursor: pointer;
    }

    .legend {
      min-height: 18px;
      margin-bottom: 0;
      font-size: 12px;
      color: #888;
    }

    .pie-host {
      flex: 1;
      min-height: 200px;
    }

    .pie-empty {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      color: #999;
      font-size: 14px;
    }
  }

  .groups {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;

    .sheet-head,
    .group-head,
    .member-head,
    .asset-row {
      display: grid;
      grid-template-columns: 1.3fr 0.8fr 1.15fr 0.7fr 0.9fr 72px;
      gap: 8px;
      align-items: center;
      padding: 10px 16px;
    }

    .sheet-head {
      color: #888;
      font-size: 16px;
    }

    .group {
      @include panel-card;
      overflow: hidden;

      &.located {
        box-shadow: 0 0 0 2px #409eff;
      }
    }

    .group-head {
      background: #d6ebff;
      color: #143d6b;
      font-weight: bold;
      cursor: pointer;

      &:hover {
        filter: brightness(0.96);
      }

      &[data-fold='流动资金'] { background: #d6e4ff; }
      &[data-fold='投资理财'] { background: #d4f3e6; }
      &[data-fold='固定资产'] { background: #fff0c2; }
      &[data-fold='应收款'] { background: #d4f1fa; }
      &[data-fold='负债'] { background: #fde2e2; color: #a33b3b; }

      .caret {
        display: inline-block;
        width: 14px;
        margin-right: 2px;
        color: #888;
        font-style: normal;
      }
    }

    .member-head {
      background: #f8fbff;
      color: #1d4f91;
      font-weight: 600;
      border-top: 1px solid #f2f2f2;

      span:first-child {
        padding-left: 12px;
      }
    }

    .asset-row {
      border-top: 1px solid #f2f2f2;
      cursor: pointer;

      &.cycle-t0 {
        background: #e9f4fd;

        &:hover { filter: brightness(0.98); }
      }

      &.cycle-t1 {
        background: #e7f6ec;

        &:hover { filter: brightness(0.98); }
      }

      &.cycle-longterm {
        background: #fff5d8;

        &:hover { filter: brightness(0.98); }
      }

      &.cycle-nonwithdrawable {
        background: #f2edfb;

        &:hover { filter: brightness(0.98); }
      }

      span:first-child {
        padding-left: 28px;
      }

      .row-actions {
        display: flex;
        gap: 8px;
      }
    }

    .fx {
      display: block;
      font-style: normal;
      font-size: 12px;
      color: #999;
      font-weight: normal;
      line-height: 1.3;
    }

    .link {
      border: none;
      background: none;
      color: #409eff;
      cursor: pointer;
      padding: 0;
      font-size: 13px;

      &.danger {
        color: rgb(247, 79, 79);
      }

      &:disabled {
        color: #c0c4cc;
        cursor: not-allowed;
      }
    }
  }

  .ledger-card {
    @include panel-card;
    padding: 14px 18px 12px;
    margin-top: 12px;

    .ledger-head {
      display: flex;
      align-items: center;
      gap: 12px;

      h3 {
        font-size: 16px;
        margin: 0;
      }
    }

    .ledger-year { width: 110px; }
    .ledger-member { width: 148px; }
    .ledger-qty { width: 88px; }

    .ledger-range {
      font-size: 12px;
      color: #999;
    }

    .ledger-rules {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
      font-size: 13px;
      color: #666;

      .rule-tag {
        background: #f0f4ff;
        color: #409eff;
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 12px;
      }
    }

    .ledger-stats {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 12px;
      margin-top: 12px;

      > div {
        background: #fafafa;
        border-radius: 6px;
        padding: 10px 12px;
      }

      .label {
        font-size: 16px;
        color: #888;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .num {
        font-size: 20px;
        font-weight: bold;
        line-height: 1.4;
      }

      .sub {
        font-size: 12px;
        color: #999;
      }
    }

    .ledger-tag {
      font-size: 12px;
      padding: 0 6px;
      border-radius: 3px;
      line-height: 18px;

      &.ok { background: #e8f7ee; color: #18a356; }
      &.warn { background: #fdf0e6; color: #e6862e; }
    }

    .ledger-note {
      font-size: 12px;
      color: #999;
      margin-top: 10px;
      line-height: 1.6;
    }
  }

  .hint {
    font-size: 12px;
    color: #909399;
    margin-top: 4px;
  }
}
</style>
