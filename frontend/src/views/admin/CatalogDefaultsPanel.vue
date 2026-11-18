<template>
  <div class="admin-catalog">
    <div class="notice-card">
      <div class="notice-icon"><el-icon><InfoFilled /></el-icon></div>
      <div>
        <strong>新建账本默认模板</strong>
        <span>这里的改动仅影响之后创建的账本，不会改写已有账本和历史流水。</span>
      </div>
      <el-checkbox v-model="includeDeleted" @change="load">显示已删除</el-checkbox>
    </div>

    <div class="catalog-body">
      <el-tabs v-model="activeKind" class="catalog-tabs">
        <el-tab-pane v-for="tab in tabs" :key="tab.kind" :label="tab.label" :name="tab.kind" />
      </el-tabs>

      <div class="add-bar">
        <div class="add-title"><el-icon><Plus /></el-icon>添加{{ currentTabLabel }}</div>
        <el-input
          v-model="newNames[activeKind]"
          placeholder="输入名称（最长 64）"
          maxlength="64"
          @keyup.enter="addItem(activeKind)"
        />
        <el-button type="primary" :disabled="!(newNames[activeKind] || '').trim()" @click="addItem(activeKind)">添加</el-button>
      </div>

      <div class="type-grid" v-loading="loading">
        <div class="type-card" :class="{ deleted: item.isDel }" v-for="item in filtered(activeKind)" :key="item.kind + '_' + item.id">
          <template v-if="editingKey === keyOf(item)">
            <div class="edit-form">
              <el-input v-model="editingName" maxlength="64" @keyup.enter="confirmEdit(item)" />
              <div>
                <el-button type="primary" size="small" @click="confirmEdit(item)">保存</el-button>
                <el-button size="small" @click="cancelEdit">取消</el-button>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="type-top">
              <span class="type-id">#{{ item.id }}</span>
              <el-tag v-if="item.isDel" size="small" type="info" effect="plain">已删除</el-tag>
            </div>
            <strong class="type-name">{{ item.name }}</strong>
            <div class="type-actions" v-if="!item.isDel">
              <el-button type="primary" link size="small" @click="startEdit(item)">改名</el-button>
              <el-button type="danger" link size="small" @click="softDelete(item)">删除</el-button>
            </div>
          </template>
        </div>
        <div v-if="!filtered(activeKind).length" class="empty-tip">暂无类型</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { InfoFilled, Plus } from '@element-plus/icons-vue'
import { getCatalogDefaults, createCatalogDefault, renameCatalogDefault, deleteCatalogDefault } from './api'

type Kind = 'cost' | 'income' | 'pay_method'
type Row = { kind: Kind; id: string; name: string; isDel: boolean }

const tabs: Array<{ kind: Kind; label: string }> = [
  { kind: 'cost', label: '支出类型' },
  { kind: 'income', label: '收入类型' },
  { kind: 'pay_method', label: '支付方式' },
]

const activeKind = ref<Kind>('cost')
const includeDeleted = ref(false)
const loading = ref(false)
const rows = ref<Row[]>([])
const newNames = reactive<Record<Kind, string>>({ cost: '', income: '', pay_method: '' })
const editingKey = ref('')
const editingName = ref('')

const currentTabLabel = computed(() => tabs.find((t) => t.kind === activeKind.value)?.label || '')
const keyOf = (item: Row) => `${item.kind}:${item.id}`
const filtered = (kind: Kind) => rows.value.filter((r) => r.kind === kind)

const load = async () => {
  loading.value = true
  try {
    const [err, res] = await getCatalogDefaults({
      params: { includeDeleted: includeDeleted.value },
    })
    if (err) return
    if (res.retCode !== 0) {
      ElMessage.error(res.message || '加载默认类型失败')
      return
    }
    rows.value = (res.data || []) as Row[]
  } finally {
    loading.value = false
  }
}

const startEdit = (item: Row) => {
  editingKey.value = keyOf(item)
  editingName.value = item.name
}

const cancelEdit = () => {
  editingKey.value = ''
  editingName.value = ''
}

const confirmEdit = async (item: Row) => {
  const name = editingName.value.trim()
  if (!name) {
    ElMessage.error('名称不能为空')
    return
  }
  const [err, res] = await renameCatalogDefault(item.kind, item.id, name)
  if (err) return
  if (res.retCode !== 0) {
    ElMessage.error(res.message || '改名失败')
    return
  }
  ElMessage.success('已更新')
  cancelEdit()
  await load()
}

const softDelete = async (item: Row) => {
  try {
    await ElMessageBox.confirm(`确认软删「${item.name}」？不可恢复，且只影响之后新建账本。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  const [err, res] = await deleteCatalogDefault(item.kind, item.id)
  if (err) return
  if (res.retCode !== 0) {
    ElMessage.error(res.message || '删除失败')
    return
  }
  ElMessage.success('已删除')
  await load()
}

const addItem = async (kind: Kind) => {
  const name = (newNames[kind] || '').trim()
  if (!name) return
  const [err, res] = await createCatalogDefault({ data: { kind, name } })
  if (err) return
  if (res.retCode !== 0) {
    ElMessage.error(res.message || '添加失败')
    return
  }
  newNames[kind] = ''
  ElMessage.success('已添加')
  await load()
}

onMounted(load)
</script>

<style scoped lang="scss">
.admin-catalog {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.notice-card {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 12px 14px;
  border: 1px solid #dcecff;
  border-radius: 11px;
  background: #f5faff;
  .notice-icon {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border-radius: 9px;
    color: #409eff;
    background: #e5f2ff;
    font-size: 17px;
  }
  > div:nth-child(2) {
    flex: 1;
  }
  strong,
  span {
    display: block;
  }
  strong {
    color: #344054;
    font-size: 13px;
  }
  span {
    margin-top: 3px;
    color: #8190a5;
    font-size: 12px;
  }
}
.catalog-body {
  flex: 1;
  min-height: 0;
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.catalog-tabs {
  flex: 0 0 auto;
  :deep(.el-tabs__header) {
    margin-bottom: 12px;
  }
  :deep(.el-tabs__content) {
    display: none;
  }
}
.add-bar {
  flex: 0 0 auto;
  margin-bottom: 12px;
  padding: 12px 14px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  border: 1px dashed #cfe0f5;
  border-radius: 11px;
  background: #fafcff;
  .add-title {
    display: flex;
    align-items: center;
    gap: 5px;
    color: #607089;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
  }
}
.type-grid {
  flex: 1;
  min-height: 0;
  padding: 2px 2px 8px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-content: start;
  gap: 12px;
  overflow: auto;
}
.type-card {
  min-height: 108px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  border: 1px solid #e9edf3;
  border-radius: 11px;
  background: #fff;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
  &:hover {
    border-color: #cfe4ff;
    box-shadow: 0 6px 16px rgba(31, 45, 61, 0.05);
  }
  &.deleted {
    background: #fafafa;
    opacity: 0.68;
  }
}
.type-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.type-id {
  color: #a0a8b5;
  font-size: 11px;
}
.type-name {
  margin-top: 12px;
  color: #344054;
  font-size: 15px;
}
.type-actions {
  margin-top: auto;
  align-self: flex-end;
}
.edit-form {
  display: flex;
  flex-direction: column;
  gap: 11px;
}
.empty-tip {
  grid-column: 1 / -1;
  padding: 36px 0;
  text-align: center;
  color: #9aa3b1;
  font-size: 13px;
}
@media (max-width: 980px) {
  .type-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 700px) {
  .add-bar {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 600px) {
  .notice-card {
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .type-grid {
    grid-template-columns: 1fr;
  }
}
</style>
