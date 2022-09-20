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
        <div class="updateInfo">修改信息</div>
        <div class="logout" @click="logout">退出登录</div>
        <div class="avatar" slot="reference" :style="{ 'background-image': avatarUrl }"></div>
      </el-popover>
    </header>
    <router-view></router-view>
  </div>
</template>

<script>
import { mapActions, mapState } from 'vuex'
export default {
  data() {
    return {
      currentMenu: 'bills', // 当前菜单
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
      userInfo: {}
    }
  },

  created() {
    const bills = JSON.parse(sessionStorage.getItem('bills'))
    const bill = JSON.parse(sessionStorage.getItem('bill'))
    this.currentMenu = sessionStorage.getItem('tabValue') || 'bills'
    this.userInfo = this.$tools.getUserInfo()
    this.updateState({ key: 'bills', value: bills })
    if (bill) {
      this.updateState({ key: 'bill', value: bill })
    }
    this.avatarUrl = `url(${this.userInfo.avatarUrl})`
  },

  mounted() {},
  computed: {
    ...mapState({
      bill: (state) => state.bill
    })
  },
  watch: {
    bill: {
      handler(bill) {
        this.menus = bill ? this.recordMenu : this.billsMenu
        this.currentMenu = sessionStorage.getItem('tabValue')
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
      this.updateState({ key: 'bill', value: null })
      sessionStorage.setItem('bill', null)
      sessionStorage.setItem('tabValue', 'bills')
      this.$router.push('/layout/bills')
    },
    // 退出登录
    logout() {
      this.$tools.logoutUser()
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
