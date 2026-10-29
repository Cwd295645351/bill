<template>
  <div class="main-tab">
    <div class="main-tab__body">
      <router-view />
    </div>
    <van-tabbar route fixed placeholder safe-area-inset-bottom active-color="#4285F4">
      <van-tabbar-item replace to="/bills" icon="orders-o">账本</van-tabbar-item>
      <van-tabbar-item replace to="/record-add" icon="add-o">记一笔</van-tabbar-item>
      <van-tabbar-item replace to="/mine" icon="user-o">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.main-tab {
  min-height: 100vh;
  background: var(--bill-bg);
}
.main-tab__body {
  min-height: calc(100vh - 50px);
}
</style>
