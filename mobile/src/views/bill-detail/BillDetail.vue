<template>
  <div class="bill-tail-container">
    <div class="detail-container">
      <Records v-show="tab === 'record'" />
    </div>
    <div class="bill-tail-bottom-container">
      <van-tabbar v-model="tab" active-color="#4285F4" safe-area-inset-bottom>
        <van-tabbar-item name="record" icon="paid">记账</van-tabbar-item>
        <van-tabbar-item name="overview" icon="chart-trending-o">概览</van-tabbar-item>
        <van-tabbar-item name="budget" icon="notes-o">预算</van-tabbar-item>
        <van-tabbar-item name="userInfo" icon="orders-o">计划</van-tabbar-item>
      </van-tabbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import Records from './components/records/Index.vue'

const tab = ref('record')
</script>

<style scoped lang="scss">
.bill-tail-container {
  width: 100vw;
  height: 100vh;

  display: flex;
  flex-direction: column;
  .bill-tail-bottom-container {
    width: 100%;
    height: 50px;
  }
  .detail-container {
    flex: 1;
    width: 100%;
    min-height: 0;
  }
}
</style>
