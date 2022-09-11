<template>
  <div class="login-page">
    <el-carousel class="img-box" trigger="click" height="600px" indicator-position="none">
      <el-carousel-item v-for="item in 4" :key="item">
        <div class="img" :class="['img-' + item]"></div>
      </el-carousel-item>
    </el-carousel>
    <div class="login-content">
      <div class="title">{{ title }}</div>
      <el-form :model="formInfo" :rules="rules" ref="form">
        <el-form-item prop="username">
          <el-input
            prefix-icon="el-icon-user-solid"
            v-model="formInfo.username"
            @keyup.enter.native="login('form')"
            placeholder="请输入用户名"
          ></el-input>
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            prefix-icon="el-icon-lock"
            @keyup.enter.native="login('form')"
            type="password"
            show-password
            v-model="formInfo.password"
            placeholder="请输入密码"
          ></el-input>
        </el-form-item>
        <div class="operation">
          <el-link :disabled="operationDisabled" type="primary" @click="registerUser">注册账号</el-link>
          <el-link :disabled="operationDisabled" type="primary" @click="forgetPassword">忘记密码?</el-link>
        </div>
        <el-form-item>
          <el-button class="login-btn" size="large" type="primary" @click="login('form')">登录</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script>
import rs from 'jsrsasign'
import { login, getLoginConfig } from './api'
export default {
  props: {},

  components: {},

  data() {
    return {
      title: '账号登录',
      formInfo: {
        username: '',
        password: ''
      },
      rules: {
        username: [
          {
            validator: (rule, value, callback) => {
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
            trigger: 'change'
          }
        ],
        password: [
          {
            validator: (rule, value, callback) => {
              if (!value) {
                return callback(new Error('请输入密码'))
              }
              const reg = /^[A-Za-z_\d]*$/
              if (reg.test(value)) {
                callback()
              } else {
                callback(new Error('密码只能包含英文、数字和下划线'))
              }
            },
            trigger: 'blur'
          }
        ]
      },
      operationDisabled: true, // 操作按钮禁用状态；先禁用，后续再拓展
      status: 'login', // 当前表单状态：login=登录；register=注册；forget=忘记密码
      publicKey:
        '-----BEGIN PUBLIC KEY-----\nMFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAL9FpCebYmJT0cThQcCCRJFGcKVhThPJ\nsWP2kRi+pqSCue4+7oCyLrq7bEVRUoPhP0IDpJMHNHVUeetIGaU0Aa8CAwEAAQ==\n-----END PUBLIC KEY-----\n' // rsa公钥
    }
  },

  computed: {},
  created() {
    this.getConfig()
  },

  mounted() {},

  methods: {
    // 注册账号
    registerUser() {
      console.log('注册账号')
    },
    forgetPassword() {
      console.log('忘记密码')
    },
    // 密码加密
    encryptPassword(password) {
      const pub = rs.KEYUTIL.getKey(this.publicKey)
      const encryptData = rs.KJUR.crypto.Cipher.encrypt(password, pub)
      return rs.hextob64(encryptData)
    },
    // 登录
    async login(formName) {
      this.$refs[formName].validate(async (valid) => {
        if (valid) {
          console.log('校验通过')
          const password = this.formInfo.password
          const data = {
            username: this.formInfo.username,
            password: this.encryptPassword(password)
          }
          const [err, res] = await login({ data })
          if (err) return
          if (res.retCode === 0) {
            console.log(res.data)
          } else {
            this.$message.error('登录失败，' + res.message)
          }
        } else {
          console.log('error submit!!')
          return false
        }
      })
      console.log('password:', this.encryptPassword())
    },
    // 获取登录配置
    async getConfig() {
      const [err, res] = await getLoginConfig()
      if (err) return
      if (res.retCode === 0) {
        this.publicKey = res.data.publicKey
      } else {
        this.$message.error('获取登录配置失败，' + res.data)
      }
    }
  }
}
</script>
<style lang="scss" scoped>
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
        background-image: radial-gradient(#ffffff0d, #fafafa), url('@/assets/images/img1.jpg');
      }
      &.img-2 {
        background-image: radial-gradient(#ffffff0d, #fafafa), url('@/assets/images/img2.jpg');
      }
      &.img-3 {
        background-image: radial-gradient(#ffffff0d, #fafafa), url('@/assets/images/img3.jpg');
      }
      &.img-4 {
        background-image: radial-gradient(#ffffff0d, #fafafa), url('@/assets/images/img4.jpg');
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
