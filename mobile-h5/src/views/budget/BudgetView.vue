<template>
  <div class="page budget-page">
    <van-nav-bar title="预算" left-arrow fixed placeholder @click-left="goBack" />

    <div v-if="loadError" class="page-pad">
      <van-empty :description="loadError">
        <van-button size="small" type="primary" color="#4285F4" @click="load">重试</van-button>
      </van-empty>
    </div>

    <template v-else>
      <div class="budget-main">
        <div class="budget-head">
          <div class="a-hero">
            <div class="label">{{ year }} 年</div>
            <div class="split">
              <div>
                <div class="k">年度预算</div>
                <div class="v">{{ shortMoney(totalBudget) }}</div>
              </div>
              <div>
                <div class="k">年度支出</div>
                <div class="v">{{ shortMoney(totalCost) }}</div>
              </div>
            </div>
            <div class="a-fx">点卡片空白处，打开当年该类型的记账。进度条最多到 100%，超支后花费数字仍会更大。</div>
          </div>

          <div v-if="details.length" class="a-card">
            <h3>预算占比</h3>
            <BudgetPieChart :slices="pieSlices" />
          </div>
        </div>

        <div class="budget-list">
          <van-empty v-if="!loading && !details.length" description="今年还没有预算" />

          <div
            v-for="item in cards"
            :key="item.id"
            class="b-card"
            @click="onCardClick(item)"
          >
            <div class="a-top">
              <span class="type">{{ item.costTypeName }}</span>
              <span class="a-note">{{ item.tone.label }}</span>
            </div>
            <div class="b-meta">
              <span>预算 {{ formatMoney(item.budget) }}</span>
              <span>
                花费
                <span :class="{ cost: item.tone.rate >= 1 }">{{ formatMoney(item.cost) }}</span>
              </span>
            </div>
            <div class="b-line">
              <i :style="{ width: item.tone.widthPercent + '%', background: item.tone.color }" />
            </div>
            <div class="b-ops" @click.stop>
              <button type="button" class="edit" @click="openEdit(item)">编辑</button>
              <button type="button" class="del" @click="openDelete(item)">删除</button>
            </div>
          </div>
        </div>

        <div class="a-foot">
          <button type="button" class="primary" @click="openAdd">新增预算</button>
        </div>
      </div>
    </template>

    <BookTabBar :bill-id="billId" active="budget" />

    <!-- 新增 -->
    <van-popup v-model:show="showAdd" position="bottom" round>
      <div class="sheet">
        <div class="sheet-bar">
          <button type="button" class="cancel" @click="showAdd = false">取消</button>
          <div class="sheet-title">新增预算</div>
          <button type="button" class="confirm" :disabled="saving" @click="saveAdd">保存</button>
        </div>
        <van-cell-group>
          <van-field
            :model-value="addTypeName || '请选择'"
            is-link
            readonly
            label="支出类型"
            @click="showTypePicker = true"
          />
          <van-field
            v-model="addMoney"
            type="number"
            label="金额"
            placeholder="须大于 0"
            clearable
          />
        </van-cell-group>
        <div class="hint">金额须大于 0；同一类型一年只设一条；删除不影响已有记账。</div>
      </div>
    </van-popup>

    <van-popup v-model:show="showTypePicker" position="bottom" round>
      <van-picker
        title="支出类型"
        :columns="typeColumns"
        @confirm="onPickType"
        @cancel="showTypePicker = false"
      />
    </van-popup>

    <!-- 编辑 -->
    <van-popup v-model:show="showEdit" position="bottom" round>
      <div class="sheet">
        <div class="sheet-bar">
          <button type="button" class="cancel" @click="showEdit = false">取消</button>
          <div class="sheet-title">编辑预算</div>
          <button type="button" class="confirm" :disabled="saving" @click="saveEdit">保存</button>
        </div>
        <van-cell-group>
          <van-field :model-value="editTypeName" readonly label="支出类型" />
          <van-field
            v-model="editMoney"
            type="number"
            label="金额"
            placeholder="须大于 0"
            clearable
          />
        </van-cell-group>
      </div>
    </van-popup>

    <van-dialog
      v-model:show="showDel"
      title="确定删除该预算？"
      show-cancel-button
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { getBillDetail } from '@/api/bill'
import {
  budgetAdd,
  budgetDelete,
  budgetEdit,
  getBudgetList,
  type BudgetDetail,
} from '@/api/budget'
import BookTabBar from '@/components/BookTabBar.vue'
import BudgetPieChart from '@/components/charts/BudgetPieChart.vue'
import { budgetTone } from '@/utils/budget-tone'

