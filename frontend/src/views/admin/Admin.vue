<template>
  <div class="admin-page">
    <aside class="admin-sidebar">
      <div class="brand">
        <div class="brand-mark">运</div>
        <div>
          <div class="brand-title">运营后台</div>
          <div class="brand-subtitle">Operations</div>
        </div>
      </div>
      <nav class="admin-nav">
        <button
          v-for="item in navItems"
          :key="item.value"
          class="nav-item"
          :class="{ active: activeTab === item.value }"
          type="button"
          @click="activeTab = item.value"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </button>
      </nav>
      <div class="sidebar-tip">
        <el-icon><Lock /></el-icon>
        <span>仅指定管理员可访问</span>
      </div>
    </aside>

    <main class="admin-main">
      <header class="page-header">
        <div>
          <h1>{{ currentNav.label }}</h1>
          <p>{{ currentNav.description }}</p>
        </div>
        <div class="admin-badge">
          <span class="status-dot"></span>
          管理员模式
        </div>
      </header>

      <section class="content-card">
        <OverviewPanel v-if="activeTab === 'overview'" />
        <UsersPanel v-else-if="activeTab === 'users'" />
        <BillsPanel v-else-if="activeTab === 'bills'" />
        <AiAuditsPanel v-else-if="activeTab === 'ai'" />
        <CatalogDefaultsPanel v-else />
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { DataAnalysis, User, Notebook, Cpu, Collection, Lock } from '@element-plus/icons-vue'
import OverviewPanel from './OverviewPanel.vue'
import UsersPanel from './UsersPanel.vue'
import BillsPanel from './BillsPanel.vue'
import AiAuditsPanel from './AiAuditsPanel.vue'
import CatalogDefaultsPanel from './CatalogDefaultsPanel.vue'

const activeTab = ref('overview')
const navItems = [
  { value: 'overview', label: '数据总览', description: '查看核心运营指标和近期趋势', icon: DataAnalysis },
  { value: 'users', label: '用户管理', description: '查询用户状态、账本和近期 AI 调用', icon: User },
  { value: 'bills', label: '账本管理', description: '查看账本规模、收支和成员信息', icon: Notebook },
  { value: 'ai', label: 'AI 审计', description: '追踪 AI 调用结果、耗时和用量', icon: Cpu },
  { value: 'catalog', label: '默认类型', description: '维护新建账本使用的默认类型', icon: Collection },
]
const currentNav = computed(() => navItems.find((item) => item.value === activeTab.value) || navItems[0])
</script>

<style scoped lang="scss">
.admin-page {
  height: calc(100vh - 60px);
  overflow: hidden;
  display: grid;
  grid-template-columns: 224px minmax(0, 1fr);
  background: #f5f7fa;
  color: #1f2937;
}
.admin-sidebar {
  height: 100%;
  min-height: 0;
  padding: 24px 16px 18px;
  background: #fff;
  border-right: 1px solid #e9edf3;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.brand {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 0 10px 22px;
  border-bottom: 1px solid #f0f2f5;
}
.brand-mark {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 11px;
  color: #fff;
  background: linear-gradient(145deg, #409eff, #337ecc);
  box-shadow: 0 6px 16px rgba(64, 158, 255, 0.24);
  font-weight: 700;
}
.brand-title {
  font-size: 16px;
  font-weight: 700;
}
.brand-subtitle {
  margin-top: 2px;
  color: #a0a8b5;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.admin-nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 20px;
}
.nav-item {
  width: 100%;
  height: 42px;
  padding: 0 13px;
  display: flex;
  align-items: center;
  gap: 11px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #64748b;
  font-size: 14px;
  cursor: pointer;
  transition: 0.18s ease;
  .el-icon {
    font-size: 17px;
  }
  &:hover {
    color: #409eff;
    background: #f4f8ff;
  }
  &.active {
    color: #1677ff;
    background: #ecf5ff;
    font-weight: 600;
  }
}
.sidebar-tip {
  margin-top: auto;
  padding: 11px 12px;
  display: flex;
  align-items: center;
  gap: 7px;
  border-radius: 9px;
  background: #f8fafc;
  color: #94a3b8;
  font-size: 12px;
}
.admin-main {
  min-width: 0;
  min-height: 0;
  height: 100%;
  padding: 20px 24px 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.page-header {
  flex: 0 0 auto;
  margin-bottom: 14px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  h1 {
    margin: 0;
    color: #172033;
    font-size: 22px;
    line-height: 1.3;
  }
  p {
    margin: 4px 0 0;
    color: #8a94a6;
    font-size: 13px;
  }
}
.admin-badge {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 11px;
  border: 1px solid #d9ecff;
  border-radius: 20px;
  background: #f4f9ff;
  color: #409eff;
  font-size: 12px;
}
.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #67c23a;
  box-shadow: 0 0 0 3px rgba(103, 194, 58, 0.14);
}
.content-card {
  flex: 1;
  min-height: 0;
  padding: 18px;
  border: 1px solid #edf0f4;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 6px 24px rgba(31, 45, 61, 0.05);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  > * {
    flex: 1;
    min-height: 0;
  }
}

@media (max-width: 900px) {
  .admin-page {
    grid-template-columns: 76px minmax(0, 1fr);
  }
  .admin-sidebar {
    padding: 20px 10px;
  }
  .brand {
    justify-content: center;
    padding: 0 0 18px;
    > div:last-child {
      display: none;
    }
  }
  .nav-item {
    justify-content: center;
    padding: 0;
    span {
      display: none;
    }
  }
  .sidebar-tip {
    justify-content: center;
    span {
      display: none;
    }
  }
  .admin-main {
    padding: 16px 14px;
  }
}

@media (max-width: 640px) {
  .admin-page {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }
  .admin-sidebar {
    height: auto;
    padding: 10px 14px;
    border-right: 0;
    border-bottom: 1px solid #e9edf3;
  }
  .brand,
  .sidebar-tip {
    display: none;
  }
  .admin-nav {
    flex-direction: row;
    overflow-x: auto;
    padding: 0;
  }
  .nav-item {
    min-width: 44px;
  }
  .admin-main {
    padding: 12px;
  }
  .admin-badge {
    display: none;
  }
  .content-card {
    padding: 12px;
  }
}
</style>
