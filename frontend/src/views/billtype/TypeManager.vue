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
      <el-tab-pane label="概览规则" name="overviewRule">
        <div class="type-list">
          <div class="type-item" v-for="item in overviewRules" :key="item.id">
            <el-switch
              :model-value="item.enabled"
              active-text="启用"
              inactive-text="停用"
              inline-prompt
              size="small"
              style="margin-right: 8px"
              :loading="togglingId === item.id"
              @change="handleToggleRule(item)"
            />
            <span class="type-name">
              {{ item.name }}
              <span class="rule-meta">{{ formatRuleMeta(item) }}</span>
            </span>
            <div class="type-actions">
              <el-button
                v-if="item.ruleType === 'quantity'"
                type="primary"
                link
                size="small"
                @click="openYearlyDialog(item)"
              >
                年度配置
              </el-button>
              <el-button type="primary" link size="small" @click="openRuleDialog(item)">编辑</el-button>
              <el-button type="danger" link size="small" @click="handleDeleteRule(item)">删除</el-button>
            </div>
          </div>
          <div class="type-item add-row">
            <el-button type="primary" size="small" @click="openRuleDialog()">添加规则</el-button>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
    <el-dialog v-model="ruleDialogVisible" :title="ruleForm.id ? '编辑概览规则' : '新增概览规则'" width="460px" append-to-body>
      <el-form :model="ruleForm" label-width="100px">
        <el-form-item label="规则名称" required>
          <el-input v-model="ruleForm.name" placeholder="如：香港天数、社保" />
        </el-form-item>
        <el-form-item label="规则类型" required>
          <el-select v-model="ruleForm.ruleType" style="width: 100%">
            <el-option label="数量 × 单价扣减" value="quantity" />
            <el-option label="指定支出类型扣减" value="cost_type" />
          </el-select>
        </el-form-item>
        <template v-if="ruleForm.ruleType === 'quantity'">
          <el-form-item label="单位名称" required>
            <el-input v-model="ruleForm.unitName" placeholder="如：天" />
          </el-form-item>
          <el-form-item label="单价" required>
            <el-input-number v-model="ruleForm.unitPrice" :min="0.01" :precision="2" :step="1" style="width: 100%" />
          </el-form-item>
        </template>
        <el-form-item v-else label="支出类型" required>
          <el-select v-model="ruleForm.costTypeId" style="width: 100%" placeholder="选择要扣减的支出类型">
            <el-option v-for="t in costTypes" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="ruleDialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" :loading="ruleSaving" @click="saveRule">确定</el-button>
      </template>
    </el-dialog>

    <!-- 数量规则年度配置弹窗 -->
    <el-dialog
      v-model="yearlyDialogVisible"
      :title="`${currentRule?.name || ''} - 年度天数与归属人配置`"
      width="680px"
      append-to-body
    >
      <div class="yearly-config-tip">
        配置各年份的实际数量（如香港天数）与扣减归属人。年度收支对账与概览分账将按年份自动读取对应数据。
      </div>

      <el-form :inline="true" :model="yearlyForm" class="yearly-inline-form">
        <el-form-item label="年份">
          <el-input-number v-model="yearlyForm.year" :min="2000" :max="2100" :controls="false" style="width: 90px" />
        </el-form-item>
        <el-form-item :label="currentRule?.unitName ? `数量(${currentRule.unitName})` : '数量'">
          <el-input-number v-model="yearlyForm.quantity" :min="0" :precision="2" :step="1" style="width: 140px" />
        </el-form-item>
        <el-form-item label="归属人">
          <el-select v-model="yearlyForm.belongUserId" placeholder="选择归属人" clearable style="width: 120px">
            <el-option v-for="u in users" :key="u.id" :label="u.name" :value="u.id" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="yearlySaving" @click="saveYearlyItem">保存配置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="yearlyList" v-loading="yearlyLoading" border size="small" style="width: 100%; margin-top: 12px">
        <el-table-column prop="year" label="年份" width="90" align="center">
          <template #default="{ row }">{{ row.year }} 年</template>
        </el-table-column>
        <el-table-column prop="quantity" :label="currentRule?.unitName ? `实际数量 (${currentRule.unitName})` : '实际数量'" width="120" align="center">
          <template #default="{ row }">
            {{ row.quantity }} {{ currentRule?.unitName || '' }}
          </template>
        </el-table-column>
        <el-table-column prop="belongUserName" label="扣减归属人" width="120" align="center">
          <template #default="{ row }">
            {{ row.belongUserName || '未指定' }}
          </template>
        </el-table-column>
        <el-table-column label="扣减金额预估" min-width="120" align="right">
          <template #default="{ row }">
            {{ (row.quantity * Number(currentRule?.unitPrice || 0)).toFixed(2) }} 元
          </template>
        </el-table-column>
        <el-table-column label="操作" width="110" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="editYearlyItem(row)">编辑</el-button>
            <el-button type="danger" link size="small" @click="deleteYearlyItem(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <div style="padding: 16px 0; color: #999">暂无年度配置数据，请在上方添加</div>
        </template>
      </el-table>

      <template #footer>
        <el-button size="small" @click="yearlyDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useBillStore } from '@/store'
