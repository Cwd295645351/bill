<template>
  <div class="login-page">
    <el-carousel class="img-box" trigger="click" height="600px" indicator-position="none">
      <el-carousel-item v-for="item in 4" :key="item">
        <div class="img" :class="['img-' + item]"></div>
      </el-carousel-item>
    </el-carousel>
    <div class="login-content">
      <div class="title">{{ title }}</div>
      <el-form :model="formInfo" :rules="rules" ref="$loginForm" @keyup.enter="onEnterSubmit">
        <el-form-item prop="username">
          <el-input :prefix-icon="UserFilled" v-model="formInfo.username" :placeholder="status === 'register' ? '请输入用户名（英文数字）' : '请输入用户名'"></el-input>
        </el-form-item>
        <el-form-item prop="nickName" v-if="status === 'register'">
          <el-input :prefix-icon="UserFilled" v-model="formInfo.nickName" placeholder="请输入昵称（选填）"></el-input>
        </el-form-item>
        <el-form-item prop="password">
          <el-input :prefix-icon="Lock" type="password" show-password v-model="formInfo.password" placeholder="请输入密码"></el-input>
        </el-form-item>
        <div class="operation">
          <template v-if="status === 'register'">
            <el-link type="primary" @click="backToLogin">返回登录</el-link>
          </template>
          <template v-else>
            <el-link :disabled="operationDisabled" type="primary" @click="registerUser">注册账号</el-link>
            <!-- <el-link :disabled="operationDisabled" type="primary" @click="forgetPassword">忘记密码?</el-link> -->
          </template>
        </div>
        <el-form-item>
          <el-button class="login-btn" size="large" type="primary" @click="onEnterSubmit">{{ status === 'register' ? '注册' : '登录' }}</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { UserFilled, Lock } from '@element-plus/icons-vue'
import { useLogin } from './hooks/use-login'

const rules = {
  username: [
    {
      validator: (rule: any, value: any, callback: any) => {
        if (!value) {
          return callback(new Error('请输入用户名'))
        }
        const reg = /^[A-Za-z\d]*$/
        if (reg.test(value)) {
          callback()
        } else {
          callback(new Error('用户名只能包含英文和数字'))
        }
      },
      trigger: 'change',
    },
  ],
  password: [
    {
      validator: (rule: any, value: any, callback: any) => {
        if (!value) {
          return callback(new Error('请输入密码'))
        }
        // 登录模式使用宽松校验，兼容旧密码
        if (status.value === 'login') {
          callback()
          return
        }
        // 注册模式：强密码校验
        if (value.length < 8) {
          return callback(new Error('密码至少8位'))
        }
        if (!/[a-z]/.test(value)) {
          return callback(new Error('密码必须包含小写字母'))
        }
        if (!/[A-Z]/.test(value)) {
          return callback(new Error('密码必须包含大写字母'))
        }
        if (!/\d/.test(value)) {
          return callback(new Error('密码必须包含数字'))
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
}
const { operationDisabled, status, title, $loginForm, formInfo, registerUser, backToLogin, forgetPassword, register, login } = useLogin()

/** 回车与按钮共用：登录页登录，注册页注册 */
const onEnterSubmit = () => {
  if (status.value === 'register') register()
  else login()
}
</script>

<style scoped lang="scss">
.login-page {
  width: 100%;
  height: 100%;
  background-color: #fafafa;
  .img-box {
    width: 800px;
    position: absolute;
    top: 50%;
    left: 200px;
    transform: translateY(-50%);
    .img {
      width: 800px;
      height: 600px;
      background-size: cover;
      border-radius: 10%;
      box-shadow: 0px 0px 10px #efefef;
      &.img-1 {
        background-image: url('/images/img1.jpg');
      }
      &.img-2 {
        background-image: url('/images/img2.jpg');
      }
      &.img-3 {
        background-image: url('/images/img3.jpg');
      }
      &.img-4 {
        background-image: url('/images/img4.jpg');
      }
    }
  }
  .login-content {
    position: absolute;
    right: 200px;
    top: 50%;
    transform: translateY(-50%);
    height: 400px;
    width: 360px;
    padding: 20px;
    background-color: #fff;
    border: 1px solid #ddd;
    box-shadow: 0 0 10px #ddd;
    border-radius: 8px;
    text-align: center;
    .title {
      margin-top: 40px;
      margin-bottom: 30px;
      color: #333;
      font-size: 30px;
      font-weight: bolder;
    }
    .el-form-item {
      margin-bottom: 20px;
      text-align: center;
    }
    .operation {
      height: 20px;
      line-height: 20px;
      margin-bottom: 30px;
      font-size: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .login-btn {
      width: 100%;
    }
  }
}
</style>

<style lang="scss">
.login-page .img-box .el-carousel__container {
  height: 600px !important;
}
</style>