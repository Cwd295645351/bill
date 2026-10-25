<template>
  <el-dialog v-model="visible" :title="asset ? asset.name + ' 盘点' : '盘点'" width="640px">
    <div v-if="asset" class="three">
      <el-form-item label="四笔钱"><el-input :model-value="fourLabel(asset.fourMoneyType)" disabled /></el-form-item>
      <el-form-item label="资产属性"><el-input :model-value="typeLabel(asset.type)" disabled /></el-form-item>
      <el-form-item label="币种"><el-input :model-value="currencyLabel(asset.currency)" disabled /></el-form-item>
    </div>
    <div v-if="asset && asset.type !== 'debt'" class="two">
      <el-form-item label="渠道"><el-input :model-value="channelLabel(asset.channel)" disabled /></el-form-item>
      <el-form-item label="周转周期"><el-input :model-value="turnaroundLabel(asset.turnaroundCycle)" disabled /></el-form-item>
    </div>
    <table class="record-table">
      <thead>
        <tr>
          <th>日期</th>
          <th>金额（{{ currencyLabel(asset?.currency) }}）</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!records.length"><td colspan="3">还没有盘点</td></tr>
        <tr v-for="item in records" :key="item.id">
          <td>{{ formatDay(item.date) }}</td>
          <td>{{ formatMoney(item.amount) }}</td>
          <td class="ops">
            <button type="button" class="link" @click="beginEdit(item)">编辑</button>
            <button type="button" class="link danger" :disabled="total <= 1" @click="remove(item)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>
    <div class="pager">
      <span>共 {{ total }} 条</span>
      <el-pagination
        layout="prev, pager, next"
        :total="total"
        :page-size="pageSize"
        :current-page="page"
        @current-change="onPage"
      />
    </div>
    <p class="hint">只剩一条盘点时不能删除。打开了修改却没保存就关闭，原来的金额和日期不变。</p>
    <p v-if="listError" class="hint error">{{ listError }}</p>
    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
      <el-button type="primary" @click="beginCreate">记一笔盘点</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="formVisible" :title="editingId ? '编辑盘点' : '记一笔盘点'" width="460px" append-to-body>
    <div class="two">
      <el-form-item :label="'金额（' + currencyLabel(asset?.currency) + '）'"><el-input v-model="amount" /></el-form-item>
      <el-form-item label="日期"><el-date-picker v-model="date" type="date" value-format="x" style="width: 100%" /></el-form-item>
    </div>
    <p v-if="error" class="hint error">{{ error }}</p>
    <template #footer>
      <el-button @click="formVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { channelLabel, currencyLabel, formatMoney, fourLabel, turnaroundLabel, typeLabel } from '../shared'
import { useRecords } from '../hooks/use-records'
import type { AssetRow } from '../type'

const props = defineProps<{
  reload: () => Promise<void>
}>()

const recordsApi = useRecords(() => props.reload())
const visible = recordsApi.visible
const formVisible = recordsApi.formVisible
const asset = recordsApi.asset
const records = recordsApi.records
const editingId = recordsApi.editingId
const amount = recordsApi.amount
const date = recordsApi.date
const error = recordsApi.error
const listError = recordsApi.listError
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

.three {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.record-table {
  width: 100%;
  font-size: 14px;
  border-collapse: collapse;

  th,
  td {
    padding: 8px 0;
    border-bottom: 1px solid #f2f2f2;
    text-align: left;
  }

  th:last-child,
  .ops {
    text-align: right;
  }
}

.ops .link + .link {
  margin-left: 12px;
}

.link {
  border: none;
  padding: 0;
  background: transparent;
  color: rgb(64, 158, 255);
  font-size: 14px;
  cursor: pointer;

  &.danger {
    color: rgb(247, 79, 79);
  }

  &:disabled {
    color: #c0c4cc;
    cursor: not-allowed;
  }
}

.pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin: 12px 0 4px;
  font-size: 13px;
  color: #606266;
}

.hint {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;

  &.error {
    color: rgb(247, 79, 79);
  }
}
</style>
