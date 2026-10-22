<template>
  <el-dialog v-model="visible" :title="asset ? asset.name + ' 盘点' : '盘点'" width="640px">
    <p v-if="asset" class="hint">
      四笔钱 {{ fourLabel(asset.fourMoneyType) }}，资产属性 {{ typeLabel(asset.type) }}，币种 {{ currencyLabel(asset.currency) }}。这三项不能在这里修改。
    </p>
    <div class="two">
      <el-form-item label="金额"><el-input v-model="amount" /></el-form-item>
      <el-form-item label="日期"><el-date-picker v-model="date" type="date" value-format="x" style="width: 100%" /></el-form-item>
    </div>
    <el-table :data="records" size="small">
      <el-table-column label="日期"><template #default="{ row }">{{ formatDay(row.date) }}</template></el-table-column>
      <el-table-column label="金额"><template #default="{ row }">{{ formatMoney(row.amount) }}</template></el-table-column>
      <el-table-column label="操作" width="140" align="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="beginEdit(row)">编辑</el-button>
          <el-button link type="danger" :disabled="total <= 1" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      v-if="total > pageSize"
      layout="prev, pager, next, total"
      :total="total"
      :page-size="pageSize"
      :current-page="page"
      @current-change="onPage"
    />
    <p class="hint">共 {{ total }} 条。只剩一条盘点时不能删除。打开了修改却没保存就关闭，原来的金额和日期不变。</p>
    <template #footer>
      <el-button v-if="editingId" @click="beginCreate">取消修改</el-button>
      <el-button type="primary" :loading="saving" @click="save">{{ editingId ? '保存这条记录' : '记一笔盘点' }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { currencyLabel, formatMoney, fourLabel, typeLabel } from '../shared'
import { useRecords } from '../hooks/use-records'
import type { AssetRow } from '../type'

const props = defineProps<{
  reload: () => Promise<void>
}>()

const recordsApi = useRecords(() => props.reload())
const visible = recordsApi.visible
const asset = recordsApi.asset
const records = recordsApi.records
const editingId = recordsApi.editingId
const amount = recordsApi.amount
const date = recordsApi.date
const saving = recordsApi.saving
const page = recordsApi.page
const total = recordsApi.total
const pageSize = recordsApi.pageSize
const beginEdit = recordsApi.beginEdit
const beginCreate = recordsApi.beginCreate
const save = recordsApi.save
const remove = recordsApi.remove
const formatDay = recordsApi.formatDay

const onPage = (next: number) => {
  page.value = next
  recordsApi.load()
}

defineExpose({ open: recordsApi.open })
</script>

<style scoped lang="scss">
.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.hint {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>
