<template>
  <el-dialog :model-value="visible" title="资产成员" width="480px" @update:model-value="emit('update:visible', $event)">
    <p class="hint">资产成员和记账成员分开。改完名称后按回车或点到别处保存。隐藏后，已有资产仍显示原来的名字，也仍计入家庭总额。</p>
    <div class="member-add">
      <el-input :model-value="draftName" maxlength="64" placeholder="没有登录账号的家人也可以添加" @update:model-value="emit('update:draftName', $event)" @keyup.enter="emit('create')" />
      <el-button type="primary" :loading="saving" @click="emit('create')">添加</el-button>
    </div>
    <div v-for="member in members" :key="member.id" class="member-row">
      <el-input
        :model-value="draftOf(member)"
        maxlength="64"
        @update:model-value="(value: string) => emit('draft', member.id, value)"
        @change="(value: string) => emit('rename', member, value)"
      />
      <el-button @click="emit('hide', member)">隐藏</el-button>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import type { AssetMember } from '../type'

defineProps<{
  visible: boolean
  members: AssetMember[]
  draftName: string
  saving: boolean
  draftOf: (member: AssetMember) => string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'update:draftName': [value: string]
  create: []
  rename: [member: AssetMember, name: string]
  hide: [member: AssetMember]
  draft: [id: string, value: string]
}>()
</script>

<style scoped lang="scss">
.hint {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.member-add,
.member-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;

  .el-input {
    flex: 1;
  }
}
</style>
