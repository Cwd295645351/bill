<template>
  <div class="page detail-page">
    <van-nav-bar
      :title="billName || '账单详情'"
      left-arrow
      fixed
      placeholder
      @click-left="goBack"
    >
      <template #right>
        <van-icon name="search" size="18" @click="goSearch" />
      </template>
    </van-nav-bar>

    <div v-if="loadError" class="page-pad">
      <van-empty :description="loadError">
        <van-button size="small" type="primary" color="#4285F4" @click="init">重试</van-button>
      </van-empty>
    </div>

    <template v-else>
      <div class="summary">
        <div class="summary-actions">
          <button v-if="isCreator" type="button" class="invite" @click="onInvite">邀请成员</button>
        </div>
        <div class="item">
          <div class="label">年度支出</div>
          <div class="num">{{ yearCost }}</div>
        </div>
        <div class="item">
          <div class="label">当月支出</div>
          <div class="num">{{ monthCost }}</div>
        </div>
        <div class="item">
          <div class="label">剩余预算</div>
          <div class="num">{{ restBudget }}</div>
        </div>
        <div class="item">
          <div class="label">总投资</div>
          <div class="num">{{ investCost }}</div>
        </div>
        <div class="item">
          <div class="label">总消费</div>
          <div class="num">{{ consumptionCost }}</div>
        </div>
        <div class="item">
          <div class="label">总收入</div>
          <div class="num income">{{ totalIncomes }}</div>
        </div>
      </div>

      <van-tabs v-model:active="type" color="#4285F4" @change="onTypeChange">
        <van-tab title="支出" :name="1" />
        <van-tab title="收入" :name="2" />
      </van-tabs>

      <van-pull-refresh v-model="refreshing" class="list-area" @refresh="onRefresh">
        <van-list
          v-model:loading="listLoading"
          :finished="finished"
          finished-text="没有更多了"
          @load="loadMore"
        >
          <van-empty v-if="!groups.length && !listLoading && searched" description="暂无记录" />
          <template v-for="group in groups" :key="group.date">
            <div class="day">
              <span>{{ group.date }} {{ group.week }}</span>
              <span v-if="type === 2" class="sum">收 ¥{{ group.incomes }}</span>
              <span v-else class="sum">支 ¥{{ group.cost }}</span>
            </div>
            <van-swipe-cell
              v-for="record in group.arr"
              :key="record.id"
              :right-width="record.mine ? 72 : 0"
            >
              <div
                class="row"
                :class="{ mine: record.mine }"
                :style="record.belongBg ? { backgroundColor: record.belongBg } : undefined"
                @click="onEdit(record)"
              >
                <div class="meta">
                  <div class="title">
                    <span>{{ record.belongUserName || '全部' }} · {{ record.category }}</span>
                    <span v-if="record.mine" class="mine-tag">我</span>
                  </div>
                  <div v-if="record.remark" class="remark">{{ record.remark }}</div>
                  <div
                    v-if="record.images && record.images.length"
                    class="photo-entry"
                    @click.stop="onPreviewImages(record)"
                  >
                    查看照片 {{ record.images.length }}
                  </div>
                </div>
                <div class="money" :class="record.type === 1 ? 'cost' : 'income'">
                  {{ record.moneyText }}
                </div>
              </div>
              <template v-if="record.mine" #right>
                <div class="del" @click.stop="onDelete(record)">删除</div>
              </template>
            </van-swipe-cell>
          </template>
        </van-list>
      </van-pull-refresh>

      <button type="button" class="fab" aria-label="记一笔" @click="goCreate">
        <van-icon name="plus" size="28" color="#ffffff" />
      </button>
    </template>

    <van-dialog
      v-model:show="inviteVisible"
      title="邀请成员"
      confirm-button-text="复制邀请码"
      confirm-button-color="#4285F4"
      show-cancel-button
      cancel-button-text="关闭"
      @confirm="copyInviteCode"
    >
      <div class="invite-body">
        <p class="invite-tip">将邀请码发给家人，对方在「加入账本」中输入即可</p>
        <p class="invite-code">{{ inviteCode }}</p>
      </div>
    </van-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showConfirmDialog, showImagePreview, showToast } from 'vant'
import { getBillDetail, inviteBill } from '@/api/bill'
import {
  deleteTransaction,
  getBalance,
  getBudget,
  getMonthCost,
  getRecordList,
} from '@/api/transaction'
import { useBillContextStore } from '@/stores/bill-context'
import { useSessionStore } from '@/stores/session'
import { dayEndTs, moneyText, thisYear, today, yearStartTs } from '@/utils/date'
import { groupRecords, type DayGroup, type RecordItem } from '@/utils/records'

