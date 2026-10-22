<template>
  <el-dialog v-model="visible" :title="form.id ? '编辑资产' : '登记资产'" width="520px">
    <el-form label-position="top">
      <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
      <div class="two">
        <el-form-item label="成员">
          <el-select v-model="form.memberId" style="width: 100%">
            <el-option v-for="member in members" :key="member.id" :label="member.name" :value="member.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="资产类型">
          <el-select v-model="form.type" style="width: 100%">
            <el-option v-for="item in assetTypes" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
          <p v-if="form.type === 'debt'" class="hint">类型为负债时计入负债，不计入总资产。</p>
        </el-form-item>
      </div>
      <div class="two" :class="{ single: form.type === 'debt' }">
        <el-form-item v-show="form.type !== 'debt'" label="四笔钱">
          <el-select v-model="form.fourMoneyType" style="width: 100%">
            <el-option v-for="item in fourTypes" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="'当前金额（' + currencyLabel(form.currency) + '）'"><el-input v-model="form.latestAmount" /></el-form-item>
        <el-form-item label="币种">
          <el-select v-model="form.currency" :disabled="Boolean(form.id)" style="width: 100%">
            <el-option v-for="item in currencies" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
          <p v-if="form.id" class="hint">要换币种需删除后重新登记。</p>
        </el-form-item>
      </div>
      <div v-show="form.type !== 'debt' && form.fourMoneyType === 'insurance'" class="two">
        <el-form-item label="险种"><el-input v-model="form.insuranceCategory" /></el-form-item>
        <el-form-item :label="'年交保费（' + currencyLabel(form.currency) + '）'"><el-input v-model="form.annualPremium" /></el-form-item>
      </div>
      <p v-if="amountUnchanged" class="hint">金额未变化，保存后不会新增盘点。</p>
      <p class="hint">金额必须大于 0。清掉资产请删除，不要把金额改成 0。</p>
    </el-form>
    <template #footer>
      <el-button v-if="form.id" @click="remove">删除</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ASSET_TYPES, CURRENCIES, FOUR_TYPES, currencyLabel } from '../shared'
import { useAssetForm } from '../hooks/use-asset-form'
import type { AssetMember, AssetRow } from '../type'

const props = defineProps<{
  members: AssetMember[]
  reload: () => Promise<void>
}>()

const assetTypes = ASSET_TYPES
const fourTypes = FOUR_TYPES
const currencies = CURRENCIES
const { visible, saving, form, amountUnchanged, openCreate, openEdit, save, remove } = useAssetForm(() => props.reload())

defineExpose({
  openCreate,
  openEdit: (row: AssetRow) => openEdit(row),
})
</script>

<style scoped lang="scss">
.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;

  &.single {
    grid-template-columns: 1fr;
  }
}

.hint {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>
