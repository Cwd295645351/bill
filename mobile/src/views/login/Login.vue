<template>
  <div class="login-page">
    <div class="login-container">
      <div class="title">随 笔</div>
      <van-cell-group inset>
        <van-field v-model="username" required clearable label="账号" label-width="40px" placeholder="请输入账号" />
        <van-field v-model="password" required clearable label="密码" label-width="40px" placeholder="请输入密码" />
      </van-cell-group>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const username = ref('')
const password = ref('')
</script>

<style scoped lang="scss">
.login-page {
  width: 100vw;
  height: 100vh;
  position: relative;
  background-color: #d2eaf3;

  .login-container {
    position: absolute;
    width: 80%;
    height: 200px;
    top: 30%;
    border-radius: 8px;
    left: 10%;
    border: 1px solid #ddd;
    background-color: #eee;
    .title {
      font-size: 40px;
      font-weight: bold;
      width: 100%;
      margin-top: 10px;
      margin-bottom: 20px;
      text-align: center;
      color: #5f5f5f;
      font-family: cursive;
    }
  }
}
</style>
