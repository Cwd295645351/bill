<template>
  <div class="layout-page-container">
    <div class="layout-context-container">
      <router-view></router-view>
    </div>
    <div class="layout-bottom-container van-safe-area-bottom">
      <van-tabbar v-model="tab" active-color="#4285F4" route safe-area-inset-bottom>
        <van-tabbar-item name="bill" to="/layout/bills" icon="balance-o">账本信息</van-tabbar-item>
        <van-tabbar-item name="userInfo" to="/layout/user-info" icon="user-o">个人信息</van-tabbar-item>
      </van-tabbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
const tab = ref('bill')
</script>

<style scoped lang="scss">
.layout-page-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  .layout-bottom-container {
    width: 100%;
    height: 50px;
  }
  .layout-context-container {
    flex: 1;
    width: 100%;
    min-height: 0;
  }
}
</style>