const route = useRoute()
const router = useRouter()
const billCtx = useBillContextStore()
const session = useSessionStore()

const billId = computed(() => String(route.params.id || ''))
const billName = ref('')
const loadError = ref('')
const isCreator = ref(false)
const users = ref<{ id: string }[]>([])

const yearCost = ref('0.00')
const monthCost = ref('0.00')
const restBudget = ref('0.00')
const investCost = ref('0.00')
const consumptionCost = ref('0.00')
const totalIncomes = ref('0.00')

const type = ref(1)
const records = ref<RecordItem[]>([])
const groups = ref<DayGroup[]>([])
const pageIndex = ref(1)
const finished = ref(false)
const listLoading = ref(false)
const refreshing = ref(false)
const searched = ref(false)
const PAGE_SIZE = 20

const inviteVisible = ref(false)
const inviteCode = ref('')

const userId = computed(() => session.userInfo?.userId || '')

function rebuildGroups() {
  groups.value = groupRecords(records.value, userId.value, users.value)
}

function goBack() {
  router.replace({ name: 'bills' })
}

function goSearch() {
  router.push({ name: 'record-search', query: { billId: billId.value } })
}

function goCreate() {
  billCtx.setCurrentBillId(billId.value, billName.value)
  router.push({ name: 'record-create', query: { billId: billId.value } })
}

async function loadBill() {
  const res = await getBillDetail(billId.value)
  if (res.retCode !== 0 || !res.data) {
    loadError.value = res.message || '无权查看或账本不存在'
    return null
  }
  loadError.value = ''
  billName.value = res.data.name || ''
  users.value = (res.data.users || []).map((u: { id: string }) => ({ id: u.id }))
  isCreator.value = !!(userId.value && res.data.creator === userId.value)
  billCtx.setCurrentBill(res.data)
  return res.data
}

async function loadSummary() {
  const year = thisYear()
  const [budgetRes, monthRes, balanceRes] = await Promise.all([
    getBudget(billId.value, year),
    getMonthCost(billId.value),
    getBalance(billId.value, yearStartTs(year), dayEndTs(today())),
  ])
  const budget =
    budgetRes.retCode === 0 && budgetRes.data
      ? budgetRes.data
      : { totalBudget: 0, currCost: 0 }
  const month =
    monthRes.retCode === 0 && monthRes.data ? Number(monthRes.data.totalCost || 0) : 0
  const rest = Number(budget.totalBudget || 0) - Number(budget.currCost || 0)
  const balance =
    balanceRes.retCode === 0 && balanceRes.data
      ? balanceRes.data
      : { totalCost: 0, totalIncomes: 0, investCost: 0 }
  const invest = Number(balance.investCost || 0)
  const consumption = Number(balance.totalCost || 0) - invest
  yearCost.value = moneyText(budget.currCost)
  monthCost.value = moneyText(month)
  restBudget.value = moneyText(rest)
  investCost.value = moneyText(invest)
  consumptionCost.value = moneyText(consumption)
  totalIncomes.value = moneyText(balance.totalIncomes)
}

async function loadList(reset: boolean) {
  if (!reset && finished.value) return
  const page = reset ? 1 : pageIndex.value
  listLoading.value = true
  try {
    const res = await getRecordList({
      billId: billId.value,
      type: type.value,
      pageIndex: page,
      pageSize: PAGE_SIZE,
      condition: 'gte',
      rangeMoney: 0,
    })
    if (res.retCode !== 0 || !res.data) {
      if (reset) {
        records.value = []
        rebuildGroups()
      }
      return
    }
    const incoming = (res.data.datas || []) as RecordItem[]
    records.value = reset ? incoming : records.value.concat(incoming)
    const total = Number(res.data.total || 0)
    pageIndex.value = page + 1
    finished.value = records.value.length >= total
    searched.value = true
    rebuildGroups()
  } finally {
    listLoading.value = false
    refreshing.value = false
  }
}

function onTypeChange() {
  records.value = []
  groups.value = []
  finished.value = false
  pageIndex.value = 1
  loadList(true)
}

function onRefresh() {
  finished.value = false
  loadSummary()
  loadList(true)
}

function loadMore() {
  loadList(false)
}

