<template>
  <div class="asset-page">
    <div class="subbar">
      <div class="members">
        <button type="button" :class="{ active: !memberId }" @click="memberId = ''">全部</button>
        <button v-for="member in members" :key="member.id" type="button" :class="{ active: memberId === member.id }" @click="memberId = member.id">
          {{ member.name }}
        </button>
      </div>
      <div class="tabs">
        <button v-for="item in tabs" :key="item.id" type="button" :class="{ active: tab === item.id }" @click="tab = item.id">{{ item.label }}</button>
      </div>
    </div>

    <main class="page" :class="{ fill: tab === 'trend' || tab === 'sankey' }">
      <AssetOverview :active="tab === 'overview'" :member-id="memberId" :member-name="currentMemberName" :members="members" @open-members="openMembers" @switch-tab="tab = $event" />
      <AssetFour :active="tab === 'four'" :member-id="memberId" />
      <AssetSankey :active="tab === 'sankey'" :member-id="memberId" :members="members" />
      <AssetMonth :active="tab === 'month'" :member-id="memberId" />
      <AssetTrend :active="tab === 'trend'" :member-id="memberId" />
      <AssetRetire :active="tab === 'retire'" :member-id="memberId" :member-name="currentMemberName" />
    </main>

    <AssetMemberDialog
      v-model:visible="memberVisible"
      v-model:draft-name="draftName"
      :members="members"
      :saving="memberSaving"
      :draft-of="memberDraft"
      @create="createMember"
      @rename="onRename"
      @hide="onHide"
      @draft="setMemberDraft"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, provide, ref } from 'vue'
import { useMembers } from './hooks/use-members'
import AssetOverview from './components/AssetOverview.vue'
import AssetFour from './components/AssetFour.vue'
import AssetSankey from './components/AssetSankey.vue'
import AssetMonth from './components/AssetMonth.vue'
import AssetTrend from './components/AssetTrend.vue'
import AssetRetire from './components/AssetRetire.vue'
import AssetMemberDialog from './components/AssetMemberDialog.vue'
import type { AssetMember } from './type'

const tabs = [
  { id: 'overview', label: '总览' },
  { id: 'four', label: '四笔钱' },
  { id: 'sankey', label: '资产组成' },
  { id: 'month', label: '月历' },
  { id: 'trend', label: '资产趋势' },
  { id: 'retire', label: '养老计划' },
]

const tab = ref('overview')
const memberId = ref('')
const revision = ref(0)
provide('assetRevision', revision)
const { members, visible: memberVisible, draftName, saving: memberSaving, open: openMembers, create: createMember, rename: renameMember, draftOf: memberDraft, setDraft: setMemberDraft, hide } = useMembers()
const currentMemberName = computed(() => members.value.find((item) => item.id === memberId.value)?.name || '')

const onHide = async (member: AssetMember) => {
  await hide(member)
  if (memberId.value === member.id) memberId.value = ''
  revision.value += 1
}

const onRename = async (member: AssetMember, name: string) => {
  const changed = await renameMember(member, name)
  if (changed) revision.value += 1
}
</script>

<style scoped lang="scss">
@use './components/asset.scss' as *;

.asset-page {
  height: calc(100vh - 60px);
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #fafafa;
  color: #333;
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;

  .subbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    height: 48px;
    background: #fff;
    border-bottom: 1px solid #eee;

    .members,
    .tabs {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .members button {
      @include asset-btn;
    }

    .tabs button {
      height: 48px;
      padding: 0 14px;
      border: none;
      border-radius: 0;
      background: transparent;
      cursor: pointer;
      color: #333;
      font-size: 14px;

      &.active {
        color: rgb(111, 197, 255);
        box-shadow: inset 0 -3px 0 rgb(111, 197, 255);
      }
    }
  }

  .page {
    flex: 1;
    min-height: 0;
    padding: 16px 20px 28px;
    overflow: auto;

    &.fill {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
  }
}
</style>
