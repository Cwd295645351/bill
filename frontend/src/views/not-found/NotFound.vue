<template>
  <div class="not-found">
    <h1>404</h1>
    <p>页面不存在</p>
    <el-button type="primary" @click="goHome">返回账本</el-button>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
const goHome = () => {
  router.push('/layout/bill')
}
</script>

<style scoped lang="scss">
.not-found {
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #333;
  h1 {
    font-size: 64px;
    margin: 0;
    color: #999;
  }
  p {
    margin: 0 0 8px;
    font-size: 16px;
  }
}
</style>
