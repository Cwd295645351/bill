<template>
  <div class="bill-layout-container">
    <header class="header">
      <div class="title" @click="backToBills">记亿由薪</div>
      <div class="top-menus">
        <div class="menu" :class="{ active: currentMenu === item.value }" v-for="item in menus" :key="item.value" @click="changeMenu(item)">
          {{ item.label }}
        </div>
      </div>
      <el-popover placement="bottom-end" width="240" popper-class="bill-information" trigger="click">
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
        <template #reference>
          <div class="avatar" :style="{ 'background-image': avatarUrl }"></div>
        </template>
      </el-popover>
    </header>
    <router-view @changeValue="changeTabValue"></router-view>
    <el-dialog title="加入账本" class="join-bill-dialog" v-model="joinBillDialog">
      <el-form ref="$joinForm" :model="form" :rules="rules">
        <el-form-item label="分享码" label-width="80px" prop="name" style="margin-bottom: 0">
          <el-input v-model="form.name" autocomplete="off"></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="small" :loading="dialogLoading" type="primary" @click="join">确定</el-button>
          <el-button size="small" :disabled="dialogLoading" @click="joinBillDialog = false">取消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { useLayout } from './hooks/use-layout'

const { $joinForm, joinBillDialog, dialogLoading, form, currentMenu, menus, avatarUrl, userInfo, changeMenu, backToBills, logout, showJoinBillDialog, join, changeTabValue } = useLayout()

const rules = {
  name: [
    {
      validator: (rule: any, value: any, callback: any) => {
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
      trigger: 'blur',
    },
  ],
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
    box-shadow: 0px 1px 5px 0 #b9b9b9;
    position: relative;
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
    .avatar {
      position: absolute;
      right: 20px;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background-size: cover;
      cursor: pointer;
      box-shadow: 0 0 5px #ddd;
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

.join-bill-dialog {
  width: 380px;
}
</style>
