<template>
  <div class="bill-layout-container">
    <header class="header">
      <div class="title">记亿由薪</div>
      <div class="top-menus">
        <div class="menu" :class="{ active: currentMenu === item.value }" v-for="item in menus" :key="item.value" @click="changeMenu(item.value)">
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
  </div>
</template>

<script>
export default {
  data() {
    return {
      currentMenu: 'record', // 当前菜单
      menus: [
        { label: '概览', value: 'overview', show: true },
        { label: '记账', value: 'record', show: true }
      ],
      avatarUrl: '', // 头像
      userInfo: {}
    }
  },

  created() {
    this.userInfo = this.$tools.getUserInfo()
    this.avatarUrl = `url(${this.userInfo.avatarUrl})`
  },

  mounted() {},

  methods: {
    // 切换菜单
    changeMenu(tabValue) {
      this.currentMenu = tabValue
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
    }
    .top-menus {
      display: flex;
      align-items: center;
      margin-left: 60px;
      .menu {
        cursor: pointer;
        &.active {
          color: rgb(111, 197, 255);
        }
        & + .menu {
          margin-left: 20px;
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
