<template>
  <div class="admin-users">
    <div class="filter-card">
      <div class="filter-main">
        <el-input v-model="keyword" placeholder="搜索用户名或昵称" clearable @keyup.enter="search">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button type="primary" @click="search">查询</el-button>
      </div>
      <el-checkbox v-model="includeDeleted" @change="search">包含已删除用户</el-checkbox>
    </div>

    <div class="table-card">
      <div class="table-title">
        <div><strong>用户列表</strong><span>共 {{ total }} 位用户</span></div>
        <span class="click-tip">点击行查看详情</span>
      </div>
      <div class="table-body">
        <el-table :data="list" height="100%" table-layout="fixed" v-loading="loading" @row-click="openDetail">
          <el-table-column prop="username" label="用户名" show-overflow-tooltip />
          <el-table-column prop="nickName" label="昵称" show-overflow-tooltip />
          <el-table-column label="微信">
            <template #default="{ row }"><el-tag size="small" :type="row.wechatBound ? 'success' : 'info'" effect="plain">{{ row.wechatBound ? '已绑定' : '未绑定' }}</el-tag></template>
          </el-table-column>
          <el-table-column label="创建时间" show-overflow-tooltip>
            <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column prop="billCount" label="账本" />
          <el-table-column label="收入">
            <template #default="{ row }"><span class="income">+{{ fmtMoney(row.incomes) }}</span></template>
          </el-table-column>
          <el-table-column label="支出">
            <template #default="{ row }"><span class="expense">-{{ fmtMoney(row.expenses) }}</span></template>
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

    <el-drawer v-model="drawer" title="用户详情" size="480px">
      <div v-if="detail" v-loading="detailLoading">
        <div class="profile-card">
          <div class="avatar">{{ (detail.nickName || detail.username || '用').slice(0, 1) }}</div>
          <div><strong>{{ detail.nickName || '未设置昵称' }}</strong><span>@{{ detail.username }}</span></div>
          <el-tag size="small" :type="detail.wechatBound ? 'success' : 'info'">{{ detail.wechatBound ? '微信已绑定' : '微信未绑定' }}</el-tag>
        </div>
        <div class="detail-stats">
          <div><span>创建时间</span><strong>{{ fmtTime(detail.createdAt) }}</strong></div>
          <div><span>累计收入</span><strong class="income">{{ fmtMoney(detail.incomes) }}</strong></div>
          <div><span>累计支出</span><strong class="expense">{{ fmtMoney(detail.expenses) }}</strong></div>
        </div>
        <div class="section-title">账本</div>
        <el-table :data="detail.bills || []" size="small" table-layout="fixed">
          <el-table-column prop="name" label="名称" show-overflow-tooltip />
          <el-table-column label="角色">
            <template #default="{ row }">{{ row.isCreator ? '创建者' : '成员' }}</template>
          </el-table-column>
        </el-table>
        <div class="section-title">最近 AI（最多 20）</div>
        <el-table :data="detail.recentAi || []" size="small" table-layout="fixed" max-height="280">
          <el-table-column label="时间" show-overflow-tooltip>
            <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column prop="capability" label="能力" show-overflow-tooltip />
          <el-table-column prop="outcome" label="结果" />
          <el-table-column prop="billId" label="账本 ID" show-overflow-tooltip />
        </el-table>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { getAdminUsers, getAdminUserDetail } from './api'

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
    const [err, res] = await getAdminUsers({
      params: {
        keyword: keyword.value.trim(),
        includeDeleted: includeDeleted.value,
        page: page.value,
        pageSize,
      },
    })
    if (err) return
    if (res.retCode !== 0) {
      ElMessage.error(res.message || '加载用户失败')
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
    const [err, res] = await getAdminUserDetail(row.id)
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
.admin-users {
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
  .click-tip {
    margin: 0;
  }
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
  &.deleted i {
    background: #c0c4cc;
  }
}
.profile-card {
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 11px;
  border-radius: 11px;
  background: #f7f9fc;
  .avatar {
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border-radius: 12px;
    color: #fff;
    background: #409eff;
    font-weight: 700;
  }
  > div:nth-child(2) {
    flex: 1;
    strong,
    span {
      display: block;
    }
    span {
      margin-top: 3px;
      color: #9aa3b1;
      font-size: 12px;
    }
  }
}
.detail-stats {
  margin-top: 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  > div {
    padding: 11px;
    border: 1px solid #edf0f4;
    border-radius: 9px;
    &:first-child {
      grid-column: 1 / -1;
    }
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
    margin-top: 4px;
    font-size: 13px;
  }
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
