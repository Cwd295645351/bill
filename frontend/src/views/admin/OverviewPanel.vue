<template>
  <div class="admin-overview" v-loading="loading">
    <div class="panel-toolbar">
      <div>
        <div class="toolbar-title">核心指标</div>
        <div class="toolbar-subtitle">数据统计不包含已删除记录</div>
      </div>
      <el-radio-group v-model="range" size="small" @change="load">
        <el-radio-button :label="7">近 7 日</el-radio-button>
        <el-radio-button :label="30">近 30 日</el-radio-button>
      </el-radio-group>
    </div>

    <div class="stat-grid" v-if="data">
      <div class="stat-item blue">
        <div class="stat-icon"><el-icon><User /></el-icon></div>
        <div><div class="label">有效用户</div><div class="num">{{ data.userCount }}</div><div class="meta">新增 {{ data.newUserCount }}</div></div>
      </div>
      <div class="stat-item purple">
        <div class="stat-icon"><el-icon><Notebook /></el-icon></div>
        <div><div class="label">有效账本</div><div class="num">{{ data.billCount }}</div><div class="meta">新增 {{ data.newBillCount }}</div></div>
      </div>
      <div class="stat-item cyan">
        <div class="stat-icon"><el-icon><Link /></el-icon></div>
        <div><div class="label">微信绑定</div><div class="num">{{ data.wechatBindCount }}</div><div class="meta">累计绑定数</div></div>
      </div>
      <div class="stat-item orange">
        <div class="stat-icon"><el-icon><Tickets /></el-icon></div>
        <div><div class="label">流水笔数</div><div class="num">{{ data.transactionCount }}</div><div class="meta">有效流水</div></div>
      </div>
      <div class="stat-item red money-card">
        <div class="stat-icon"><span>支</span></div>
        <div><div class="label">支出合计</div><div class="num">¥ {{ fmtMoney(data.expenseSum) }}</div><div class="meta">累计有效支出</div></div>
      </div>
      <div class="stat-item green money-card">
        <div class="stat-icon"><span>收</span></div>
        <div><div class="label">收入合计</div><div class="num">¥ {{ fmtMoney(data.incomeSum) }}</div><div class="meta">累计有效收入</div></div>
      </div>
    </div>

    <div class="ai-card" v-if="data">
      <div class="ai-heading">
        <div class="ai-icon"><el-icon><Cpu /></el-icon></div>
        <div>
          <div class="section-title">AI 使用概览</div>
          <div class="section-subtitle">当前时间窗口内的调用情况</div>
        </div>
      </div>
      <div class="ai-stats">
        <div><span>调用次数</span><strong>{{ data.aiTotal }}</strong></div>
        <div><span>成功次数</span><strong>{{ data.aiSuccess }}</strong></div>
        <div><span>成功率</span><strong>{{ data.successRate === null ? '不适用' : pct(data.successRate) }}</strong></div>
        <div><span>Prompt Tokens</span><strong>{{ data.promptTokens }}</strong></div>
        <div><span>Completion Tokens</span><strong>{{ data.completionTokens }}</strong></div>
        <div><span>Total Tokens</span><strong>{{ data.totalTokens }}</strong></div>
      </div>
    </div>

    <div class="tables" v-if="data">
      <div class="table-wrap">
        <div class="table-heading"><div><div class="section-title">记账趋势</div><div class="section-subtitle">按自然日汇总</div></div></div>
        <el-table :data="data.transactionTrend" size="small" table-layout="fixed" max-height="280">
          <el-table-column prop="date" label="日期" />
          <el-table-column prop="count" label="笔数" />
          <el-table-column label="支出">
            <template #default="{ row }">{{ fmtMoney(row.expenseSum) }}</template>
          </el-table-column>
          <el-table-column label="收入">
            <template #default="{ row }">{{ fmtMoney(row.incomeSum) }}</template>
          </el-table-column>
        </el-table>
      </div>
      <div class="table-wrap">
        <div class="table-heading"><div><div class="section-title">AI 调用趋势</div><div class="section-subtitle">调用次数与 Token 用量</div></div></div>
        <el-table :data="data.aiTrend" size="small" table-layout="fixed" max-height="280">
          <el-table-column prop="date" label="日期" />
          <el-table-column prop="total" label="调用" />
          <el-table-column prop="success" label="成功" />
          <el-table-column prop="totalTokens" label="tokens" />
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Cpu, Link, Notebook, Tickets, User } from '@element-plus/icons-vue'
import { getAdminOverview } from './api'

