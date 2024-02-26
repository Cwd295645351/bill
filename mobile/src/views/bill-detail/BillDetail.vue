<template>
  <van-tabs v-model:active="active">
    <van-tab title="记账">内容 1</van-tab>
    <van-tab title="概览">内容 2</van-tab>
    <van-tab title="预算">内容 3</van-tab>
    <van-tab title="计划">内容 4</van-tab>
  </van-tabs>
  <div>账本详情</div>
  <div>BillId: {{ billId }}</div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'

const active = ref(0)

const route = useRoute()

const billId = computed(() => route.params.billId || '')
</script>

<style scoped></style>
