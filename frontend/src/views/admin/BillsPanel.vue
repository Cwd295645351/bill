<template>
  <div class="admin-bills">
    <div class="filter-card">
      <div class="filter-main">
        <el-input v-model="keyword" placeholder="搜索账本名称" clearable @keyup.enter="search">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button type="primary" @click="search">查询</el-button>
      </div>
      <el-checkbox v-model="includeDeleted" @change="search">包含已删除账本</el-checkbox>
    </div>

    <div class="table-card">
      <div class="table-title">
        <div><strong>账本列表</strong><span>共 {{ total }} 个账本</span></div>
        <span class="click-tip">点击行查看成员详情</span>
      </div>
      <div class="table-body">
        <el-table :data="list" height="100%" table-layout="fixed" v-loading="loading" @row-click="openDetail">
          <el-table-column prop="name" label="账本" show-overflow-tooltip />
          <el-table-column prop="creatorName" label="创建者" show-overflow-tooltip />
          <el-table-column prop="memberCount" label="成员" />
          <el-table-column prop="transactionCount" label="流水" />
          <el-table-column label="支出">
            <template #default="{ row }"><span class="expense">-{{ fmtMoney(row.expenseSum) }}</span></template>
          </el-table-column>
          <el-table-column label="收入">
            <template #default="{ row }"><span class="income">+{{ fmtMoney(row.incomeSum) }}</span></template>
          </el-table-column>
          <el-table-column label="创建时间" show-overflow-tooltip>
            <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="状态">
            <template #default="{ row }"><span class="status" :class="{ deleted: row.isDel }"><i></i>{{ row.isDel ? '已删除' : '正常' }}</span></template>
          </el-table-column>
        </el-table>
      </div>
      <div class="pager">
        <el-pagination
          background
          layout="total, prev, pager, next"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          @current-change="onPage"
        />
      </div>
    </div>

    <el-drawer v-model="drawer" title="账本详情" size="420px">
      <div v-if="detail" v-loading="detailLoading">
        <div class="bill-summary">
          <div class="bill-icon"><el-icon><Notebook /></el-icon></div>
          <div><strong>{{ detail.name }}</strong><span>创建者：{{ detail.creatorName }}</span></div>
        </div>
        <div class="detail-stats">
          <div><span>流水笔数</span><strong>{{ detail.transactionCount }}</strong></div>
          <div><span>累计支出</span><strong class="expense">{{ fmtMoney(detail.expenseSum) }}</strong></div>
          <div><span>累计收入</span><strong class="income">{{ fmtMoney(detail.incomeSum) }}</strong></div>
        </div>
        <div class="created-time">创建于 {{ fmtTime(detail.createdAt) }}</div>
        <div class="section-title">成员（无流水正文）</div>
        <el-table :data="detail.members || []" size="small" table-layout="fixed">
          <el-table-column prop="userName" label="昵称" show-overflow-tooltip />
          <el-table-column prop="userId" label="用户 ID" show-overflow-tooltip />
        </el-table>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Notebook, Search } from '@element-plus/icons-vue'
import { getAdminBills, getAdminBillDetail } from './api'

const keyword = ref('')
const includeDeleted = ref(false)
const loading = ref(false)
const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const drawer = ref(false)
const detail = ref<any>(null)
const detailLoading = ref(false)

const fmtMoney = (n: number) => Number(n || 0).toFixed(2)
const fmtTime = (v: string | null | undefined) => {
  if (!v) return '未知'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString()
}

const load = async () => {
  loading.value = true
  try {
    const [err, res] = await getAdminBills({
      params: {
        keyword: keyword.value.trim(),
        includeDeleted: includeDeleted.value,
        page: page.value,
        pageSize,
      },
    })
    if (err) return
    if (res.retCode !== 0) {
      ElMessage.error(res.message || '加载账本失败')
      return
    }
    list.value = res.data?.list || []
    total.value = Number(res.data?.total) || 0
  } finally {
    loading.value = false
  }
}

const search = () => {
  page.value = 1
  load()
}

const onPage = (p: number) => {
  page.value = p
  load()
}

const openDetail = async (row: { id: string }) => {
  drawer.value = true
  detail.value = null
  detailLoading.value = true
  try {
    const [err, res] = await getAdminBillDetail(row.id)
    if (err) return
    if (res.retCode !== 0) {
      ElMessage.error(res.message || '加载详情失败')
      return
    }
    detail.value = res.data
  } finally {
    detailLoading.value = false
  }
}

onMounted(load)
</script>

<style scoped lang="scss">
.admin-bills {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.filter-card {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  padding: 14px 16px;
  border: 1px solid #edf0f4;
  border-radius: 11px;
  background: #fafbfd;
}
.filter-main {
  display: flex;
  gap: 10px;
  width: min(430px, 70%);
  .el-input {
    flex: 1;
  }
}
.table-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #edf0f4;
  border-radius: 11px;
}
.table-body {
  flex: 1;
  min-height: 0;
}
.table-title {
  flex: 0 0 auto;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #f0f2f5;
  strong {
    color: #293348;
    font-size: 14px;
  }
  span {
    margin-left: 9px;
    color: #9ca5b3;
    font-size: 12px;
  }
  .click-tip { margin: 0; }
}
.pager {
  flex: 0 0 auto;
  padding: 13px 16px;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid #f0f2f5;
}
.income { color: #45a525; }
.expense { color: #ef6666; }
.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #4b5563;
  font-size: 12px;
  i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #67c23a;
  }
  &.deleted i { background: #c0c4cc; }
}
.bill-summary {
  padding: 15px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 11px;
  background: #f7f9fc;
  .bill-icon {
    width: 43px;
    height: 43px;
    display: grid;
    place-items: center;
    border-radius: 11px;
    color: #7c6ee6;
    background: #eeecff;
    font-size: 19px;
  }
  strong,
  span {
    display: block;
  }
  span {
    margin-top: 4px;
    color: #9aa3b1;
    font-size: 12px;
  }
}
.detail-stats {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  > div {
    padding: 11px 8px;
    border: 1px solid #edf0f4;
    border-radius: 9px;
  }
  span,
  strong {
    display: block;
  }
  span {
    color: #9aa3b1;
    font-size: 11px;
  }
  strong {
    margin-top: 5px;
    font-size: 14px;
  }
}
.created-time {
  margin-top: 10px;
  color: #9aa3b1;
  font-size: 12px;
}
.section-title {
  margin: 18px 0 9px;
  color: #344054;
  font-size: 14px;
  font-weight: 600;
}
@media (max-width: 700px) {
  .filter-card {
    align-items: stretch;
    flex-direction: column;
  }
  .filter-main {
    width: 100%;
  }
}
</style>
