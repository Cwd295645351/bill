<template>
  <div class="admin-ai-audits">
    <div class="filter-card">
      <div class="filter-main">
        <el-input v-model="keyword" placeholder="搜索发起用户" clearable @keyup.enter="search">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select v-model="outcome" clearable placeholder="全部结果">
          <el-option label="成功" value="success" />
          <el-option label="失败" value="error" />
        </el-select>
        <el-button type="primary" @click="search">查询</el-button>
      </div>
      <span class="safe-tip"><el-icon><Lock /></el-icon> 不记录 Prompt、响应正文和密钥</span>
    </div>

    <div class="table-card">
      <div class="table-title"><div><strong>调用记录</strong><span>共 {{ total }} 条审计记录</span></div></div>
      <div class="table-body">
        <el-table :data="list" height="100%" table-layout="fixed" v-loading="loading">
          <el-table-column label="时间" show-overflow-tooltip>
            <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column prop="userName" label="用户" show-overflow-tooltip />
          <el-table-column prop="billName" label="账本" show-overflow-tooltip />
          <el-table-column prop="capability" label="能力" show-overflow-tooltip />
          <el-table-column label="结果">
            <template #default="{ row }"><el-tag size="small" :type="row.outcome === 'success' ? 'success' : 'danger'" effect="light">{{ row.outcome === 'success' ? '成功' : '失败' }}</el-tag></template>
          </el-table-column>
          <el-table-column prop="errorCategory" label="错误分类" show-overflow-tooltip>
            <template #default="{ row }">{{ row.errorCategory || '—' }}</template>
          </el-table-column>
          <el-table-column label="耗时">
            <template #default="{ row }">{{ row.durationMs == null ? '—' : `${row.durationMs} ms` }}</template>
          </el-table-column>
          <el-table-column label="当日序号">
            <template #default="{ row }">{{ row.dailyCount == null || row.dailyCount === '' ? '—' : row.dailyCount }}</template>
          </el-table-column>
          <el-table-column prop="promptTokens" label="Prompt" />
          <el-table-column prop="completionTokens" label="Completion" />
          <el-table-column prop="totalTokens" label="Tokens" />
          <el-table-column label="上游">
            <template #default="{ row }"><span class="upstream" :class="{ active: row.upstreamRequested }"><i></i>{{ row.upstreamRequested ? '是' : '否' }}</span></template>
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
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Lock, Search } from '@element-plus/icons-vue'
import { getAdminAiAudits } from './api'

const keyword = ref('')
const outcome = ref('')
const loading = ref(false)
const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20

const fmtTime = (v: string | null | undefined) => {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString()
}

const load = async () => {
  loading.value = true
  try {
    const [err, res] = await getAdminAiAudits({
      params: {
        keyword: keyword.value.trim(),
        outcome: outcome.value || undefined,
        page: page.value,
        pageSize,
      },
    })
    if (err) return
    if (res.retCode !== 0) {
      ElMessage.error(res.message || '加载审计失败')
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

onMounted(load)
</script>

<style scoped lang="scss">
.admin-ai-audits {
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
  width: min(560px, 68%);
  display: grid;
  grid-template-columns: minmax(180px, 1fr) 130px auto;
  gap: 10px;
}
.safe-tip {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #8b95a5;
  font-size: 11px;
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
}
.pager {
  flex: 0 0 auto;
  padding: 13px 16px;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid #f0f2f5;
}
.upstream {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #9aa3b1;
  font-size: 12px;
  i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #c0c4cc;
  }
  &.active {
    color: #4b5563;
    i { background: #409eff; }
  }
}
@media (max-width: 800px) {
  .filter-card {
    align-items: stretch;
    flex-direction: column;
  }
  .filter-main {
    width: 100%;
  }
}
@media (max-width: 560px) {
  .filter-main {
    grid-template-columns: 1fr;
  }
}
</style>