import { storeToRefs } from 'pinia'
import {
  createCostType, editCostType, deleteCostType, toggleCostTypeShow,
  createIncomeType, editIncomeType, deleteIncomeType, toggleIncomeTypeShow,
  createOverviewRule, editOverviewRule, toggleOverviewRule, deleteOverviewRule,
  getOverviewRuleYearlyList, saveOverviewRuleYearly, deleteOverviewRuleYearly
} from './api'
import { getBillDetail } from '../../views/bill/api'
import type { OverviewRule, OverviewRuleType } from '@/types/bill'

const props = withDefaults(defineProps<{ visible: boolean; billId: string }>(), { visible: false, billId: '' })
const emit = defineEmits<{ 'update:visible': [value: boolean] }>()

const store = useBillStore()
const { bill } = storeToRefs(store)

const activeTab = ref('costType')

const costTypes = computed(() => (bill.value?.costTypes || []).filter((t: any) => !t.isDel))
const incomeTypes = computed(() => (bill.value?.incomesTypes || []).filter((t: any) => !t.isDel))
const overviewRules = computed(() => bill.value?.overviewRules || [])
const users = computed(() => bill.value?.users || [])

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

// ===== 概览规则 =====

const ruleDialogVisible = ref(false)
const ruleSaving = ref(false)
const emptyRuleForm = () => ({
  id: '',
  name: '',
  ruleType: 'quantity' as OverviewRuleType,
  unitName: '',
  unitPrice: 200,
  costTypeId: '',
})
const ruleForm = ref(emptyRuleForm())

/** 规则摘要：单价或关联支出类型 */
const formatRuleMeta = (item: OverviewRule) => {
  if (item.ruleType === 'quantity') {
    const unit = item.unitName || '单位'
    return `数量×单价 · ${Number(item.unitPrice || 0).toFixed(2)} 元/${unit}`
  }
  const typeName = costTypes.value.find((t: any) => t.id === item.costTypeId)?.name || item.costTypeId || '未选择'
  return `支出类型 · ${typeName}`
}

const openRuleDialog = (item?: OverviewRule) => {
  if (item) {
    ruleForm.value = {
      id: item.id,
      name: item.name,
      ruleType: item.ruleType,
      unitName: item.unitName || '',
      unitPrice: Number(item.unitPrice || 0) || 200,
      costTypeId: item.costTypeId || '',
    }
  } else {
    ruleForm.value = emptyRuleForm()
  }
  ruleDialogVisible.value = true
}

const saveRule = async () => {
  const form = ruleForm.value
  if (!form.name.trim()) {
    ElMessage.warning('请输入规则名称')
    return
  }
  if (form.ruleType === 'quantity') {
    if (!form.unitName.trim()) {
      ElMessage.warning('请输入单位名称')
      return
    }
    if (!form.unitPrice || form.unitPrice <= 0) {
      ElMessage.warning('单价必须为正数')
      return
    }
  } else if (!form.costTypeId) {
    ElMessage.warning('请选择支出类型')
    return
  }

  ruleSaving.value = true
  const payload = {
    billId: props.billId,
    name: form.name.trim(),
    ruleType: form.ruleType,
    unitName: form.unitName.trim(),
    unitPrice: form.unitPrice,
    costTypeId: form.costTypeId,
  }
  const api = form.id ? editOverviewRule : createOverviewRule
  const data = form.id ? { ...payload, id: form.id } : payload
  const [err, res] = await api({ data })
  ruleSaving.value = false
  if (err) return
  if (res.retCode === 0) {
    ruleDialogVisible.value = false
    ElMessage.success(form.id ? '编辑成功' : '添加成功')
    await refreshBill()
  } else {
    ElMessage.error(res.message)
  }
}

