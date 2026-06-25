<template>
  <el-dialog :model-value="visible" title="管理类型" width="800px" @close="handleClose" @update:model-value="emit('update:visible', $event)">
    <el-tabs v-model="activeTab">
      <el-tab-pane label="支出类型" name="costType">
        <div class="type-list">
          <div class="type-item" v-for="item in costTypes" :key="item.id">
            <template v-if="editingId === item.id">
              <el-input v-model="editingName" size="small" class="edit-input" @keyup.enter="confirmEdit(item)"></el-input>
              <el-button type="primary" size="small" @click="confirmEdit(item)">确定</el-button>
              <el-button size="small" @click="cancelEdit">取消</el-button>
            </template>
            <template v-else>
              <el-switch
                :model-value="!item.hidden"
                active-text="显示"
                inactive-text="隐藏"
                inline-prompt
                size="small"
                style="margin-right: 8px"
                :loading="togglingId === item.id"
                @change="toggleShow(item, 'costType')"
              />
              <span class="type-name">{{ item.name }}</span>
              <div class="type-actions">
                <el-button type="primary" link size="small" @click="startEdit(item)">编辑</el-button>
                <el-button v-if="!isSystemType(item.id)" type="danger" link size="small" @click="handleDelete(item, 'costType')">删除</el-button>
                <el-tag v-else size="small" type="info">系统类型</el-tag>
              </div>
            </template>
          </div>
          <div class="type-item add-row">
            <el-input v-model="newCostTypeName" placeholder="输入新支出类型名称" size="small" class="edit-input" @keyup.enter="addCostType"></el-input>
            <el-button type="primary" size="small" @click="addCostType" :disabled="!newCostTypeName.trim()">添加</el-button>
          </div>
        </div>
      </el-tab-pane>
      <el-tab-pane label="收入类型" name="incomeType">
        <div class="type-list">
          <div class="type-item" v-for="item in incomeTypes" :key="item.id">
            <template v-if="editingId === item.id">
              <el-input v-model="editingName" size="small" class="edit-input" @keyup.enter="confirmEdit(item)"></el-input>
              <el-button type="primary" size="small" @click="confirmEdit(item)">确定</el-button>
              <el-button size="small" @click="cancelEdit">取消</el-button>
            </template>
            <template v-else>
              <el-switch
                :model-value="!item.hidden"
                active-text="显示"
                inactive-text="隐藏"
                inline-prompt
                size="small"
                style="margin-right: 8px"
                :loading="togglingId === item.id"
                @change="toggleShow(item, 'incomeType')"
              />
              <span class="type-name">{{ item.name }}</span>
              <div class="type-actions">
                <el-button type="primary" link size="small" @click="startEdit(item)">编辑</el-button>
                <el-button v-if="!isSystemType(item.id, 'incomeType')" type="danger" link size="small" @click="handleDelete(item, 'incomeType')">删除</el-button>
                <el-tag v-else size="small" type="info">系统类型</el-tag>
              </div>
            </template>
          </div>
          <div class="type-item add-row">
            <el-input v-model="newIncomeTypeName" placeholder="输入新收入类型名称" size="small" class="edit-input" @keyup.enter="addIncomeType"></el-input>
            <el-button type="primary" size="small" @click="addIncomeType" :disabled="!newIncomeTypeName.trim()">添加</el-button>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useBillStore } from '@/store'
import { storeToRefs } from 'pinia'
import {
  createCostType, editCostType, deleteCostType, toggleCostTypeShow,
  createIncomeType, editIncomeType, deleteIncomeType, toggleIncomeTypeShow
} from './api'
import { getBillDetail } from '../../views/bill/api'

const props = withDefaults(defineProps<{ visible: boolean; billId: string }>(), { visible: false, billId: '' })
const emit = defineEmits<{ 'update:visible': [value: boolean] }>()

const store = useBillStore()
const { bill } = storeToRefs(store)

const activeTab = ref('costType')

const costTypes = computed(() => (bill.value?.costTypes || []).filter((t: any) => !t.isDel))
const incomeTypes = computed(() => (bill.value?.incomesTypes || []).filter((t: any) => !t.isDel))