function onEdit(item: RecordItem) {
  if (!item.mine) {
    showToast('只能编辑自己记的账单')
    return
  }
  sessionStorage.setItem('editingRecord', JSON.stringify(item))
  router.push({ name: 'record-edit', query: { billId: billId.value } })
}

function onPreviewImages(record: RecordItem) {
  if (!record.images || !record.images.length) return
  const sorted = record.images.slice().sort((a, b) => (a.sort || 0) - (b.sort || 0))
  const urls = sorted.map((img) => img.viewUrl).filter(Boolean)
  if (!urls.length) return
  showImagePreview({ images: urls, startPosition: 0 })
}

async function onDelete(record: RecordItem) {
  if (!record.mine) {
    showToast('只能删除自己记的账单')
    return
  }
  try {
    await showConfirmDialog({
      title: '确定删除吗？',
      message: '删除后无法恢复',
      confirmButtonColor: '#ee0a24',
    })
  } catch {
    return
  }
  const ret = await deleteTransaction(record.id)
  if (ret.retCode === 0) {
    showToast('已删除')
    loadSummary()
    loadList(true)
  } else {
    showToast(ret.message || '删除失败')
  }
}

async function onInvite() {
  const res = await inviteBill(billId.value)
  if (res.retCode !== 0 || !res.data) {
    showToast(res.message || '只有创建者可以邀请')
    return
  }
  inviteCode.value = String(res.data)
  inviteVisible.value = true
}

async function copyInviteCode() {
  const text = inviteCode.value
  if (!text) return
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
    } else {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    showToast('邀请码已复制')
  } catch {
    showToast('复制失败，请手动复制')
  }
}

async function init() {
  if (!billId.value) {
    loadError.value = '缺少账本'
    return
  }
  await loadBill()
  if (loadError.value) return
  await loadSummary()
  await loadList(true)
}

onMounted(init)
</script>

<style scoped>
.detail-page {
  min-height: 100vh;
  padding-bottom: 88px;
}
.summary {
  display: flex;
  flex-wrap: wrap;
  margin: 12px 16px;
  padding: 12px 14px 14px;
  border-radius: 10px;
  color: #333;
  background: linear-gradient(135deg, #dcf8f9, #8eb6f8);
}
.summary-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
  margin-bottom: 8px;
}
.invite {
  height: 28px;
  margin: 0;
  padding: 0 12px;
  color: #4285f4;
  font-size: 12px;
  line-height: 28px;
  background: rgba(255, 255, 255, 0.92);
  border: none;
  border-radius: 14px;
}
.item {
  width: 33.33%;
  margin-top: 6px;
}
.label {
  color: #5f6b7a;
  font-size: 12px;
}
.num {
  margin-top: 4px;
  font-size: 16px;
  font-weight: 600;
}
.num.income {
  color: #07c160;
}
.day {
  display: flex;
  justify-content: space-between;
  padding: 10px 16px;
  color: #666;
  font-size: 12px;
}
.sum {
  color: #666;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 16px 8px;
  padding: 12px 14px;
  background: #fff;
  border-radius: 8px;
}
.row.mine {
  box-shadow: inset 3px 0 0 #4285f4;
}
.meta {
  min-width: 0;
  flex: 1;
}
.title {
  display: flex;
  align-items: center;
  font-size: 14px;
}
.mine-tag {
  flex-shrink: 0;
  margin-left: 8px;
  padding: 0 6px;
  color: #4285f4;
  font-size: 10px;
  line-height: 16px;
  background: #e8f0fe;
  border-radius: 4px;
}
.remark {
  margin-top: 4px;
  color: #999;
  font-size: 12px;
}
.photo-entry {
  margin-top: 6px;
  color: #4285f4;
  font-size: 12px;
}
.money {
  margin-left: 12px;
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
}
.money.cost {
  color: #f74f4f;
}
.money.income {
  color: #07c160;
}
.del {
  width: 72px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  color: #fff;
  background: #f74f4f;
  border-radius: 8px;
}
.fab {
  position: fixed;
  right: 20px;
  bottom: calc(24px + env(safe-area-inset-bottom));
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 28px;
  background: #4285f4;
  box-shadow: 0 4px 12px rgba(66, 133, 244, 0.4);
}
.invite-body {
  padding: 16px 20px 8px;
  text-align: center;
}
.invite-tip {
  margin: 0 0 12px;
  color: #969799;
  font-size: 13px;
  line-height: 1.5;
}
.invite-code {
  margin: 0;
  padding: 12px;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 1px;
  word-break: break-all;
  background: #f5f6f8;
  border-radius: 8px;
}
</style>
