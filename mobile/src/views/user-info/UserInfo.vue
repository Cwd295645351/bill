<template>
  <div class="user-info-page">
    <div class="top-header">
      <van-image round width="4rem" height="4rem" :src="avatarUrl" />
      <div class="nick-name">{{ nickName }}</div>
    </div>
    <div class="main-container">
      <div class="context-container money-container">
        <van-cell-group>
          <van-cell title="总收入" icon="balance-o" :value="incomes" value-class="incomes" />
          <van-cell title="总支出" icon="cash-back-record-o" :value="expenses" value-class="expenses" />
        </van-cell-group>
      </div>
      <div class="context-container join-container">
        <van-cell title="加入账本" is-link @click="showJoinDialog" />
      </div>
      <div class="context-container join-container">
        <van-cell title="退出登录" is-link @click="logoutUser" />
      </div>
    </div>
  </div>
  <van-dialog v-model:show="joinDialogVisible" title="加入账本" show-cancel-button confirm-button-color="#4285F4" @confirm="confirmJoin">
    <van-cell-group inset>
      <van-field v-model="shareCode" label="分享码" placeholder="请输入分享码" />
    </van-cell-group>
  </van-dialog>
</template>

<script setup lang="ts">
import { logoutUser } from '@/utils/common-info'
import { useUserInfo } from './hooks/use-user-info'
import { useJoinDialog } from './hooks/use-join-dialog'
const { avatarUrl, nickName, incomes, expenses } = useUserInfo()
const { joinDialogVisible, shareCode, showJoinDialog, cancelJoin, confirmJoin } = useJoinDialog()
</script>

<style scoped lang="scss">
.user-info-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background-color: #7baeff;
  .top-header {
    display: flex;
    align-items: center;
    width: 100%;
    height: 150px;
    padding-left: 20px;
    .nick-name {
      margin-left: 10px;
      font-size: 24px;
      color: #fff;
    }
  }
  .main-container {
    flex: 1;
    width: 100%;
    min-height: 0;
    background-color: #fff;
    border-top-left-radius: 10px;
    border-top-right-radius: 10px;
    padding: 40px;
    .context-container {
      width: 100%;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-shadow: 1px 1px 1px #eee;
      overflow: hidden;
    }
    .money-container {
      :deep(.incomes) {
        color: #18a356;
      }
      :deep(.expenses) {
        color: #f74f4f;
      }
    }
    .join-container {
      margin-top: 20px;
    }
  }
}
</style>