const editingId = ref<string | null>(null)
const editingName = ref('')
const togglingId = ref<string | null>(null)
const newCostTypeName = ref('')
const newIncomeTypeName = ref('')

/** 系统类型不可删除：支出类型 ID < 1020，收入类型 ID < 2008 */
const isSystemType = (id: string, type: 'costType' | 'incomeType' = 'costType') => {
  const num = Number(id)
  if (isNaN(num)) return false
  return type === 'costType' ? num < 1020 : num < 2008
}

/** 刷新账本数据 */
const refreshBill = async () => {
  if (!props.billId) return
  const [err, res] = await getBillDetail({ params: { id: props.billId } })
  if (err) return
  if (res.retCode === 0) {
    store.updateState({ key: 'bill', value: res.data })
  }
}

/** 打开弹窗时加载账本数据 */
watch(() => props.visible, (val) => {
  if (val) refreshBill()
})

// ===== 支出类型 =====

const addCostType = async () => {
  const name = newCostTypeName.value.trim()
  if (!name) return
  const [err, res] = await createCostType({ data: { billId: props.billId, name } })
  if (err) return
  if (res.retCode === 0) {
    newCostTypeName.value = ''
    ElMessage.success('添加成功')
    await refreshBill()
  } else {
    ElMessage.error(res.message)
  }
}

// ===== 收入类型 =====

const addIncomeType = async () => {
  const name = newIncomeTypeName.value.trim()
  if (!name) return
  const [err, res] = await createIncomeType({ data: { billId: props.billId, name } })
  if (err) return
  if (res.retCode === 0) {
    newIncomeTypeName.value = ''
    ElMessage.success('添加成功')
    await refreshBill()
  } else {
    ElMessage.error(res.message)
  }
}

// ===== 编辑 =====

const startEdit = (item: any) => {
  editingId.value = item.id
  editingName.value = item.name
}

const cancelEdit = () => {
  editingId.value = null
  editingName.value = ''
}

const confirmEdit = async (item: any) => {
  const name = editingName.value.trim()
  if (!name) {
    ElMessage.warning('名称不能为空')
    return
  }
  const isCost = activeTab.value === 'costType'
  const editApi = isCost ? editCostType : editIncomeType
  const [err, res] = await editApi({ data: { id: item.id, billId: props.billId, name } })
  if (err) return
  if (res.retCode === 0) {
    editingId.value = null
    editingName.value = ''
    ElMessage.success('编辑成功')
    await refreshBill()
  } else {
    ElMessage.error(res.message)
  }
}

// ===== 显隐切换 =====

const toggleShow = async (item: any, type: 'costType' | 'incomeType') => {
  togglingId.value = item.id
  const toggleApi = type === 'costType' ? toggleCostTypeShow : toggleIncomeTypeShow
  const [err, res] = await toggleApi({ data: { id: item.id, billId: props.billId } })
  togglingId.value = null
  if (err) return
  if (res.retCode === 0) {
    await refreshBill()
  } else {
    ElMessage.error(res.message)
  }
}

// ===== 删除 =====

const handleDelete = async (item: any, type: 'costType' | 'incomeType') => {
  try {
    await ElMessageBox.confirm(`确定删除类型「${item.name}」？删除后历史交易记录不受影响。`, '确认删除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    const deleteApi = type === 'costType' ? deleteCostType : deleteIncomeType
    const [err, res] = await deleteApi({ data: { id: item.id, billId: props.billId } })
    if (err) return
    if (res.retCode === 0) {
      ElMessage.success('删除成功')
      await refreshBill()
    } else {
      ElMessage.error(res.message)
    }
  } catch {
    // 取消删除
  }
}

const handleClose = () => {
  emit('update:visible', false)
}
</script>

<style scoped lang="scss">
.type-list {
  max-height: 400px;
  overflow-y: auto;
}
.type-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #eee;
  &.add-row {
    border-bottom: none;
    padding-top: 16px;
  }
  .type-name {
    flex: 1;
    font-size: 14px;
  }
  .type-actions {
    flex-shrink: 0;
  }
  .edit-input {
    flex: 1;
    margin-right: 8px;
  }
}
</style>