const route = useRoute()
const router = useRouter()

const billId = ref(String(route.params.id || ''))
const year = new Date().getFullYear()
const loading = ref(false)
const loadError = ref('')
const totalBudget = ref(0)
const totalCost = ref(0)
const details = ref<BudgetDetail[]>([])
const costTypes = ref<{ id: string; name: string; hidden?: boolean }[]>([])

const showAdd = ref(false)
const showEdit = ref(false)
const showDel = ref(false)
const showTypePicker = ref(false)
const saving = ref(false)
const addTypeId = ref('')
const addTypeName = ref('')
const addMoney = ref('')
const editId = ref('')
const editTypeName = ref('')
const editMoney = ref('')
const pendingDelId = ref('')

const cards = computed(() =>
  details.value.map((item) => ({
    ...item,
    tone: budgetTone(item.cost, item.budget),
  })),
)

const pieSlices = computed(() =>
  details.value.map((d) => ({ name: d.costTypeName, value: Number(d.budget) || 0 })),
)

const typeColumns = computed(() => {
  const used = new Set(details.value.map((d) => d.costTypeId))
  return costTypes.value
    .filter((t) => !t.hidden && !used.has(t.id))
    .map((t) => ({ text: t.name, value: t.id }))
})

function formatMoney(n: number) {
  return Math.abs(Number(n) || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** 顶部汇总：过万缩写为「万」，对齐原型 aShort */
function shortMoney(n: number) {
  const abs = Math.abs(Number(n) || 0)
  if (abs < 10000) return formatMoney(abs)
  const wan = Math.round(abs / 100) / 100
  return (Math.abs(wan - Math.round(wan)) < 0.001 ? String(Math.round(wan)) : wan.toFixed(2)) + '万'
}

function yearRange() {
  return {
    beginDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  }
}

function goBack() {
  router.back()
}

async function loadTypes() {
  const res = await getBillDetail(billId.value)
  if (res.retCode === 0 && res.data) {
    costTypes.value = res.data.costTypes || []
  }
}

async function load() {
  if (!billId.value) {
    loadError.value = '缺少账本'
    return
  }
  loading.value = true
  loadError.value = ''
  try {
    const res = await getBudgetList(billId.value, year)
    if (res.retCode !== 0) {
      loadError.value = res.message || '加载失败'
      return
    }
    const data = res.data || { totalBudget: 0, currCost: 0, details: [] }
    totalBudget.value = Number(data.totalBudget || 0)
    totalCost.value = Number(data.currCost || 0)
    details.value = Array.isArray(data.details) ? data.details : []
  } catch {
    loadError.value = '网络异常'
  } finally {
    loading.value = false
  }
}

function onCardClick(item: BudgetDetail) {
  const { beginDate, endDate } = yearRange()
  router.push({
    name: 'record-search',
    query: {
      billId: billId.value,
      type: '1',
      costTypeId: item.costTypeId,
      beginDate,
      endDate,
      autoSearch: '1',
    },
  })
}

function openAdd() {
  addTypeId.value = ''
  addTypeName.value = ''
  addMoney.value = ''
  showAdd.value = true
  loadTypes()
}

function onPickType(payload: { selectedOptions: { text: string; value: string }[] }) {
  const opt = payload.selectedOptions?.[0]
  if (opt) {
    addTypeId.value = String(opt.value)
    addTypeName.value = opt.text
  }
  showTypePicker.value = false
}

async function saveAdd() {
  if (!addTypeId.value) {
    showToast('请选择支出类型')
    return
  }
  const money = Number(addMoney.value)
  if (!(money > 0)) {
    showToast('金额须大于 0')
    return
  }
  saving.value = true
  try {
    const res = await budgetAdd({
      billId: billId.value,
      date: year,
      costTypeId: addTypeId.value,
      money,
    })
    if (res.retCode === 0) {
      showToast('新增成功')
      showAdd.value = false
      await load()
    } else {
      showToast(res.message || '新增失败')
    }
  } finally {
    saving.value = false
  }
}

function openEdit(item: BudgetDetail) {
  editId.value = item.id
  editTypeName.value = item.costTypeName
  editMoney.value = String(item.budget)
  showEdit.value = true
}

async function saveEdit() {
  const money = Number(editMoney.value)
  if (!(money > 0)) {
    showToast('金额须大于 0')
    return
  }
  saving.value = true
  try {
    const res = await budgetEdit({
      id: editId.value,
      billId: billId.value,
      date: year,
      money,
    })
    if (res.retCode === 0) {
      showToast('已保存')
      showEdit.value = false
      await load()
    } else {
      showToast(res.message || '保存失败')
    }
  } finally {
    saving.value = false
  }
}

function openDelete(item: BudgetDetail) {
  pendingDelId.value = item.id
  showDel.value = true
}

async function confirmDelete() {
  const res = await budgetDelete({
    id: pendingDelId.value,
    billId: billId.value,
    date: year,
  })
  if (res.retCode === 0) {
    showToast('已删除')
    await load()
  } else {
    showToast(res.message || '删除失败')
  }
}

onMounted(async () => {
  billId.value = String(route.params.id || '')
  await load()
})
</script>

<style scoped>
.budget-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: #f5f6f8;
  box-sizing: border-box;
}
.budget-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.budget-head {
  flex: none;
}
.budget-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 8px;
  box-sizing: border-box;
}
.a-hero {
  margin: 4px 12px 10px;
  padding: 16px 16px 14px;
  color: #fff;
  background: linear-gradient(135deg, #3b78e7, #6aa6ff);
  border-radius: 12px;
}
.a-hero .label {
  font-size: 12px;
  opacity: 0.85;
}
.a-hero .split {
  display: flex;
  margin-top: 12px;
}
.a-hero .split > div {
  flex: 1;
}
.a-hero .k {
  font-size: 12px;
  opacity: 0.8;
}
.a-hero .v {
  margin-top: 2px;
  font-size: 16px;
  font-weight: 600;
}
.a-fx {
  margin-top: 10px;
  font-size: 11px;
  line-height: 1.4;
  opacity: 0.85;
}
.a-card {
  margin: 0 12px 10px;
  padding: 12px;
  background: #fff;
  border-radius: 10px;
}
.a-card h3 {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
}
.b-card {
  box-sizing: border-box;
  width: calc(100% - 24px);
  margin: 0 12px 10px;
  padding: 12px;
  background: #fff;
  border-radius: 10px;
  text-align: left;
}
.a-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 0;
}
.type {
  flex: none;
  color: inherit;
  font-size: 15px;
  font-weight: 600;
  text-align: left;
}
.a-note {
  margin: 0;
  color: #999;
  font-size: 12px;
  line-height: 1.5;
}
.b-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
  color: #999;
  font-size: 12px;
  line-height: 1.5;
}
.b-meta .cost {
  color: #f74f4f;
}
.b-line {
  height: 8px;
  margin: 6px 0 10px;
  overflow: hidden;
  background: #f2f3f5;
  border-radius: 4px;
}
.b-line i {
  display: block;
  height: 100%;
  border-radius: 4px;
}
.b-ops {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.b-ops button {
  flex: 1;
  max-width: 88px;
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
  border: none;
  border-radius: 14px;
}
.b-ops .edit {
  color: #4285f4;
  background: #e8f1ff;
}
.b-ops .del {
  width: auto;
  min-width: 0;
  color: #f74f4f;
  background: #fdecec;
}
.a-foot {
  flex: none;
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  background: #fff;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.04);
}
.a-foot .primary {
  flex: 1;
  height: 40px;
  color: #fff;
  font-size: 14px;
  background: #4285f4;
  border: none;
  border-radius: 20px;
}
.sheet {
  padding-bottom: 16px;
}
.sheet-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
}
.sheet-title {
  font-weight: 600;
}
.cancel,
.confirm {
  border: none;
  background: transparent;
  color: #4285f4;
  font-size: 15px;
}
.cancel {
  color: #999;
}
.hint {
  padding: 8px 16px 0;
  color: #999;
  font-size: 12px;
  line-height: 1.5;
}
.page-pad {
  padding: 24px 12px;
}
</style>