const handleToggleRule = async (item: OverviewRule) => {
  togglingId.value = item.id
  const [err, res] = await toggleOverviewRule({ data: { id: item.id, billId: props.billId } })
  togglingId.value = null
  if (err) return
  if (res.retCode === 0) {
    await refreshBill()
  } else {
    ElMessage.error(res.message)
  }
}

const handleDeleteRule = async (item: OverviewRule) => {
  try {
    await ElMessageBox.confirm(`确定删除规则「${item.name}」？删除后概览将不再应用该扣减。`, '确认删除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    const [err, res] = await deleteOverviewRule({ data: { id: item.id, billId: props.billId } })
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

// ===== 数量规则年度配置 =====

const yearlyDialogVisible = ref(false)
const currentRule = ref<OverviewRule | null>(null)
const yearlyList = ref<any[]>([])
const yearlyLoading = ref(false)
const yearlySaving = ref(false)
const yearlyForm = ref({
  year: new Date().getFullYear(),
  quantity: 0,
  belongUserId: '',
})

const openYearlyDialog = async (rule: OverviewRule) => {
  currentRule.value = rule
  const defaultUser = users.value[0]?.id || ''
  yearlyForm.value = {
    year: new Date().getFullYear(),
    quantity: 0,
    belongUserId: defaultUser,
  }
  yearlyDialogVisible.value = true
  await loadYearlyList()
}

const loadYearlyList = async () => {
  if (!props.billId || !currentRule.value?.id) return
  yearlyLoading.value = true
  const [err, res] = await getOverviewRuleYearlyList({
    params: { billId: props.billId, ruleId: currentRule.value.id },
  })
  yearlyLoading.value = false
  if (err) return
  if (res.retCode === 0) {
    yearlyList.value = res.data || []
  } else {
    ElMessage.error(res.message)
  }
}

const saveYearlyItem = async () => {
  if (!props.billId || !currentRule.value?.id) return
  if (!yearlyForm.value.year) {
    ElMessage.warning('请输入年份')
    return
  }
  if (yearlyForm.value.quantity < 0) {
    ElMessage.warning('数量不能为负')
    return
  }
  yearlySaving.value = true
  const [err, res] = await saveOverviewRuleYearly({
    data: {
      billId: props.billId,
      ruleId: currentRule.value.id,
      year: yearlyForm.value.year,
      quantity: yearlyForm.value.quantity,
      belongUserId: yearlyForm.value.belongUserId || null,
    },
  })
  yearlySaving.value = false
  if (err) return
  if (res.retCode === 0) {
    ElMessage.success('保存成功')
    await loadYearlyList()
  } else {
    ElMessage.error(res.message)
  }
}

const editYearlyItem = (row: any) => {
  yearlyForm.value = {
    year: row.year,
    quantity: row.quantity,
    belongUserId: row.belongUserId || '',
  }
}

const deleteYearlyItem = async (row: any) => {
  try {
    await ElMessageBox.confirm(`确定删除 ${row.year} 年的配置吗？`, '确认删除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    const [err, res] = await deleteOverviewRuleYearly({
      data: { id: row.id, billId: props.billId },
    })
    if (err) return
    if (res.retCode === 0) {
      ElMessage.success('删除成功')
      await loadYearlyList()
    } else {
      ElMessage.error(res.message)
    }
  } catch {
    // 取消
  }
}
</script>

<style scoped lang="scss">
.yearly-config-tip {
  margin-bottom: 16px;
  padding: 8px 12px;
  background-color: #f4f6fa;
  border-radius: 4px;
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
}
.yearly-inline-form {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
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
    .rule-meta {
      margin-left: 8px;
      color: #999;
      font-size: 12px;
    }
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
