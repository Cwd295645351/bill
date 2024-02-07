<template>
  <div class="login-page">
    <div class="login-container">
      <div class="title">随 笔</div>
      <van-form @submit="onSubmit">
        <van-cell-group class="login-content" inset>
          <van-field
            v-model="formInfo.username"
            required
            clearable
            name="username"
            label="账号"
            label-width="50px"
            placeholder="请输入账号"
            :rules="[{ validator: rules.username, message: '用户名只能包含英文和数字' }]"
          />
          <van-field
            v-model="formInfo.password"
            required
            clearable
            name="password"
            label="密码"
            type="password"
            label-width="50px"
            placeholder="请输入密码"
            :rules="[{ validator: rules.password, message: '密码只能包含英文、数字和下划线' }]"
          />
        </van-cell-group>
        <van-button class="login-btn" type="primary" size="large" native-type="submit" :loading="loading" loading-text="加载中...">登录</van-button>
      </van-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useLogin } from './hooks/use-login'

const { formInfo, rules, onSubmit } = useLogin()

const loading = ref(false)
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
    min-height: 250px;
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
    .login-content {
      margin: 0 20px;
    }
    .login-btn {
      margin: 10px 20px;
      width: calc(100% - 40px);
    }
  }
}
</style>
