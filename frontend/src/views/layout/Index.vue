<template>
  <div class="bill-layout-container">
    <header class="header">
      <div class="title" @click="backToBills">记亿由薪</div>
      <div class="top-menus">
        <div class="menu" :class="{ active: currentMenu === item.value }" v-for="item in menus" :key="item.value" @click="changeMenu(item)">
          {{ item.label }}
        </div>
      </div>
      <el-popover class="avatar-container" placement="bottom-end" width="240" popper-class="bill-information" trigger="click">
        <div class="name-line">
          <div class="avatar" :style="{ 'background-image': avatarUrl }"></div>
          <div class="nick-name">{{ userInfo.nickName }}</div>
        </div>
        <div class="num-line">
          <div class="item">
            <div class="num">{{ userInfo.expenses.toFixed(2) }}</div>
            <div class="label">总支出</div>
          </div>
          <div class="item">
            <div class="num">{{ userInfo.incomes.toFixed(2) }}</div>
            <div class="label">总收入</div>
          </div>
        </div>
        <div class="updateInfo" @click="showJoinBillDialog">加入账本</div>
        <div class="logout" @click="logout">退出登录</div>
        <div class="avatar" slot="reference" :style="{ 'background-image': avatarUrl }"></div>
      </el-popover>
    </header>
    <router-view></router-view>
    <el-dialog title="加入账本" custom-class="join-bill-dialog" :visible.sync="joinBillDialog">
      <el-form ref="joinForm" :model="form" :rules="rules">
        <el-form-item label="账本名称" label-width="70px" prop="name" style="margin-bottom: 0">
          <el-input v-model="form.name" autocomplete="off"></el-input>
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button size="small" :loading="dialogLoading" type="primary" @click="joinBill">确定</el-button>
        <el-button size="small" :disabled="dialogLoading" @click="joinBillDialog = false">取消</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { joinBill, getBillInfo } from './api'
import { mapActions, mapState } from 'vuex'
export default {
  data() {
    return {
      joinBillDialog: false, // 加入账本弹窗
      dialogLoading: false,
      form: { name: '' },
      currentMenu: 'bills', // 当前菜单
      rules: {
        name: [
          {
            validator: (rule, value, callback) => {
              console.log(value)
              if (!value) {
                return callback(new Error('请输入分享码'))
              }
              const reg = /^[A-Za-z0-9]{96}$/
              if (reg.test(value)) {
                callback()
              } else {
                callback(new Error('分享码只包括英文、数字，长度为96位'))
              }
            },
            trigger: 'blur'
          }
        ]
      },
      billsMenu: [{ label: '账本', value: 'bills', route: '/layout/bills' }],
      recordMenu: [
        { label: '记账', value: 'record', route: '/layout/record' },
        { label: '概览', value: 'overview', route: '' },
        { label: '计划', value: 'plan', route: '/layout/record' },
        { label: '预算', value: 'budget', route: '/layout/record' },
        { label: '设置', value: 'setting', route: '/layout/record' }
      ],
      menus: [{ label: '账本', value: 'bills', route: '/layout/bills' }],
      avatarUrl: '', // 头像
      userInfo: { nickName: '', expenses: 0, incomes: 0 }
    }
  },

  created() {
    const billId = sessionStorage.getItem('billId')
    this.currentMenu = sessionStorage.getItem('tabValue') || 'bills'
    this.userInfo = this.$tools.getUserInfo()
    if (billId) {
      this.updateState({ key: 'billId', value: billId })
    }
    this.avatarUrl = `url(${this.userInfo.avatarUrl})`
  },

  mounted() {},
  computed: {
    ...mapState({
      billId: (state) => state.billId,
      bill: (state) => state.bill
    })
  },
  watch: {
    billId: {
      handler(billId) {
        this.menus = billId ? this.recordMenu : this.billsMenu
        this.currentMenu = sessionStorage.getItem('tabValue')

        if (billId) {
          console.log(billId, typeof billId)
          this.getBillInfo(billId)
        }
      }
    }
  },

  methods: {
    ...mapActions(['updateState']),
    // 切换菜单
    changeMenu(tab) {
      if (tab.value === this.currentMenu) return
      this.currentMenu = tab.value
      sessionStorage.setItem('tabValue', tab.value)
      this.$router.push(tab.route)
    },
    // 返回账本页
    backToBills() {
      if (this.$route.path === '/layout/bills') return
      this.updateState({ key: 'billId', value: '' })
      sessionStorage.setItem('billId', '')
      sessionStorage.setItem('tabValue', 'bills')
      this.$router.push('/layout/bills')
    },
    // 退出登录
    logout() {
      this.$tools.logoutUser()
    },
    showJoinBillDialog() {
      this.joinBillDialog = true
      this.form.name = ''
    },
    // 加入账本
    async joinBill() {
      this.$refs.joinForm.validate(async (valid) => {
        if (valid) {
          const data = { code: this.form.name }
          this.dialogLoading = true
          const [err, res] = await joinBill({ data })
          this.joinBillDialog = false
          this.dialogLoading = false
          if (err) return
          if (res.retCode === 0) {
            this.$message.success('加入账本成功')
            this.updateState({ key: 'updateBill', value: true })
          } else {
            this.$message.error('加入账本失败，' + res.message)
          }
        }
      })
    },

    async getBillInfo(billId) {
      const params = { id: billId }
      const [err, res] = await getBillInfo({ params })
      if (err) return
      this.updateState({ key: 'bill', value: res.data })
    }
  }
}
</script>
<style scoped lang="scss">
.bill-layout-container {
  height: 100vh;
  width: 100vw;
  .header {
    height: 60px;
    width: 100%;
    display: flex;
    align-items: center;
    font-size: 20px;
    background-color: #f7f7f7;
    .title {
      margin-left: 20px;
      font-size: 24px;
      font-weight: bold;
      cursor: pointer;
      &:hover {
        color: rgb(111, 197, 255);
      }
    }
    .top-menus {
      display: flex;
      align-items: center;
      margin-left: 60px;
      height: 100%;
      .menu {
        height: 100%;
        line-height: 60px;
        cursor: pointer;
        &:hover {
          border-bottom: 5px solid rgba(111, 197, 255, 0.5);
        }
        &.active {
          color: rgb(111, 197, 255);
        }
        & + .menu {
          margin-left: 40px;
        }
      }
    }
    .avatar-container {
      position: absolute;
      right: 20px;
      width: 50px;
      height: 50px;
      .avatar {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background-size: cover;
        cursor: pointer;
        box-shadow: 0 0 5px #ddd;
      }
    }
  }
}
</style>
<style lang="scss">
.bill-information {
  width: 200px !important;
  height: 250px;
  color: #333;
  .name-line {
    display: flex;
    align-items: center;
    .avatar {
      width: 55px;
      height: 55px;
      border-radius: 50%;
      background-size: cover;
    }
    .nick-name {
      flex: 1;
      margin-left: 10px;
      font-size: 16px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
  .num-line {
    display: flex;
    align-items: center;
    padding: 20px 0;
    border-bottom: 1px solid #dddddd80;
    .item {
      flex: 1;
      text-align: center;
      .num {
        font-size: 16px;
      }
      .label {
        margin-top: 5px;
        color: #999;
        font-size: 12px;
      }
    }
  }
  .updateInfo,
  .logout {
    cursor: pointer;
    padding: 10px 0;
    text-align: center;
    &:hover {
      background: #eee;
    }
  }
  .updateInfo {
    border-bottom: 1px solid #dddddd80;
  }
}
</style>
<style lang="scss">
.join-bill-dialog {
  width: 380px;
}
</style>