type OverviewData = {
  userCount: number
  billCount: number
  wechatBindCount: number
  transactionCount: number
  expenseSum: number
  incomeSum: number
  newUserCount: number
  newBillCount: number
  aiTotal: number
  aiSuccess: number
  successRate: number | null
  promptTokens: number
  completionTokens: number
  totalTokens: number
  transactionTrend: Array<{ date: string; count: number; expenseSum: number; incomeSum: number }>
  aiTrend: Array<{ date: string; total: number; success: number; totalTokens: number }>
}

const range = ref<7 | 30>(7)
const loading = ref(false)
const data = ref<OverviewData | null>(null)

const fmtMoney = (n: number) => Number(n || 0).toFixed(2)
const pct = (n: number) => `${(Number(n) * 100).toFixed(1)}%`

const load = async () => {
  loading.value = true
  try {
    const [err, res] = await getAdminOverview({ params: { range: range.value } })
    if (err) return
    if (res.retCode !== 0) {
      ElMessage.error(res.message || '加载总览失败')
      data.value = null
      return
    }
    data.value = res.data
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped lang="scss">
.admin-overview {
  height: 100%;
  min-height: 0;
  overflow: auto;
}
.panel-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}
.toolbar-title,
.section-title {
  color: #263044;
  font-size: 15px;
  font-weight: 650;
}
.toolbar-subtitle,
.section-subtitle {
  margin-top: 3px;
  color: #9aa3b1;
  font-size: 12px;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}
.stat-item {
  min-height: 92px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  border: 1px solid #edf0f4;
  border-radius: 12px;
  background: #fff;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(31, 45, 61, 0.07);
  }
  .stat-icon {
    flex: 0 0 42px;
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border-radius: 11px;
    font-size: 19px;
  }
  .num {
    margin-top: 3px;
    color: #1f2937;
    font-size: 22px;
    font-weight: 700;
    line-height: 1.2;
  }
  .label {
    font-size: 12px;
    color: #8b95a5;
  }
  .meta {
    margin-top: 4px;
    color: #b0b7c3;
    font-size: 11px;
  }
  &.blue .stat-icon { color: #409eff; background: #ecf5ff; }
  &.purple .stat-icon { color: #7c6ee6; background: #f1efff; }
  &.cyan .stat-icon { color: #21a5a5; background: #eafafa; }
  &.orange .stat-icon { color: #e6a23c; background: #fdf6ec; }
  &.red .stat-icon { color: #f56c6c; background: #fef0f0; }
  &.green .stat-icon { color: #67c23a; background: #f0f9eb; }
}
.money-card .num {
  font-size: 20px;
}
.ai-card {
  margin-bottom: 16px;
  padding: 18px;
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  align-items: center;
  gap: 20px;
  border: 1px solid #e8edff;
  border-radius: 12px;
  background: linear-gradient(110deg, #f8faff, #fff);
}
.ai-heading {
  display: flex;
  align-items: center;
  gap: 11px;
}
.ai-icon {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  color: #6c79e6;
  background: #eef0ff;
  font-size: 19px;
}
.ai-stats {
  display: grid;
  grid-template-columns: repeat(6, minmax(74px, 1fr));
  > div {
    padding-left: 15px;
    border-left: 1px solid #edf0f5;
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
    color: #344054;
    font-size: 15px;
  }
}
.tables {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.table-wrap {
  overflow: hidden;
  border: 1px solid #edf0f4;
  border-radius: 12px;
}
.table-heading {
  padding: 15px 16px 11px;
  border-bottom: 1px solid #f0f2f5;
}
@media (max-width: 960px) {
  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .ai-card {
    grid-template-columns: 1fr;
  }
  .ai-stats {
    grid-template-columns: repeat(3, 1fr);
    row-gap: 16px;
  }
  .tables {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 560px) {
  .panel-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
  .stat-grid {
    grid-template-columns: 1fr;
  }
  .ai-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
