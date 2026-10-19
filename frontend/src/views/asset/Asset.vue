<template>
  <div class="asset-page">
    <div class="subbar">
      <div class="members">
        <button type="button" :class="{ active: !memberId }" @click="memberId = ''">全部</button>
        <button v-for="member in members" :key="member.id" type="button" :class="{ active: memberId === member.id }" @click="memberId = member.id">
          {{ member.name }}
        </button>
      </div>
      <div class="tabs">
        <button v-for="item in tabs" :key="item.id" type="button" :class="{ active: tab === item.id }" @click="tab = item.id">{{ item.label }}</button>
      </div>
    </div>

    <main class="page" :class="{ fill: tab === 'trend' }">
      <section v-show="tab === 'overview'" class="panel">
        <div class="top">
          <aside class="summary">
            <h2>家庭资产</h2>
            <div class="exclude">
              <span>排除固定资产</span>
              <el-switch v-model="excludeSteady" />
            </div>
            <div class="metric">
              <div class="label">净资产</div>
              <div class="num">{{ formatMoney(familyAsset.netAmount) }}</div>
            </div>
            <div class="metric">
              <div class="label">总资产</div>
              <div class="num">{{ formatMoney(familyAsset.assetAmount) }}</div>
              <div class="sub">{{ excludeSteady ? '不含负债，已排除固定资产' : '不含负债' }}</div>
            </div>
            <div class="metric">
              <div class="label">总负债</div>
              <div class="num down">{{ formatMoney(familyAsset.debtAmount) }}</div>
            </div>
            <div class="metric">
              <div class="label">总资产较上月末</div>
              <div class="num" :class="changeClass(familyAsset.totalChange)">{{ changeText(familyAsset.totalChange) }}</div>
              <div class="sub">对比日 {{ month.referenceDate || '—' }}，负债变化不计入</div>
            </div>
            <div class="actions">
              <button type="button" class="btn primary" @click="openCreate(memberId)">登记资产</button>
              <button type="button" class="btn" @click="openMembers">成员</button>
            </div>
          </aside>
          <div class="chart-card">
            <h3>相对上月末</h3>
            <div class="legend"><i class="now"></i>当前<i class="prev"></i>上月末 · 每类各自按最大值拉伸，数字为实际金额</div>
            <div v-for="item in orderedChanges" :key="item.type" class="bar-row">
              <div class="bar-label">
                <strong>{{ item.typeName }}</strong><br />
                {{ formatMoney(item.current) }} <span :class="changeClass(item.change)">{{ changeText(item.change) }}</span>
              </div>
              <div class="bars">
                <div class="bar now" :style="{ width: barWidth(item.current, item.current, item.prev) }"></div>
                <div class="bar prev" :style="{ width: barWidth(item.prev, item.current, item.prev) }"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="groups">
          <div class="sheet-head">
            <span>名称</span><span>成员</span><span>四笔钱</span><span>当前金额</span><span>上次金额</span><span>变化额</span><span>变化率</span><span>占本组</span><span></span>
          </div>
          <div v-for="group in orderedGroups" :key="group.type" class="group">
            <div class="group-head">
              <span>{{ group.typeName }}</span><span></span><span></span>
              <span>{{ formatMoney(group.amount) }}</span>
              <span></span>
              <span :class="changeClass(group.change)">{{ changeText(group.change) }}</span>
              <span :class="changeClass(group.changeRate)">{{ rateText(group.changeRate) }}</span>
              <span>占{{ group.type === 'debt' ? '负债' : '资产' }} {{ percentText(group.percent) }}</span>
              <span></span>
            </div>
            <template v-for="member in group.members" :key="member.memberId || member.memberName">
              <div class="member-head">
                <span>{{ member.memberName }}</span><span></span><span></span>
                <span>{{ formatMoney(member.amount) }}</span>
                <span></span>
                <span :class="changeClass(member.change)">{{ changeText(member.change) }}</span>
                <span></span>
                <span>{{ percentText(member.percent) }}</span>
                <span></span>
              </div>
              <div v-for="row in member.assets" :key="row.id" class="asset-row" @click="openRecords(row)">
                <span>{{ row.name }}</span>
                <span>{{ row.memberName }}</span>
                <span>{{ fourLabel(row.fourMoneyType) }}</span>
                <span>{{ formatMoney(row.latestAmount) }}</span>
                <span>{{ formatMoney(row.prevAmount) }}</span>
                <span :class="changeClass(row.changeRate == null ? null : row.change)">{{ row.changeRate == null ? '—' : changeText(row.change) }}</span>
                <span :class="changeClass(row.changeRate)">{{ rateText(row.changeRate) }}</span>
                <span>{{ percentText(row.percent) }}</span>
                <span class="row-actions"><button type="button" class="link" @click.stop="openEdit(row)">编辑</button></span>
              </div>
            </template>
          </div>
        </div>
      </section>

      <section v-show="tab === 'four'" class="panel">
        <div class="cards">
          <article v-for="key in fourOrder" :key="key" class="card">
            <h3>{{ fourSummary[key]?.name || fourLabel(key) }}</h3>
            <div class="num">{{ formatMoney(fourSummary[key]?.amount || 0) }}</div>
            <div class="meta">
              {{ fourSummary[key]?.count || 0 }} 笔
              <template v-if="key !== 'insurance'"> · 占 {{ percentText(fourPercents[key] || 0) }}</template>
              <template v-if="key === 'insurance'"> · 年交保费 {{ formatMoney(fourSummary[key]?.totalPremium || 0) }} · 未填险种归入「其他」</template>
            </div>
            <ul>
              <li v-if="!(fourSummary[key]?.assets || []).length"><span>暂无</span><span>0.00</span></li>
              <template v-for="member in fourMembers(key)" :key="member.key">
                <li class="member-line"><span>{{ member.name }}</span><span>{{ formatMoney(member.amount) }}</span></li>
                <li v-for="item in member.assets" :key="item.id" class="asset-line">
                  <span>
                    {{ item.name }}
                    <template v-if="key === 'insurance'"> · {{ item.insuranceCategory || '其他' }}</template>
                    <template v-if="item.isDebt"> · 负债</template>
                  </span>
                  <span>{{ formatMoney(item.latestAmount) }}</span>
                </li>
              </template>
            </ul>
          </article>
        </div>
      </section>

      <section v-show="tab === 'sankey'" class="panel">
        <div class="sankey-wrap">
          <div class="seg">
            <button type="button" :class="{ active: sankeyMode === 'amount' }" @click="sankeyMode = 'amount'">金额</button>
            <button type="button" :class="{ active: sankeyMode === 'ratio' }" @click="sankeyMode = 'ratio'">比例</button>
            <button type="button" :class="{ active: sankeyMode === 'hidden' }" @click="sankeyMode = 'hidden'">隐藏金额</button>
          </div>
          <div ref="sankeyHost" class="sankey"></div>
        </div>
      </section>

      <section v-show="tab === 'month'" class="panel">
        <div class="year-bar">
          <span>年份</span>
          <button v-for="item in years" :key="item" type="button" :class="{ active: year === item }" @click="year = item">{{ item }}</button>
        </div>
        <p class="month-note">
          {{ year }} 年。{{ year === currentYear ? '当年只统计到本月，高亮的是本月。' : '历史年统计到 12 月，高亮的是年末。' }}柱高按各图自己的最大值计算，数字是实际金额。总资产等于非负债之和，总净资产等于总资产减总负债。
        </p>
        <div class="month-grid">
          <article v-for="(row, index) in monthRows" :key="row.key" class="month-card" :class="{ wide: row.wide }">
            <header>
              <div>
                <h3>{{ row.key }}</h3>
                <div class="meta">较年初 <span :class="changeClass(monthReport[row.key]?.yearChange)">{{ changeText(monthReport[row.key]?.yearChange) }}</span> · 最后盘点 {{ monthReport[row.key]?.lastUpdate || '无' }}</div>
              </div>
              <div class="num">{{ formatMoney(monthReport[row.key]?.current) }}</div>
            </header>
            <div :ref="(el) => setMonthHost(el, index)" class="month-chart"></div>
          </article>
        </div>
      </section>

      <section v-show="tab === 'trend'" class="panel trend-panel">
        <div class="trend-card">
          <div class="trend-toolbar">
            <div class="seg">
              <button type="button" :class="{ active: trendRange === 'thisYear' }" @click="trendRange = 'thisYear'">今年</button>
              <button type="button" :class="{ active: trendRange === 'y1' }" @click="trendRange = 'y1'">近1年</button>
              <button type="button" :class="{ active: trendRange === 'y3' }" @click="trendRange = 'y3'">近3年</button>
              <button type="button" :class="{ active: trendRange === 'y5' }" @click="trendRange = 'y5'">近5年</button>
              <button type="button" :class="{ active: trendRange === 'custom' }" @click="trendRange = 'custom'">自定义</button>
            </div>
            <div class="seg">
              <button type="button" :class="{ active: trendMetric === 'all' }" @click="trendMetric = 'all'">全部</button>
              <button type="button" :class="{ active: trendMetric === 'net' }" @click="trendMetric = 'net'">净资产</button>
            </div>
          </div>
          <div v-show="trendRange === 'custom'" class="trend-custom">
            <label>开始 <el-date-picker v-model="trendStart" type="month" value-format="YYYY-MM" placeholder="开始月份" /></label>
            <label>结束 <el-date-picker v-model="trendEnd" type="month" value-format="YYYY-MM" placeholder="结束月份" /></label>
            <button type="button" class="btn primary" @click="trend.render()">确定</button>
          </div>
          <p class="month-note">
            {{ trendMetric === 'all' ? '流动资金、投资理财、固定资产和应收款从零轴向上堆叠。负债按负数画在零轴下方。' : '净资产 = 非负债合计 − 负债。' }}
            图例中的变化是区间内首个有数的月份到最后一个月。
            <span v-if="trendError" class="down">{{ trendError }}</span>
          </p>
          <div class="trend-legend">
            <span v-for="item in trendLegend" :key="item.name">
              <i :style="{ background: item.color }"></i>{{ item.name }}
              <template v-if="item.last == null"> 无</template>
              <template v-else> {{ formatMoney(item.last) }} <span :class="changeClass(item.change)">{{ changeText(item.change) }}</span></template>
            </span>
          </div>
          <div ref="trendHost" class="trend"></div>
        </div>
      </section>
    </main>

    <el-dialog v-model="memberVisible" title="资产成员" width="480px">
      <p class="hint">资产成员和记账成员分开。隐藏后，已有资产仍显示原来的名字，也仍计入家庭总额。</p>
      <div class="member-add">
        <el-input v-model="draftName" placeholder="没有登录账号的家人也可以添加" @keyup.enter="createMember" />
        <el-button type="primary" :loading="memberSaving" @click="createMember">添加</el-button>
      </div>
      <div v-for="member in members" :key="member.id" class="member-row">
        <el-input :model-value="member.name" @change="(value: string) => renameMember(member, value)" />
        <el-button @click="onHide(member)">隐藏</el-button>
      </div>
    </el-dialog>

    <el-dialog v-model="formVisible" :title="form.id ? '编辑资产' : '登记资产'" width="520px">
      <el-form label-position="top">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <div class="two">
          <el-form-item label="成员">
            <el-select v-model="form.memberId" style="width: 100%">
              <el-option v-for="member in members" :key="member.id" :label="member.name" :value="member.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="资产类型">
            <el-select v-model="form.type" style="width: 100%">
              <el-option v-for="item in assetTypes" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
            <p v-if="form.type === 'debt'" class="hint">类型为负债时计入负债，不计入总资产。</p>
          </el-form-item>
        </div>
        <div class="two" :class="{ single: form.type === 'debt' }">
          <el-form-item v-show="form.type !== 'debt'" label="四笔钱">
            <el-select v-model="form.fourMoneyType" style="width: 100%">
              <el-option v-for="item in fourTypes" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="当前金额"><el-input v-model="form.latestAmount" /></el-form-item>
        </div>
        <div v-show="form.type !== 'debt' && form.fourMoneyType === 'insurance'" class="two">
          <el-form-item label="险种"><el-input v-model="form.insuranceCategory" /></el-form-item>
          <el-form-item label="年交保费"><el-input v-model="form.annualPremium" /></el-form-item>
        </div>
        <p v-if="amountUnchanged" class="hint">金额未变化，保存后不会新增盘点。</p>
        <p class="hint">金额必须大于 0。清掉资产请删除，不要把金额改成 0。</p>
      </el-form>
      <template #footer>
        <el-button v-if="form.id" @click="removeAsset">删除</el-button>
        <el-button type="primary" :loading="formSaving" @click="saveAsset">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="recordVisible" :title="recordAsset ? recordAsset.name + ' 盘点' : '盘点'" width="640px">
      <div class="two">
        <el-form-item label="开始日期"><el-date-picker v-model="recordStart" type="date" value-format="x" placeholder="不限" style="width: 100%" /></el-form-item>
        <el-form-item label="结束日期"><el-date-picker v-model="recordEnd" type="date" value-format="x" placeholder="不限" style="width: 100%" /></el-form-item>
      </div>
      <div class="two">
        <el-form-item label="金额"><el-input v-model="recordAmount" /></el-form-item>
        <el-form-item label="日期"><el-date-picker v-model="recordDate" type="date" value-format="x" style="width: 100%" /></el-form-item>
      </div>
      <el-table :data="records" size="small">
        <el-table-column label="日期"><template #default="{ row }">{{ formatDay(row.date) }}</template></el-table-column>
        <el-table-column label="金额"><template #default="{ row }">{{ formatMoney(row.amount) }}</template></el-table-column>
        <el-table-column label="操作" width="140" align="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="beginEdit(row)">编辑</el-button>
            <el-button link type="danger" :disabled="records.length <= 1" @click="removeRecord(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <p class="hint">只剩一条盘点时不能删除。打开了修改却没保存就关闭，原来的金额和日期不变。</p>
      <template #footer>
        <el-button @click="loadRecords">按日期筛选</el-button>
        <el-button v-if="editingRecordId" @click="beginCreate">取消修改</el-button>
        <el-button type="primary" :loading="recordSaving" @click="saveRecord">{{ editingRecordId ? '保存这条记录' : '记一笔盘点' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import { ASSET_TYPES, FOUR_TYPES, changeClass, changeText, formatMoney, fourLabel } from './shared'
import { useMembers } from './hooks/use-members'
import { useAssetForm } from './hooks/use-asset-form'
import { useRecords } from './hooks/use-records'
import { useOverview } from './hooks/use-overview'
import { useMonthBars } from './hooks/use-month-bars'
import { useFourMoney } from './hooks/use-four-money'
import { useSankey } from './hooks/use-sankey'
import { useMonthChart } from './hooks/use-month-chart'
import { useTrend } from './hooks/use-trend'
import type { AssetGroup, AssetMember, AssetRow, CategoryChange, FourMoneyAsset } from './type'

const tabs = [
  { id: 'overview', label: '总览' },
  { id: 'four', label: '四笔钱' },
  { id: 'sankey', label: '构成' },
  { id: 'month', label: '月历' },
  { id: 'trend', label: '资产趋势' },
]
const typeOrder = ['流动资金', '固定资产', '投资理财', '应收款', '负债']

const tab = ref('overview')
const memberId = ref('')
const excludeSteady = ref(false)
const assetTypes = ASSET_TYPES
const fourTypes = FOUR_TYPES
const currentYear = dayjs().year()
const { billId } = storeToRefs(useBillStore())

const { members, visible: memberVisible, draftName, saving: memberSaving, open: openMembers, create: createMember, rename: renameMember, hide } = useMembers()
const { stats, load: loadStats } = useOverview(memberId)
const monthBars = useMonthBars(memberId)
const month = monthBars.summary
const { summary: fourSummary, order: fourOrder, load: loadFour } = useFourMoney(memberId)
const ratioKeys = ['living', 'steady', 'longterm']
const fourPercents = computed(() => {
  const amounts = ratioKeys.map((key) => Number(fourSummary.value[key]?.amount) || 0)
  const total = amounts.reduce((sum, value) => sum + value, 0)
  const result: Record<string, number> = { living: 0, steady: 0, longterm: 0 }
  if (total <= 0) return result
  const units = amounts.map((value) => (value / total) * 1000)
  const floors = units.map((value) => Math.floor(value))
  let remain = 1000 - floors.reduce((sum, value) => sum + value, 0)
  units
    .map((value, index) => ({ index, frac: value - floors[index] }))
    .sort((left, right) => right.frac - left.frac || left.index - right.index)
    .forEach((item) => {
      if (remain <= 0) return
      floors[item.index] += 1
      remain -= 1
    })
  ratioKeys.forEach((key, index) => {
    result[key] = floors[index] / 1000
  })
  return result
})
const fourMembers = (key: string) => {
  const assets = fourSummary.value[key]?.assets || []
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
const { host: sankeyHost, mode: sankeyMode, load: loadSankey } = useSankey(memberId, members)
const { year, years, rows: monthRows, report: monthReport, setHost: setMonthHost, load: loadMonth } = useMonthChart(memberId)
const trend = useTrend(memberId)
const trendHost = trend.host
const trendRange = trend.range
const trendMetric = trend.metric
const trendStart = trend.start
const trendEnd = trend.end
const trendError = trend.error
const trendLegend = trend.legend

const isSteady = (type?: string, typeName?: string) => type === 'steady' || typeName === '固定资产'

const familyAsset = computed(() => {
  const assetAmount = Number(stats.value.assetAmount) || 0
  const debtAmount = Number(stats.value.debtAmount) || 0
  const steady = (stats.value.assetGroups || []).find((group) => isSteady(group.type, group.typeName))
  const steadyMonth = (month.value.categoryChanges || []).find((item) => isSteady(item.type, item.typeName))
  const dropped = excludeSteady.value ? Number(steady?.amount) || 0 : 0
  const nextAsset = assetAmount - dropped
  const droppedChange = excludeSteady.value ? Number(steadyMonth?.change) || 0 : 0
  return {
    assetAmount: nextAsset,
    debtAmount,
    netAmount: nextAsset - debtAmount,
    totalChange: (Number(month.value.totalChange) || 0) - droppedChange,
  }
})
const orderedChanges = computed(() => {
  const rows = (month.value.categoryChanges || []).filter((item) => !(excludeSteady.value && isSteady(item.type, item.typeName)))
  return typeOrder.map((name) => rows.find((item) => item.typeName === name)).filter((item): item is CategoryChange => Boolean(item))
})
const orderedGroups = computed(() => {
  const rows = [...(stats.value.assetGroups || []), ...(stats.value.debtGroups || [])].filter((group) => !(excludeSteady.value && isSteady(group.type, group.typeName)))
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
          const known = assets.filter((row) => row.changeRate != null)
          const change = known.length ? known.reduce((sum, row) => sum + (Number(row.change) || 0), 0) : null
          return {
            memberId: assets[0]?.memberId || '',
            memberName: assets[0]?.memberName || '未命名',
            amount,
            change,
            percent: shareOfGroup(amount),
            assets: assets.map((row) => ({
              ...row,
              percent: shareOfGroup(Number(row.latestAmount) || 0),
            })),
          }
        })
        .sort((left, right) => left.memberName.localeCompare(right.memberName, 'zh'))
      return { ...group, percent: base > 0 ? group.amount / base : 0, members }
    })
})
const percentText = (value: number) => `${((value || 0) * 100).toFixed(1)}%`
const rateText = (value: number | null | undefined) => {
  if (value == null) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${(value * 100).toFixed(1)}%`
}
const barWidth = (value: number, current: number, prev: number) => {
  const max = Math.max(current, prev, 1)
  return `${(Math.max(value, 0) / max) * 100}%`
}
const reload = async () => {
  await refreshTab()
}

const { visible: formVisible, saving: formSaving, form, amountUnchanged, openCreate, openEdit, save: saveAsset, remove: removeAsset } = useAssetForm(reload)
const recordsApi = useRecords(reload)
const recordVisible = recordsApi.visible
const recordAsset = recordsApi.asset
const records = recordsApi.records
const editingRecordId = recordsApi.editingId
const recordAmount = recordsApi.amount
const recordDate = recordsApi.date
const recordSaving = recordsApi.saving
const recordStart = recordsApi.startDate
const recordEnd = recordsApi.endDate
const loadRecords = recordsApi.load
const openRecords = recordsApi.open
const beginEdit = recordsApi.beginEdit
const beginCreate = recordsApi.beginCreate
const saveRecord = recordsApi.save
const removeRecord = recordsApi.remove
const formatDay = recordsApi.formatDay

const onHide = async (member: AssetMember) => {
  await hide(member)
  if (memberId.value === member.id) memberId.value = ''
}

const refreshTab = async () => {
  await nextTick()
  if (tab.value === 'overview') {
    await Promise.all([loadStats(), monthBars.load()])
    return
  }
  if (tab.value === 'four') {
    await loadFour()
    return
  }
  if (tab.value === 'sankey') {
    await loadSankey()
    return
  }
  if (tab.value === 'month') {
    await loadMonth()
    return
  }
  await trend.refresh()
}

watch([tab, memberId, billId], refreshTab, { immediate: true })
</script>

<style scoped lang="scss">
.asset-page {
  height: calc(100vh - 60px);
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #fafafa;
  color: #333;
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
}
.subbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 48px;
  background: #fff;
  border-bottom: 1px solid #eee;
}
.members,
.tabs,
.seg,
.year-bar,
.actions,
.trend-toolbar,
.trend-custom,
.member-add,
.member-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.members button,
.tabs button,
.btn,
.year-bar button,
.seg button {
  height: 32px;
  padding: 0 14px;
  border: 1px solid #dcdfe6;
  background: #fff;
  border-radius: 4px;
  cursor: pointer;
  color: #333;
  font-size: 14px;
}
.members button.active,
.year-bar button.active,
.seg button.active {
  background: rgb(111, 197, 255);
  border-color: rgb(111, 197, 255);
  color: #fff;
}
.tabs button {
  border: none;
  border-radius: 0;
  height: 48px;
  background: transparent;
}
.tabs button.active {
  color: rgb(111, 197, 255);
  box-shadow: inset 0 -3px 0 rgb(111, 197, 255);
}
.page {
  flex: 1;
  min-height: 0;
  padding: 16px 20px 28px;
  overflow: auto;
}
.page.fill {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.trend-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.top {
  display: flex;
  gap: 12px;
  align-items: stretch;
}
.summary {
  width: 280px;
  flex: none;
  background: #fff;
  border-radius: 8px;
  box-shadow: 1px 1px 5px #ddd;
  padding: 16px 18px 18px;
}
.summary h2 {
  text-align: center;
  font-size: 22px;
  margin-bottom: 8px;
}
.exclude {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
  color: #666;
}
.metric {
  padding: 8px 0;
  border-top: 1px solid #eee;
}
.metric .label,
.card .meta,
.month-card .meta,
.legend,
.month-note {
  font-size: 12px;
  color: #888;
}
.metric .num,
.card .num {
  font-size: 26px;
  font-weight: bold;
  line-height: 1.3;
}
.metric .sub {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}
.actions {
  margin-top: 14px;
}
.btn.primary {
  background: #409eff;
  border-color: #409eff;
  color: #fff;
}
.chart-card,
.group,
.card,
.sankey-wrap,
.month-card,
.trend-card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 1px 1px 5px #ddd;
}
.chart-card {
  flex: 1;
  min-width: 0;
  padding: 14px 16px 10px;
}
.chart-card h3,
.card h3,
.month-card h3 {
  font-size: 16px;
  margin-bottom: 4px;
}
.legend {
  margin-bottom: 8px;
}
.legend i,
.trend-legend i {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin: 0 4px 0 12px;
  vertical-align: -1px;
}
.legend i.now {
  background: #409eff;
}
.legend i.prev {
  background: #c6e2ff;
}
.bar-row {
  display: grid;
  grid-template-columns: 168px 1fr;
  gap: 8px;
  align-items: center;
  margin: 8px 0;
  font-size: 13px;
}
.bars {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.bar {
  height: 10px;
  border-radius: 2px;
}
.bar.now {
  background: #409eff;
}
.bar.prev {
  background: #c6e2ff;
}
.groups {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sheet-head,
.group-head,
.member-head,
.asset-row {
  display: grid;
  grid-template-columns: 1.3fr 0.6fr 0.55fr 0.9fr 0.9fr 0.8fr 0.65fr 0.8fr 72px;
  gap: 8px;
  align-items: center;
  padding: 10px 16px;
}
.sheet-head {
  color: #888;
  font-size: 12px;
}
.group {
  overflow: hidden;
}
.group-head {
  background: #f7f7f7;
  font-weight: bold;
}
.member-head {
  background: #f8fbff;
  color: #1d4f91;
  font-weight: 600;
  border-top: 1px solid #f2f2f2;
}
.member-head span:first-child {
  padding-left: 12px;
}
.asset-row span:first-child {
  padding-left: 28px;
}
.asset-row {
  border-top: 1px solid #f2f2f2;
  cursor: pointer;
}
.asset-row:hover {
  background: #f8fbff;
}
.link {
  border: none;
  background: none;
  color: #409eff;
  cursor: pointer;
  padding: 0;
  font-size: 13px;
}
.cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.card {
  padding: 16px;
}
.card .num {
  font-size: 28px;
}
.card .meta {
  margin-top: 6px;
  font-size: 13px;
}
.card ul {
  margin-top: 12px;
  list-style: none;
  padding: 0;
}
.card li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 0;
  border-top: 1px dotted #e5e5e5;
  font-size: 14px;
}
.card li.member-line {
  margin: 0 -16px;
  padding: 8px 16px;
  font-weight: 600;
  color: #1d4f91;
  background: #f8fbff;
}
.card li.asset-line span:first-child {
  padding-left: 12px;
}
.two.single {
  grid-template-columns: 1fr;
}
.sankey-wrap {
  padding: 16px;
}
.sankey {
  height: 480px;
}
.trend {
  flex: 1;
  min-height: 0;
}
.month-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.month-card {
  padding: 14px 16px 12px;
}
.month-card.wide {
  grid-column: 1 / -1;
}
.month-card header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}
.month-card .num {
  font-size: 22px;
  font-weight: bold;
  white-space: nowrap;
}
.month-chart {
  height: 180px;
}
.year-bar,
.seg {
  margin-bottom: 8px;
}
.year-bar span {
  font-size: 13px;
  color: #666;
}
.trend-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 16px;
}
.trend-toolbar {
  justify-content: space-between;
  flex-wrap: wrap;
}
.trend-custom {
  margin-bottom: 8px;
  font-size: 13px;
  color: #666;
}
.trend-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin: 4px 0 8px;
  font-size: 13px;
  color: #666;
}
.trend-legend i {
  width: 12px;
  height: 12px;
  margin-right: 6px;
  border-radius: 2px;
}
.month-note {
  margin-bottom: 10px;
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
.up {
  color: #18a356;
}
.down {
  color: rgb(247, 79, 79);
}
.flat {
  color: #666;
}
.member-row,
.member-add {
  margin-top: 8px;
}
</style>
