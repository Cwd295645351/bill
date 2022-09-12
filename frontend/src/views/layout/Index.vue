<template>
  <div class="bill-layout-container">
    <header class="header">
      <div class="title">记亿由薪</div>
      <div class="top-menus">
        <div class="menu" :class="{ active: currentMenu === item.value }" v-for="item in menus" :key="item.value" @click="changeMenu(item.value)">
          {{ item.label }}
        </div>
      </div>
      <el-dropdown class="avatar-container" trigger="click" size="small" @command="handleAvatar">
        <div class="avatar" :style="{ 'background-image': avatarUrl }"></div>
        <el-dropdown-menu slot="dropdown">
          <el-dropdown-item command="logout">退出登录</el-dropdown-item>
        </el-dropdown-menu>
      </el-dropdown>
    </header>
  </div>
</template>

<script>
import { logout } from '@/apis'
export default {
  data() {
    return {
      currentMenu: 'record', // 当前菜单
      menus: [
        { label: '概览', value: 'overview', show: true },
        { label: '记账', value: 'record', show: true }
      ],
      avatarUrl: '' // 头像
    }
  },

  created() {
    const userInfo = this.$tools.getUserInfo()
    console.log(userInfo.avatarUrl)
    this.avatarUrl = `url(${userInfo.avatarUrl})`
  },

  mounted() {},

  methods: {
    // 切换菜单
    changeMenu(tabValue) {
      this.currentMenu = tabValue
    },
    // 点击头像
    handleAvatar(command) {
      if (command === 'logout') {
        this.$tools.logoutUser()
      }
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
    color: #333;
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
