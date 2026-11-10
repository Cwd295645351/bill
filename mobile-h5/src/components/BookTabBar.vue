<template>
  <van-tabbar
    :model-value="active"
    fixed
    placeholder
    safe-area-inset-bottom
    active-color="#4285F4"
    inactive-color="#999999"
    :before-change="beforeChange"
  >
    <van-tabbar-item name="detail" icon="orders-o">记账</van-tabbar-item>
    <van-tabbar-item name="overview" icon="chart-trending-o">概览</van-tabbar-item>
    <van-tabbar-item name="budget" icon="balance-list-o">预算</van-tabbar-item>
    <van-tabbar-item name="plan" icon="todo-list-o">计划</van-tabbar-item>
    <van-tabbar-item name="asset" icon="gold-coin-o">资产</van-tabbar-item>
  </van-tabbar>
</template>

<script setup lang="ts">
import { showToast } from 'vant'
import { useRouter } from 'vue-router'

const props = defineProps<{
  billId: string
  active: 'detail' | 'overview' | 'budget' | 'plan' | 'asset'
}>()

const router = useRouter()

const PC_ONLY = new Set(['overview', 'asset'])

function beforeChange(name: string | number) {
  const key = String(name)
  if (PC_ONLY.has(key)) {
    showToast('请到电脑端查看或管理')
    return false
  }
  if (key === props.active) return false
  if (key === 'detail') {
    router.replace({ name: 'bill-detail', params: { id: props.billId } })
    return false
  }
  if (key === 'budget') {
    router.replace({ name: 'bill-budget', params: { id: props.billId } })
    return false
  }
  if (key === 'plan') {
    router.replace({ name: 'bill-plan', params: { id: props.billId } })
    return false
  }
  return false
}
</script>
